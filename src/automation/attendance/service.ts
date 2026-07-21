import { randomUUID } from 'node:crypto';
import type { Page } from 'puppeteer';
import {
  combineCalendar,
  type HolidayProvider,
  type LeaveProvider,
} from '../../calendar/providers.js';
import type { AppConfig } from '../../config/config.js';
import { logger } from '../../logging/logger.js';
import type { CredentialRepository } from '../../repositories/credentialRepository.js';
import type { LockRepository } from '../../repositories/lockRepository.js';
import type { RunRepository } from '../../repositories/runRepository.js';
import { istParts } from '../../shared/time.js';
import type { AttendanceAction, AutomationRun } from '../../types/domain.js';
import { BrowserManager } from '../browser/browserManager.js';
import { captureFailure } from '../browser/artifacts.js';
import { PortalAdapter } from '../portal/portalAdapter.js';
import { decideAttendance } from './decision.js';

interface AttendanceDependencies {
  config: AppConfig & {
    portal: AppConfig['portal'] & { username: string; accountId: string };
    attendanceLocation: NonNullable<AppConfig['attendanceLocation']>;
  };
  credentials: CredentialRepository;
  locks: LockRepository;
  runs: RunRepository;
  holidays: HolidayProvider;
  leaves: LeaveProvider;
}

export class AttendanceService {
  constructor(private readonly dependencies: AttendanceDependencies) {}

