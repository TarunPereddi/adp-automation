import type { Db } from 'mongodb';

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection('credentials').createIndex({ accountId: 1 }, { unique: true }),
    db.collection('automation_runs').createIndex({ idempotencyKey: 1 }, { unique: true }),
    db.collection('automation_runs').createIndex({ startedAt: -1 }),
    db.collection('automation_locks').createIndex({ lockKey: 1 }, { unique: true }),
    db.collection('automation_locks').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('rotation_runs').createIndex({ idempotencyKey: 1 }, { unique: true }),
    db.collection('system_events').createIndex({ createdAt: -1 }),
    db.collection('system_events').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
