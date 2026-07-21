import { LivePasswordPortal } from '../automation/passwordRotation/livePasswordPortal.js';
import { PasswordRotationService } from '../automation/passwordRotation/service.js';
import { assertRuntimeConfig, loadConfig } from '../config/config.js';
import { DatabaseClient } from '../database/client.js';
import { ensureIndexes } from '../database/indexes.js';
import { createRepositories } from '../database/repositories.js';
import { logger } from '../logging/logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  assertRuntimeConfig(config);
  if (!config.portal.selectorsVerified) {
    throw new Error('Password rotation selectors are not verified');
  }
  const database = new DatabaseClient(config.mongodb.uri, config.mongodb.database);
  const portal = new LivePasswordPortal(config);
  try {
    const db = await database.connect();
    await ensureIndexes(db);
    const repositories = createRepositories(db, config);
    const service = new PasswordRotationService({
      accountId: config.portal.accountId,
      runKey: config.github.runId ?? `local-${Date.now()}`,
      credentials: repositories.credentials,
      locks: repositories.locks,
      rotations: repositories.rotations,
      portal,
    });
    const result = await service.run();
    logger.info('Password rotation check completed', { result });
    if (result === 'MANUAL_INTERVENTION_REQUIRED') process.exitCode = 1;
  } finally {
    await portal.close();
    await database.close();
  }
}

main().catch((error) => {
  logger.error('Password rotation entrypoint failed', {
    error: error instanceof Error ? error.message : 'Unknown failure',
  });
  process.exitCode = 1;
});
