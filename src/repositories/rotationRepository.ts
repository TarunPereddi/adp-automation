import type { Collection } from 'mongodb';
import type { RotationState } from '../types/domain.js';

export interface RotationRun {
  idempotencyKey: string;
  accountId: string;
  dateKey: string;
  state: RotationState;
  createdAt: Date;
  updatedAt: Date;
  history: Array<{ state: RotationState; at: Date; message?: string }>;
}

export class RotationRepository {
  constructor(private readonly collection: Collection<RotationRun>) {}

  async create(accountId: string, dateKey: string): Promise<RotationRun | null> {
    const now = new Date();
    const record: RotationRun = {
      idempotencyKey: `${accountId}:${dateKey}:PASSWORD_ROTATION`,
      accountId,
      dateKey,
      state: 'PLANNED',
      createdAt: now,
      updatedAt: now,
      history: [{ state: 'PLANNED', at: now }],
    };
    try {
      await this.collection.insertOne(record);
      return record;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 11000) return null;
      throw error;
    }
  }

  async transition(idempotencyKey: string, state: RotationState, message?: string): Promise<void> {
    const now = new Date();
    await this.collection.updateOne(
      { idempotencyKey },
      { $set: { state, updatedAt: now }, $push: { history: { state, at: now, message } } },
    );
  }
}
