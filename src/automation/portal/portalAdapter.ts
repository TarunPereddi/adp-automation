import type { Page } from 'puppeteer';
import type { AppConfig } from '../../config/config.js';
import type { AttendanceAction, AttendanceState, PortalResult } from '../../types/domain.js';
import { classifyChallenge } from './challenges.js';
import { deepQuery, deepValue, typeDeep, waitForDeep } from './shadowDom.js';
import { selectors } from './selectors.js';

export class PortalAdapter {
  private readonly diagnostics: string[] = [];

  constructor(
    private readonly page: Page,
    private readonly config: AppConfig & { portal: AppConfig['portal'] & { username: string } },
  ) {
    page.on('console', (message) =>
      this.recordDiagnostic(`console:${message.type()}:${message.text()}`),
    );
    page.on('pageerror', (error) =>
      this.recordDiagnostic(`pageerror:${error instanceof Error ? error.message : String(error)}`),
    );
    page.on('requestfailed', (request) =>
      this.recordDiagnostic(
        `requestfailed:${request.failure()?.errorText ?? 'unknown'}:${request.url()}`,
      ),
    );
    page.on('response', (response) => {
      if (response.status() >= 400)
        this.recordDiagnostic(`response:${response.status()}:${response.url()}`);
    });
  }

  getDiagnostics(): string[] {
    return this.diagnostics.slice(-20);
  }

