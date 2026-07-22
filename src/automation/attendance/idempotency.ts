interface AttendanceAttemptKeyInput {
  baseKey: string;
  runId: string;
  githubRunId?: string;
  githubRunAttempt?: string;
  manual: boolean;
  safeDisabled: boolean;
}

export function attendanceAttemptKey(input: AttendanceAttemptKeyInput): string {
  const attempt = input.githubRunId
    ? `${input.githubRunId}:${input.githubRunAttempt ?? '1'}`
    : input.runId;
  const kind = input.safeDisabled ? 'DRY_RUN' : input.manual ? 'MANUAL' : 'SCHEDULED';
  return `${input.baseKey}:${kind}:${attempt}`;
}
