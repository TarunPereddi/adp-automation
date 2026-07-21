import { assertRuntimeConfig, loadConfig } from '../config/config.js';
import { DatabaseClient } from '../database/client.js';
import { createRepositories } from '../database/repositories.js';
import { logger } from '../logging/logger.js';
import { createDashboard } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();
  assertRuntimeConfig(config);
  const database = new DatabaseClient(config.mongodb.uri, config.mongodb.database);
  const db = await database.connect();
  const repositories = createRepositories(db, config);
  const app = createDashboard({ config, ...repositories, ping: () => database.ping() });
  const server = app.listen(config.dashboard.port, config.dashboard.host, () => {
    logger.info('Local dashboard started', {
      host: config.dashboard.host,
      port: config.dashboard.port,
    });
  });
  const shutdown = () => server.close(() => void database.close());
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error('Dashboard failed', {
    error: error instanceof Error ? error.message : 'Unknown failure',
  });
  process.exitCode = 1;
});
