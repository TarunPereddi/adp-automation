import { assertRuntimeConfig, loadConfig } from '../config/config.js';
import { DatabaseClient } from '../database/client.js';
import { ensureIndexes } from '../database/indexes.js';
import { logger } from '../logging/logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  assertRuntimeConfig(config);
  const database = new DatabaseClient(config.mongodb.uri, config.mongodb.database);
  try {
    const db = await database.connect();
    await ensureIndexes(db);
    logger.info('MongoDB collections and indexes are ready');
  } finally {
    await database.close();
  }
}

main().catch((error) => {
  logger.error('Database initialization failed', {
    error: error instanceof Error ? error.message : 'Unknown failure',
  });
  process.exitCode = 1;
});
