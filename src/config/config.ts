import 'dotenv/config';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const optionalLatitude = z.coerce.number().min(-90).max(90).optional();
const optionalLongitude = z.coerce.number().min(-180).max(180).optional();

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_TIMEZONE: z.literal('Asia/Kolkata').default('Asia/Kolkata'),
    ADP_USERNAME: z.string().email().optional(),
    ADP_LOGIN_URL: z
      .url()
      .default('https://infoservices.securtime.adp.com/login?redirectUrl=%2Fwelcome'),
    ADP_ACCOUNT_ID: z.string().min(1).optional(),
    ADP_SECURITY_ANSWERS_JSON: z.string().default('{}'),
    ATTENDANCE_LATITUDE: optionalLatitude,
    ATTENDANCE_LONGITUDE: optionalLongitude,
    ATTENDANCE_LOCATION_ACCURACY_METERS: z.coerce.number().positive().max(1000).default(50),
    MONGODB_URI: z.string().min(1).optional(),
    MONGODB_DATABASE: z.string().min(1).default('adp_automation'),
    ADP_STORE_KEY: z.string().min(1).optional(),
    PUNCH_IN_TIME: time.default('09:00'),
    PUNCH_OUT_TIME: time.default('18:00'),
    PUNCH_IN_GRACE_BEFORE_MINUTES: z.coerce.number().int().min(0).max(180).default(15),
    PUNCH_IN_GRACE_AFTER_MINUTES: z.coerce.number().int().min(0).max(180).default(30),
    PUNCH_OUT_GRACE_BEFORE_MINUTES: z.coerce.number().int().min(0).max(180).default(15),
    PUNCH_OUT_GRACE_AFTER_MINUTES: z.coerce.number().int().min(0).max(180).default(30),
    PASSWORD_ROTATION_DAYS: z.string().default('10,20,30'),
    MAX_TRANSIENT_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
    MAX_AUTH_ATTEMPTS: z.coerce.number().int().min(1).max(2).default(2),
    AUTOMATION_ENABLED: booleanString,
    DRY_RUN: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    HEADLESS: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    PORTAL_SELECTORS_VERIFIED: booleanString,
    CALENDAR_SOURCE: z.enum(['manual', 'portal']).default('manual'),
    MANUAL_HOLIDAYS: z.string().default(''),
    MANUAL_LEAVE_DATES: z.string().default(''),
    DASHBOARD_HOST: z.literal('127.0.0.1').default('127.0.0.1'),
    DASHBOARD_PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
    DASHBOARD_AUTH_SECRET: z.string().min(16).optional(),
    GITHUB_REPOSITORY: z.string().optional(),
    GITHUB_RUN_ID: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const locationParts = [value.ATTENDANCE_LATITUDE, value.ATTENDANCE_LONGITUDE];
    if (
      locationParts.some((item) => item !== undefined) &&
      locationParts.some((item) => item === undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Both ATTENDANCE_LATITUDE and ATTENDANCE_LONGITUDE are required together',
      });
    }
  });

export type AppConfig = ReturnType<typeof loadConfig>;

function commaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = schema.parse(env);
  let securityAnswers: Record<string, string>;
  try {
    const raw: unknown = JSON.parse(parsed.ADP_SECURITY_ANSWERS_JSON);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not an object');
    securityAnswers = Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, String(value)]),
    );
  } catch {
    throw new Error('ADP_SECURITY_ANSWERS_JSON must be a JSON object');
  }

  const rotationDays = commaList(parsed.PASSWORD_ROTATION_DAYS).map(Number);
  if (rotationDays.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
    throw new Error('PASSWORD_ROTATION_DAYS must contain days from 1 to 31');
  }

  return {
    environment: parsed.NODE_ENV,
    timezone: parsed.APP_TIMEZONE,
    portal: {
      username: parsed.ADP_USERNAME,
      loginUrl: parsed.ADP_LOGIN_URL,
      origin: new URL(parsed.ADP_LOGIN_URL).origin,
      accountId: parsed.ADP_ACCOUNT_ID,
      securityAnswers,
      selectorsVerified: parsed.PORTAL_SELECTORS_VERIFIED,
    },
    attendanceLocation:
      parsed.ATTENDANCE_LATITUDE === undefined
        ? undefined
        : {
            latitude: parsed.ATTENDANCE_LATITUDE,
            longitude: parsed.ATTENDANCE_LONGITUDE!,
            accuracyMeters: parsed.ATTENDANCE_LOCATION_ACCURACY_METERS,
          },
    mongodb: {
      uri: parsed.MONGODB_URI,
      database: parsed.MONGODB_DATABASE,
    },
    storeKey: parsed.ADP_STORE_KEY,
    schedule: {
      punchIn: parsed.PUNCH_IN_TIME,
      punchOut: parsed.PUNCH_OUT_TIME,
      punchInBefore: parsed.PUNCH_IN_GRACE_BEFORE_MINUTES,
      punchInAfter: parsed.PUNCH_IN_GRACE_AFTER_MINUTES,
      punchOutBefore: parsed.PUNCH_OUT_GRACE_BEFORE_MINUTES,
      punchOutAfter: parsed.PUNCH_OUT_GRACE_AFTER_MINUTES,
      rotationDays,
    },
    retries: { transient: parsed.MAX_TRANSIENT_RETRIES, auth: parsed.MAX_AUTH_ATTEMPTS },
    automationEnabled: parsed.AUTOMATION_ENABLED,
    dryRun: parsed.DRY_RUN,
    headless: parsed.HEADLESS,
    calendar: {
      source: parsed.CALENDAR_SOURCE,
      holidays: commaList(parsed.MANUAL_HOLIDAYS),
      leaveDates: commaList(parsed.MANUAL_LEAVE_DATES),
    },
    dashboard: {
      host: parsed.DASHBOARD_HOST,
      port: parsed.DASHBOARD_PORT,
      authSecret: parsed.DASHBOARD_AUTH_SECRET,
    },
    github: {
      repository: parsed.GITHUB_REPOSITORY,
      runId: parsed.GITHUB_RUN_ID,
    },
  };
}

export function assertRuntimeConfig(config: AppConfig): asserts config is AppConfig & {
  portal: AppConfig['portal'] & { username: string; accountId: string };
  attendanceLocation: NonNullable<AppConfig['attendanceLocation']>;
  mongodb: AppConfig['mongodb'] & { uri: string };
  storeKey: string;
} {
  const missing = [
    ['ADP_USERNAME', config.portal.username],
    ['ADP_ACCOUNT_ID', config.portal.accountId],
    ['ATTENDANCE_LATITUDE/LONGITUDE', config.attendanceLocation],
    ['MONGODB_URI', config.mongodb.uri],
    ['ADP_STORE_KEY', config.storeKey],
  ].filter(([, value]) => !value);
  if (missing.length)
    throw new Error(`Missing runtime configuration: ${missing.map(([key]) => key).join(', ')}`);
}
