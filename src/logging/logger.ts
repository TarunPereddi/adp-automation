import { sanitize } from '../security/sanitize.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

function write(level: Level, message: string, context?: Record<string, unknown>): void {
  const event = sanitize({ timestamp: new Date().toISOString(), level, message, ...context });
  const line = JSON.stringify(event);
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};
