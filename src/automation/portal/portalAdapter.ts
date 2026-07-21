import type { Page } from 'puppeteer';
import type { AppConfig } from '../../config/config.js';
import type { AttendanceAction, AttendanceState, PortalResult } from '../../types/domain.js';
import { classifyChallenge } from './challenges.js';
import { deepQuery, typeDeep, waitForDeep } from './shadowDom.js';
import { selectors } from './selectors.js';

export class PortalAdapter {
  constructor(
    private readonly page: Page,
    private readonly config: AppConfig & { portal: AppConfig['portal'] & { username: string } },
  ) {}

  async openLogin(): Promise<void> {
    const readySelector = `${selectors.username.selector}, ${selectors.authenticatedMarker.selector}`;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await this.page.goto(this.config.portal.loginUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        // The hosted runner can take well over 30 seconds to hydrate ADP's
        // Angular/Web Component login shell even after DOMContentLoaded.
        await waitForDeep(this.page, readySelector, 90_000);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 3_000));
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('ADP login page did not become interactive');
  }

  async login(password: string): Promise<PortalResult<AttendanceState>> {
    const before = await classifyChallenge(this.page);
    if (before !== 'NONE' && before !== 'SECURITY_QUESTION') {
      return { ok: false, challenge: before, failureCategory: challengeCategory(before) };
    }
    try {
      await typeDeep(this.page, selectors.username.selector, this.config.portal.username);
      await typeDeep(this.page, selectors.password.selector, password);
      const button = await waitForDeep(this.page, selectors.loginButton.selector);
      await button.click();
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    } catch (error) {
      return {
        ok: false,
        failureCategory: 'SELECTOR_CHANGED',
        message: error instanceof Error ? error.message : 'Login interaction failed',
      };
    }
    const challenge = await classifyChallenge(this.page);
    if (challenge !== 'NONE') {
      return { ok: false, challenge, failureCategory: challengeCategory(challenge) };
    }
    const state = await this.readAttendanceState();
    return state.authenticated
      ? { ok: true, value: state, challenge: 'NONE' }
      : {
          ok: false,
          challenge: 'NONE',
          failureCategory: 'AUTHENTICATION_FAILED',
          message: 'No positive authenticated evidence',
        };
  }

  async readAttendanceState(): Promise<AttendanceState> {
    const authenticated = Boolean(
      await deepQuery(this.page, selectors.authenticatedMarker.selector),
    );
    const stateElement = await deepQuery(this.page, selectors.attendanceState.selector);
    const stateText = stateElement
      ? await stateElement.evaluate((element) => element.textContent?.trim().toLowerCase() ?? '')
      : '';
    const hasPunchOut = Boolean(await deepQuery(this.page, selectors.punchOutButton.selector));
    const hasPunchIn = Boolean(await deepQuery(this.page, selectors.punchInButton.selector));
    const evidence = stateText ? [stateText.slice(0, 160)] : [];
    if (hasPunchIn) evidence.push('punch-in-action-available');
    if (hasPunchOut) evidence.push('punch-out-action-available');
    return {
      authenticated,
      punchedIn: /punched in|clocked in/.test(stateText) || (hasPunchOut && !hasPunchIn),
      punchedOut: /punched out|clocked out|completed/.test(stateText),
      evidence,
    };
  }

  async submitAttendance(action: AttendanceAction): Promise<PortalResult<AttendanceState>> {
    if (!this.config.portal.selectorsVerified) {
      return {
        ok: false,
        failureCategory: 'CONFIGURATION_ERROR',
        message: 'Live selectors are not verified',
      };
    }
    const before = await this.readAttendanceState();
    const alreadyDone = action === 'PUNCH_IN' ? before.punchedIn : before.punchedOut;
    if (alreadyDone) return { ok: true, value: before };
    const selector =
      action === 'PUNCH_IN' ? selectors.punchInButton.selector : selectors.punchOutButton.selector;
    const button = await deepQuery(this.page, selector);
    if (!button)
      return {
        ok: false,
        failureCategory: 'SELECTOR_CHANGED',
        message: 'Attendance action button not found',
      };
    await button.click();
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const after = await this.readAttendanceState();
    const verified = action === 'PUNCH_IN' ? after.punchedIn : after.punchedOut;
    return verified
      ? { ok: true, value: after }
      : {
          ok: false,
          failureCategory: 'ATTENDANCE_STATE_INVALID',
          message: 'Portal state did not confirm the action',
        };
  }
}

function challengeCategory(
  challenge: Exclude<Awaited<ReturnType<typeof classifyChallenge>>, 'NONE'>,
) {
  const categories = {
    SECURITY_QUESTION: 'SECURITY_QUESTION_FAILED',
    EMAIL_CODE_REQUIRED: 'EMAIL_CODE_REQUIRED',
    MFA_REQUIRED: 'MFA_REQUIRED',
    OTP_REQUIRED: 'OTP_REQUIRED',
    CAPTCHA_REQUIRED: 'CAPTCHA_REQUIRED',
    UNKNOWN_DEVICE: 'UNKNOWN_DEVICE',
    MANUAL_INTERVENTION_REQUIRED: 'UNKNOWN',
  } as const;
  return categories[challenge];
}
