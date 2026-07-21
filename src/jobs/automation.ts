import { ManualHolidayProvider, ManualLeaveProvider } from '../calendar/providers.js';
import { assertRuntimeConfig, loadConfig } from '../config/config.js';
import { AttendanceService } from '../automation/attendance/service.js';
import { DatabaseClient } from '../database/client.js';
import { ensureIndexes } from '../database/indexes.js';
import { createRepositories } from '../database/repositories.js';
import { logger } from '../logging/logger.js';
import type { AttendanceAction } from '../types/domain.js';

async function main(): Promise<void> {
  const config = loadConfig();
  assertRuntimeConfig(config);
  const action = parseAction(process.env.AUTOMATION_ACTION);
  const database = new DatabaseClient(config.mongodb.uri, config.mongodb.database);
  try {
    const db = await database.connect();
    await ensureIndexes(db);
    const repositories = createRepositories(db, config);
    const service = new AttendanceService({
      config,
      ...repositories,
      holidays: new ManualHolidayProvider(new Set(config.calendar.holidays)),
      leaves: new ManualLeaveProvider(new Set(config.calendar.leaveDates)),
    });
    await service.run(action);
  } finally {
    await database.close();
  }
}

function parseAction(value: string | undefined): AttendanceAction {
  if (value === 'PUNCH_IN' || value === 'PUNCH_OUT') return value;
  throw new Error('AUTOMATION_ACTION must be PUNCH_IN or PUNCH_OUT');
}

main().catch((error) => {
  logger.error('Automation entrypoint failed', {
    error: error instanceof Error ? error.message : 'Unknown failure',
  });
  process.exitCode = 1;
});
