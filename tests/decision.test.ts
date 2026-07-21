import { describe, expect, it } from 'vitest';
import { decideAttendance } from '../src/automation/attendance/decision.js';
import type { CalendarResult } from '../src/types/domain.js';

const workday: CalendarResult = {
  status: 'WORKDAY',
  verified: true,
  source: 'fixture',
  checkedAt: new Date(),
  expiresAt: new Date(Date.now() + 1_000),
};
const schedule = {
  punchIn: '09:00',
  punchOut: '18:00',
  punchInBefore: 15,
  punchInAfter: 30,
  punchOutBefore: 15,
  punchOutAfter: 30,
};

describe('attendance decision engine', () => {
  it('permits a verified eligible punch in', () => {
    const result = decideAttendance({
      action: 'PUNCH_IN',
      now: new Date('2026-07-14T03:30:00Z'),
      schedule,
      calendar: workday,
      portalState: { authenticated: true, punchedIn: false, punchedOut: false, evidence: [] },
      challenge: 'NONE',
      credentialConsistent: true,
      selectorsVerified: true,
    });
    expect(result.allowed).toBe(true);
  });

  it('fails closed for an unverified calendar', () => {
    const result = decideAttendance({
      action: 'PUNCH_IN',
      now: new Date('2026-07-14T03:30:00Z'),
      schedule,
      portalState: { authenticated: true, punchedIn: false, punchedOut: false, evidence: [] },
      challenge: 'NONE',
      credentialConsistent: true,
      selectorsVerified: true,
      calendar: { ...workday, status: 'UNKNOWN', verified: false },
    });
    expect(result.reason).toBe('CALENDAR_UNCERTAIN');
  });

  it('fails closed for an authentication challenge', () => {
    const result = decideAttendance({
      action: 'PUNCH_IN',
      now: new Date('2026-07-14T03:30:00Z'),
      schedule,
      calendar: workday,
      portalState: { authenticated: true, punchedIn: false, punchedOut: false, evidence: [] },
      challenge: 'MFA_REQUIRED',
      credentialConsistent: true,
      selectorsVerified: true,
    });
    expect(result.reason).toBe('VERIFICATION_REQUIRED');
  });

  it('fails closed for unverified selectors', () => {
    const result = decideAttendance({
      action: 'PUNCH_IN',
      now: new Date('2026-07-14T03:30:00Z'),
      schedule,
      calendar: workday,
      portalState: { authenticated: true, punchedIn: false, punchedOut: false, evidence: [] },
      challenge: 'NONE',
      credentialConsistent: true,
      selectorsVerified: false,
    });
    expect(result.reason).toBe('MANUAL_INTERVENTION_REQUIRED');
  });
});
