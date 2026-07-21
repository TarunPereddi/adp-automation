import { actionWindow, isWithinWindow, istParts } from '../../shared/time.js';
import type {
  AttendanceAction,
  AttendanceDecision,
  AttendanceState,
  CalendarResult,
  VerificationChallenge,
} from '../../types/domain.js';

interface DecisionInput {
  action: AttendanceAction;
  now: Date;
  schedule: Parameters<typeof actionWindow>[1];
  calendar: CalendarResult;
  portalState: AttendanceState;
  challenge: VerificationChallenge;
  credentialConsistent: boolean;
  selectorsVerified: boolean;
}

export function decideAttendance(input: DecisionInput): AttendanceDecision {
  const details: string[] = [];
  const time = istParts(input.now);
  if (time.weekday === 0 || time.weekday === 6) {
    return { allowed: false, action: input.action, reason: 'WEEKEND', details };
  }
  if (!input.credentialConsistent) {
    return { allowed: false, action: input.action, reason: 'CREDENTIAL_STATE_UNCERTAIN', details };
  }
  if (!input.selectorsVerified) {
    return {
      allowed: false,
      action: input.action,
      reason: 'MANUAL_INTERVENTION_REQUIRED',
      details: ['Portal selectors are not operator-verified'],
    };
  }
  if (input.challenge !== 'NONE') {
    return {
      allowed: false,
      action: input.action,
      reason: 'VERIFICATION_REQUIRED',
      details: [input.challenge],
    };
  }
  if (!input.portalState.authenticated) {
    return { allowed: false, action: input.action, reason: 'AUTHENTICATION_FAILED', details };
  }
  if (input.calendar.status === 'HOLIDAY' && input.calendar.verified) {
    return {
      allowed: false,
      action: input.action,
      reason: 'HOLIDAY',
      details: [input.calendar.source],
    };
  }
  if (input.calendar.status === 'LEAVE' && input.calendar.verified) {
    return {
      allowed: false,
      action: input.action,
      reason: 'APPROVED_LEAVE',
      details: [input.calendar.source],
    };
  }
  if (input.calendar.status !== 'WORKDAY' || !input.calendar.verified) {
    return {
      allowed: false,
      action: input.action,
      reason: 'CALENDAR_UNCERTAIN',
      details: [input.calendar.reason ?? 'Unverified calendar'],
    };
  }
  const window = actionWindow(input.action, input.schedule);
  if (!isWithinWindow(time.minutes, window.target, window.before, window.after)) {
    return { allowed: false, action: input.action, reason: 'OUTSIDE_TIME_WINDOW', details };
  }
  if (input.action === 'PUNCH_IN' && input.portalState.punchedIn) {
    return {
      allowed: false,
      action: input.action,
      reason: 'ALREADY_PUNCHED_IN',
      details: input.portalState.evidence,
    };
  }
  if (input.action === 'PUNCH_OUT' && input.portalState.punchedOut) {
    return {
      allowed: false,
      action: input.action,
      reason: 'ALREADY_PUNCHED_OUT',
      details: input.portalState.evidence,
    };
  }
  if (input.action === 'PUNCH_OUT' && !input.portalState.punchedIn) {
    return {
      allowed: false,
      action: input.action,
      reason: 'MANUAL_INTERVENTION_REQUIRED',
      details: ['Cannot punch out without verified punch-in state'],
    };
  }
  return { allowed: true, action: input.action, details: ['All safety gates passed'] };
}
