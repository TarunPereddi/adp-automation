import type { Collection } from 'mongodb';

interface LockRecord {
  lockKey: string;
  owner: string;
  acquiredAt: Date;
  expiresAt: Date;
}

export class LockRepository {
  constructor(private readonly collection: Collection<LockRecord>) {}

  async acquire(lockKey: string, owner: string, ttlMs: number): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    try {
      const result = await this.collection.findOneAndUpdate(
        {
          lockKey,
          $or: [{ expiresAt: { $lte: now } }, { owner }],
        },
        { $set: { owner, acquiredAt: now, expiresAt }, $setOnInsert: { lockKey } },
        { upsert: true, returnDocument: 'after', includeResultMetadata: false },
      );
      return result?.owner === owner;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 11000) return false;
      throw error;
    }
  }

  async release(lockKey: string, owner: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ lockKey, owner });
    return result.deletedCount === 1;
  }
}