  private recordDiagnostic(value: string): void {
    this.diagnostics.push(value.slice(0, 500));
    if (this.diagnostics.length > 50) this.diagnostics.shift();
  }

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
      let fieldsReady = false;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await typeDeep(this.page, selectors.username.selector, this.config.portal.username);
        await typeDeep(this.page, selectors.password.selector, password);
        await new Promise((resolve) => setTimeout(resolve, 500));
        fieldsReady =
          (await deepValue(this.page, selectors.username.selector)) ===
            this.config.portal.username &&
          (await deepValue(this.page, selectors.password.selector)) === password;
        if (fieldsReady) break;
      }
      if (!fieldsReady) throw new Error('Login fields did not retain their values');
      await waitForDeep(this.page, selectors.loginButton.selector);
      await this.page.waitForFunction(
        (target) => {
          const element = document.querySelector(target);
          return element && !element.hasAttribute('disabled');
        },
        { timeout: 10_000 },
        selectors.loginButton.selector,
      );
      const button = await waitForDeep(this.page, selectors.loginButton.selector);
      await button.click();
      await this.page
        .waitForFunction(
          () =>
            window.location.pathname !== '/ng/login' ||
            /captcha|security question|verification code|one[- ]time password|\botp\b|multi[- ]factor|authenticator app|\bmfa\b/i.test(
              document.body?.innerText ?? '',
            ),
          { timeout: 30_000 },
        )
        .catch(() => undefined);
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
    await waitForDeep(this.page, selectors.authenticatedMarker.selector, 30_000).catch(
      () => undefined,
    );
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
    let [punchInText, punchOutText] = await Promise.all([
      this.readStat(selectors.punchInTime.selector),
      this.readStat(selectors.punchOutTime.selector),
    ]);
    if (authenticated && !punchInText && !punchOutText) {
      const informationButton = await deepQuery(
        this.page,
        selectors.punchInformationButton.selector,
      );
      if (informationButton) {
        await informationButton.click();
        await waitForDeep(this.page, selectors.punchInTime.selector, 5_000).catch(() => undefined);
        [punchInText, punchOutText] = await Promise.all([
          this.readStat(selectors.punchInTime.selector),
          this.readStat(selectors.punchOutTime.selector),
        ]);
      }
    }
    if (authenticated) {
      await this.waitForMeaningfulStat(selectors.scheduledShift.selector, 10_000);
      [punchInText, punchOutText] = await Promise.all([
        this.readStat(selectors.punchInTime.selector),
        this.readStat(selectors.punchOutTime.selector),
      ]);
    }
    const punchInTime = normalizedPunchTime(punchInText);
    const punchOutTime = normalizedPunchTime(punchOutText);
    const punchActionText = await this.readStat(selectors.punchButton.selector);
    const hasPunchAction = Boolean(await deepQuery(this.page, selectors.punchButton.selector));
    const evidence: string[] = [];
    if (punchInText) evidence.push(`punch-in:${punchInText.slice(0, 40)}`);
    if (punchOutText) evidence.push(`punch-out:${punchOutText.slice(0, 40)}`);
    if (punchActionText) evidence.push(`punch-action:${punchActionText.slice(0, 40)}`);
    if (hasPunchAction) evidence.push('punch-action-available');
    return {
      authenticated,
      punchedIn: Boolean(punchInTime) || /^punch out$/i.test(punchActionText),
      punchedOut: Boolean(punchOutTime),
      punchInTime,
      punchOutTime,
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
    const beforePunchAction = await this.readStat(selectors.punchButton.selector);
    const alreadyDone = action === 'PUNCH_IN' ? before.punchedIn : before.punchedOut;
    if (alreadyDone) return { ok: true, value: before };
    const button = await deepQuery(this.page, selectors.punchButton.selector);
    if (!button)
      return {
        ok: false,
        failureCategory: 'SELECTOR_CHANGED',
        message: 'Punch button not found',
      };
    await button.click();
    const confirm = await waitForDeep(this.page, selectors.confirmPunchButton.selector, 10_000);
    const location = await this.waitForMeaningfulStat(selectors.punchLocation.selector, 15_000);
    if (!location || /^[-:]+$/.test(location)) {
      return {
        ok: false,
        failureCategory: 'ATTENDANCE_STATE_INVALID',
        message: 'Punch dialog did not resolve the configured attendance location',
      };
    }
    await confirm.click();
    await this.page
      .waitForFunction(
        (target) => {
          const visit = (root: Document | ShadowRoot): boolean => {
            if (root.querySelector(target)) return true;
            return [...root.querySelectorAll('*')].some(
              (element) => element.shadowRoot && visit(element.shadowRoot),
            );
          };
          return !visit(document);
        },
        { timeout: 5_000 },
        selectors.confirmPunchButton.selector,
      )
      .catch(() => undefined);
    const after = await this.waitForAttendanceState(action, beforePunchAction, 20_000);
    const verified = action === 'PUNCH_IN' ? after.punchedIn : after.punchedOut;
    return verified
      ? { ok: true, value: after }
      : {
          ok: false,
          failureCategory: 'ATTENDANCE_STATE_INVALID',
          message: 'Portal state did not confirm the action',
        };
  }

  private async readStat(selector: string): Promise<string> {
    const element = await deepQuery(this.page, selector);
    return element
      ? element.evaluate((target) => target.textContent?.trim().replace(/\s+/g, ' ') ?? '')
      : '';
  }

  private async waitForAttendanceState(
    action: AttendanceAction,
    beforePunchAction: string,
    timeoutMs: number,
  ): Promise<AttendanceState> {
    const deadline = Date.now() + timeoutMs;
    let state = await this.readAttendanceState();
    while (Date.now() < deadline) {
      const verified = action === 'PUNCH_IN' ? state.punchedIn : state.punchedOut;
      if (verified) return state;
      if (action === 'PUNCH_OUT' && /^punch out$/i.test(beforePunchAction)) {
        const currentPunchAction = await this.readStat(selectors.punchButton.selector);
        if (currentPunchAction && !/^punch out$/i.test(currentPunchAction)) {
          return {
            ...state,
            punchedOut: true,
            evidence: [...state.evidence, `punch-action-transition:${currentPunchAction}`],
          };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      state = await this.readAttendanceState();
    }
    return state;
  }

  private async waitForMeaningfulStat(selector: string, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let value = await this.readStat(selector);
    while (Date.now() < deadline && (!value || /^[-:]+$/.test(value))) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      value = await this.readStat(selector);
    }
    return value;
  }
}

function normalizedPunchTime(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized || /^[-:]+$/.test(normalized)) return undefined;
  return normalized;
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
