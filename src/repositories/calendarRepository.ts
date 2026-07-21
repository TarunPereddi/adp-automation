import type { Collection } from 'mongodb';
import type { CalendarResult } from '../types/domain.js';

interface CalendarRecord extends CalendarResult {
  accountId: string;
  dateKey: string;
}

export class CalendarRepository {
  constructor(private readonly collection: Collection<CalendarRecord>) {}

  async get(accountId: string, dateKey: string): Promise<CalendarResult | null> {
    const record = await this.collection.findOne({
      accountId,
      dateKey,
      expiresAt: { $gt: new Date() },
    });
    if (!record) return null;
    return {
      status: record.status,
      verified: record.verified,
      source: record.source,
      checkedAt: record.checkedAt,
      expiresAt: record.expiresAt,
      reason: record.reason,
    };
  }

  async set(accountId: string, dateKey: string, result: CalendarResult): Promise<void> {
    await this.collection.updateOne(
      { accountId, dateKey },
      { $set: { accountId, dateKey, ...result } },
      { upsert: true },
    );
  }
}
