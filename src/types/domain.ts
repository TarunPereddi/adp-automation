export type AttendanceAction = 'PUNCH_IN' | 'PUNCH_OUT';

export type VerificationChallenge =
  | 'NONE'
  | 'SECURITY_QUESTION'
  | 'EMAIL_CODE_REQUIRED'
  | 'MFA_REQUIRED'
  | 'OTP_REQUIRED'
  | 'CAPTCHA_REQUIRED'
  | 'UNKNOWN_DEVICE'
  | 'MANUAL_INTERVENTION_REQUIRED';

export type AttendanceSkipReason =
  | 'WEEKEND'
  | 'HOLIDAY'
  | 'APPROVED_LEAVE'
  | 'CALENDAR_UNCERTAIN'
  | 'ALREADY_PUNCHED_IN'
  | 'ALREADY_PUNCHED_OUT'
  | 'OUTSIDE_TIME_WINDOW'
  | 'AUTHENTICATION_FAILED'
  | 'VERIFICATION_REQUIRED'
  | 'PORTAL_UNAVAILABLE'
  | 'LOCK_CONFLICT'
  | 'CREDENTIAL_STATE_UNCERTAIN'
  | 'MANUAL_INTERVENTION_REQUIRED';

export type FailureCategory =
  | 'NETWORK'
  | 'PORTAL_UNAVAILABLE'
  | 'SELECTOR_CHANGED'
  | 'AUTHENTICATION_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'UNKNOWN_DEVICE'
  | 'EMAIL_CODE_REQUIRED'
  | 'MFA_REQUIRED'
  | 'OTP_REQUIRED'
  | 'CAPTCHA_REQUIRED'
  | 'SECURITY_QUESTION_FAILED'
  | 'ATTENDANCE_STATE_INVALID'
  | 'CALENDAR_LOOKUP_FAILED'
  | 'DATABASE_UNAVAILABLE'
  | 'LOCK_CONFLICT'
  | 'PASSWORD_POLICY_UNKNOWN'
  | 'PASSWORD_ROTATION_INCONSISTENT'
  | 'SESSION_EXPIRED'
  | 'CONFIGURATION_ERROR'
  | 'MISSED_RUN'
  | 'UNKNOWN';

export type RotationState =
  | 'PLANNED'
  | 'LOCK_ACQUIRED'
  | 'CURRENT_PASSWORD_LOADED'
  | 'CURRENT_PASSWORD_VERIFIED'
  | 'PASSWORD_CHANGE_STARTED'
  | 'PORTAL_PASSWORD_CHANGED'
  | 'NEW_PASSWORD_VERIFIED'
  | 'DATABASE_UPDATED'
  | 'CONSISTENCY_VERIFIED'
  | 'COMPLETED'
  | 'ROLLBACK_REQUIRED'
  | 'MANUAL_INTERVENTION_REQUIRED'
  | 'FAILED';

export interface EncryptedValue {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  ciphertext: string;
  authTag: string;
}

export interface CredentialRecord {
  accountId: string;
  currentPasswordEncrypted: EncryptedValue;
  previousPasswordEncrypted?: EncryptedValue;
  credentialVersion: number;
  rotationStatus?: RotationState;
  rotatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarResult {
  status: 'WORKDAY' | 'HOLIDAY' | 'LEAVE' | 'UNKNOWN';
  verified: boolean;
  source: string;
  checkedAt: Date;
  expiresAt: Date;
  reason?: string;
}

export interface AttendanceState {
  authenticated: boolean;
  punchedIn: boolean;
  punchedOut: boolean;
  punchInTime?: string;
  punchOutTime?: string;
  evidence: string[];
}

export interface AttendanceDecision {
  allowed: boolean;
  action: AttendanceAction;
  reason?: AttendanceSkipReason;
  details: string[];
}

export interface AutomationRun {
  runId: string;
  idempotencyKey: string;
  accountId: string;
  action: AttendanceAction | 'PASSWORD_ROTATION' | 'DIAGNOSTIC';
  status: 'STARTED' | 'SKIPPED' | 'SUCCEEDED' | 'FAILED' | 'WAITING_FOR_VERIFICATION';
  startedAt: Date;
  completedAt?: Date;
  skipReason?: AttendanceSkipReason;
  failureCategory?: FailureCategory;
  sanitizedMessage?: string;
  artifactUrl?: string;
  githubRunUrl?: string;
}

export interface PortalResult<T> {
  ok: boolean;
  value?: T;
  challenge?: VerificationChallenge;
  failureCategory?: FailureCategory;
  message?: string;
}