  async run(action: AttendanceAction, now = new Date()): Promise<void> {
    const { config, locks, runs } = this.dependencies;
    const { dateKey, weekday } = istParts(now);
    const runId = randomUUID();
    const baseKey = `${config.portal.accountId}:${dateKey}:${action}`;
    const explicitManualRun = process.env.MANUAL_ACTION === action && config.github.runId;
    const idempotencyKey =
      config.dryRun || !config.automationEnabled
        ? `${baseKey}:DRY_RUN:${runId}`
        : explicitManualRun
          ? `${baseKey}:MANUAL:${config.github.runId}`
          : baseKey;
    const lockKey = `attendance:${config.portal.accountId}:${dateKey}:${action}`;
    const owner = `${process.env.GITHUB_RUN_ID ?? 'local'}:${runId}`;
    const run: AutomationRun = {
      runId,
      idempotencyKey,
      accountId: config.portal.accountId,
      action,
      status: 'STARTED',
      startedAt: now,
      githubRunUrl: githubRunUrl(config),
    };
    if (!(await locks.acquire(lockKey, owner, 15 * 60_000))) {
      logger.warn('Attendance lock conflict', { action, dateKey });
      return;
    }
    let manager: BrowserManager | undefined;
    let page: Page | undefined;
    let portal: PortalAdapter | undefined;
    try {
      if (!(await runs.start(run))) {
        logger.info('Idempotent attendance run already exists', { action, dateKey });
        return;
      }
      if (weekday === 0 || weekday === 6) {
        await runs.complete(runId, {
          status: 'SKIPPED',
          skipReason: 'WEEKEND',
          sanitizedMessage: 'Weekend preflight blocked portal login',
        });
        logger.info('Attendance safely skipped before login', { action, reason: 'WEEKEND' });
        return;
      }
      const holiday = await this.dependencies.holidays.getHolidayStatus(dateKey);
      if (holiday.status === 'HOLIDAY' && holiday.verified) {
        await runs.complete(runId, {
          status: 'SKIPPED',
          skipReason: 'HOLIDAY',
          sanitizedMessage: holiday.source,
        });
        logger.info('Attendance safely skipped before login', { action, reason: 'HOLIDAY' });
        return;
      }
      const configuredLeave = await this.dependencies.leaves.getLeaveStatus(dateKey);
      if (configuredLeave.status === 'LEAVE' && configuredLeave.verified) {
        await runs.complete(runId, {
          status: 'SKIPPED',
          skipReason: 'APPROVED_LEAVE',
          sanitizedMessage: configuredLeave.source,
        });
        logger.info('Attendance safely skipped before login', {
          action,
          reason: 'APPROVED_LEAVE',
        });
        return;
      }
      const credential = await this.dependencies.credentials.getCandidates(config.portal.accountId);
      if (!credential) throw new Error('No encrypted credential exists for this account');
      const metadata = await this.dependencies.credentials.metadata(config.portal.accountId);
      const credentialConsistent =
        metadata?.rotationStatus !== 'ROLLBACK_REQUIRED' &&
        metadata?.rotationStatus !== 'MANUAL_INTERVENTION_REQUIRED';

      manager = new BrowserManager(config);
      page = await manager.open();
      portal = new PortalAdapter(page, config);
      await portal.openLogin();
      if (!(await manager.verifyConfiguredLocation(page)))
        throw new Error('Browser location verification failed');
      const login = await portal.login(credential.current);
      if (!login.ok || !login.value) {
        await runs.complete(runId, {
          status:
            login.challenge && login.challenge !== 'NONE' ? 'WAITING_FOR_VERIFICATION' : 'FAILED',
          failureCategory: login.failureCategory,
          sanitizedMessage: login.message ?? login.challenge,
        });
        await captureFailure(page, {
          runId,
          action,
          failureCategory: login.failureCategory,
          challenge: login.challenge,
          message: login.message,
          portalUrl: page.url(),
          browserDiagnostics: portal.getDiagnostics(),
        });
        process.exitCode = 1;
        return;
      }

      let portalState = login.value;
      if (action === 'PUNCH_OUT' && !portalState.punchedIn) {
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline && !portalState.punchedIn) {
          await new Promise((resolve) => setTimeout(resolve, 1_000));
          portalState = await portal.readAttendanceState();
        }
      }

      const liveLeave = await portal.getLeaveStatus(dateKey);
      const leave = liveLeave;
      const portalWorkdayConfirmed =
        portalState.evidence.some((item) => item.endsWith('action-available')) && leave.verified;
      const calendar = combineCalendar(holiday, leave, portalWorkdayConfirmed);
      const decision = decideAttendance({
        action,
        now,
        schedule: config.schedule,
        calendar,
        portalState,
        challenge: login.challenge ?? 'NONE',
        credentialConsistent,
        selectorsVerified: config.portal.selectorsVerified,
      });
      if (!decision.allowed) {
        await runs.complete(runId, {
          status: 'SKIPPED',
          skipReason: decision.reason,
          sanitizedMessage: decision.details.join('; '),
        });
        logger.info('Attendance safely skipped', { action, reason: decision.reason });
        return;
      }
      if (!config.automationEnabled || config.dryRun) {
        await runs.complete(runId, {
          status: 'SKIPPED',
          sanitizedMessage: 'All checks passed; real action blocked by safe-disabled configuration',
        });
        logger.info('Dry run passed; attendance action not submitted', { action });
        return;
      }
      const result = await portal.submitAttendance(action);
      if (!result.ok) {
        await runs.complete(runId, {
          status: 'FAILED',
          failureCategory: result.failureCategory,
          sanitizedMessage: result.message,
        });
        await captureFailure(page, {
          runId,
          action,
          failureCategory: result.failureCategory,
          message: result.message,
          browserDiagnostics: portal.getDiagnostics(),
        });
        process.exitCode = 1;
        return;
      }
      await runs.complete(runId, {
        status: 'SUCCEEDED',
        sanitizedMessage: 'Portal state positively verified',
      });
      logger.info('Attendance action completed and verified', { action });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown attendance failure';
      logger.error('Attendance run failed', { action, error: message });
      await runs
        .complete(runId, {
          status: 'FAILED',
          failureCategory: 'UNKNOWN',
          sanitizedMessage: message,
        })
        .catch(() => undefined);
      await captureFailure(page, {
        runId,
        action,
        error: message,
        portalUrl: page?.url(),
        browserDiagnostics: portal?.getDiagnostics(),
      }).catch(() => undefined);
      process.exitCode = 1;
    } finally {
      await manager?.close().catch(() => undefined);
      await locks.release(lockKey, owner).catch(() => undefined);
    }
  }
}

function githubRunUrl(config: AppConfig): string | undefined {
  if (!config.github.repository || !config.github.runId) return undefined;
  return `https://github.com/${config.github.repository}/actions/runs/${config.github.runId}`;
}
