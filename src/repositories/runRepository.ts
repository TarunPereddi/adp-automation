import type { Collection } from 'mongodb';
import type { AutomationRun } from '../types/domain.js';

export class RunRepository {
  constructor(private readonly collection: Collection<AutomationRun>) {}

  async start(run: AutomationRun): Promise<boolean> {
    try {
      await this.collection.insertOne(run);
      return true;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 11000) return false;
      throw error;
    }
  }

  async complete(
    runId: string,
    update: Pick<AutomationRun, 'status'> &
      Partial<
        Omit<AutomationRun, 'runId' | 'idempotencyKey' | 'accountId' | 'action' | 'startedAt'>
      >,
  ): Promise<void> {
    await this.collection.updateOne(
      { runId },
      { $set: { ...update, completedAt: update.completedAt ?? new Date() } },
    );
  }

  async recent(limit = 50): Promise<AutomationRun[]> {
    return this.collection.find().sort({ startedAt: -1 }).limit(limit).toArray();
  }

  async successful(idempotencyKey: string): Promise<boolean> {
    return Boolean(await this.collection.findOne({ idempotencyKey, status: 'SUCCEEDED' }));
  }
}
