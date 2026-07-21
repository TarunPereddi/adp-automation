import { createHash, timingSafeEqual } from 'node:crypto';
import { assertRuntimeConfig, loadConfig } from '../config/config.js';
import { DatabaseClient } from '../database/client.js';
import { createRepositories } from '../database/repositories.js';

async function main(): Promise<void> {
  const config = loadConfig();
  assertRuntimeConfig(config);
  const command = process.argv[2] ?? 'status';
  const database = new DatabaseClient(config.mongodb.uri, config.mongodb.database);
  try {
    const db = await database.connect();
    const { credentials } = createRepositories(db, config);
    if (command === 'seed') {
      if (process.env.CI) throw new Error('Credential seeding is disabled in CI');
      const password = await readHidden('Enter current portal password: ');
      if (!password) throw new Error('Password cannot be empty');
      await credentials.seed(config.portal.accountId, password);
      await db.collection('system_events').insertOne({
        category: 'CREDENTIAL_SEEDED',
        accountId: config.portal.accountId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
      process.stdout.write('Encrypted credential created; secret was not displayed.\n');
      return;
    }
    const metadata = await credentials.metadata(config.portal.accountId);
    if (!metadata) throw new Error('Credential does not exist');
    if (command === 'status') {
      process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
      return;
    }
    if (command === 'verify') {
      const password = await credentials.getCurrentPassword(config.portal.accountId);
      if (!password) throw new Error('Credential cannot be decrypted');
      process.stdout.write('Credential decrypted successfully; secret was not displayed.\n');
      return;
    }
    if (process.env.CI) throw new Error('Secret access commands are disabled in CI');
    const password = await credentials.getCurrentPassword(config.portal.accountId);
    if (!password) throw new Error('Credential cannot be decrypted');
    if (command === 'copy') {
      const { default: clipboard } = await import('clipboardy');
      await auditAccess(db, config.portal.accountId, 'CREDENTIAL_COPIED');
      await clipboard.write(password);
      const seconds = Number(process.env.CLIPBOARD_CLEAR_SECONDS ?? '30');
      process.stdout.write(`Credential copied to clipboard; clearing in ${seconds} seconds.\n`);
      setTimeout(async () => {
        const current = await clipboard.read();
        if (safeEqual(current, password)) await clipboard.write('');
        process.stdout.write('Clipboard cleared.\n');
      }, seconds * 1000);
      return;
    }
    if (command === 'show') {
      if (!process.argv.includes('--confirm'))
        throw new Error('Use credential:show -- --confirm to explicitly display the secret');
      await auditAccess(db, config.portal.accountId, 'CREDENTIAL_DISPLAYED');
      process.stdout.write(`${password}\n`);
      return;
    }
    throw new Error(`Unknown credential command: ${command}`);
  } finally {
    await database.close();
  }
}

async function auditAccess(
  db: Awaited<ReturnType<DatabaseClient['connect']>>,
  accountId: string,
  category: string,
): Promise<void> {
  await db.collection('system_events').insertOne({
    category,
    accountId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  });
}

async function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Credential seeding requires an interactive terminal');
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (key: string) => {
      if (key === '\u0003') {
        cleanup();
        reject(new Error('Cancelled'));
      } else if (key === '\r' || key === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolve(value);
      } else if (key === '\u007f' || key === '\b') {
        value = value.slice(0, -1);
      } else if (/^[\x20-\x7E]$/.test(key)) {
        value += key;
      }
    };
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on('data', onData);
  });
}

function safeEqual(left: string, right: string): boolean {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Credential command failed'}\n`);
  process.exitCode = 1;
});
