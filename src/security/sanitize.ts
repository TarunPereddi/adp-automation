const sensitiveKey =
  /password|secret|token|authorization|cookie|answer|code|uri|latitude|longitude|location/i;
const uri = /mongodb(?:\+srv)?:\/\/[^\s"']+/gi;
const bearer = /bearer\s+[a-z0-9._~+/=-]+/gi;
const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const accountId =
  /((?:accountNo=|\/(?:getPunchesForStartAndEndDate|getEmployeeCalenderData|currentWeekHours)\/))\d+/gi;
const coordinates = /((?:latitude|longitude)=)-?\d+(?:\.\d+)?/gi;

export function sanitizeText(text: string): string {
  return text
    .replace(uri, '[REDACTED_MONGODB_URI]')
    .replace(bearer, 'Bearer [REDACTED]')
    .replace(email, '[REDACTED_EMAIL]')
    .replace(accountId, '$1[REDACTED_ACCOUNT_ID]')
    .replace(coordinates, '$1[REDACTED_COORDINATE]');
}

export function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return sanitizeText(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : sanitize(item, seen),
    ]),
  );
}
