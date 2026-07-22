import { describe, expect, it } from 'vitest';
import { attendanceAttemptKey } from '../src/automation/attendance/idempotency.js';

describe('attendance attempt idempotency', () => {
  it('does not let a failed earlier workflow consume the whole day', () => {
    const common = {
      baseKey: 'account:2026-07-22:PUNCH_IN',
      runId: 'local',
      manual: false,
      safeDisabled: false,
    };
    const first = attendanceAttemptKey({
      ...common,
      githubRunId: '100',
      githubRunAttempt: '1',
    });
    const later = attendanceAttemptKey({
      ...common,
      githubRunId: '200',
      githubRunAttempt: '1',
    });

    expect(first).not.toBe(later);
    expect(first).not.toBe(common.baseKey);
    expect(later).not.toBe(common.baseKey);
  });

  it('distinguishes a GitHub rerun attempt', () => {
    const common = {
      baseKey: 'account:2026-07-22:PUNCH_IN',
      runId: 'local',
      githubRunId: '100',
      manual: false,
      safeDisabled: false,
    };

    expect(attendanceAttemptKey({ ...common, githubRunAttempt: '1' })).not.toBe(
      attendanceAttemptKey({ ...common, githubRunAttempt: '2' }),
    );
  });
});
