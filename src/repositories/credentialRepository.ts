import type { Collection } from 'mongodb';
import { decrypt, encrypt } from '../security/encryption.js';
import type { CredentialRecord, RotationState } from '../types/domain.js';

export class CredentialRepository {
  constructor(
    private readonly collection: Collection<CredentialRecord>,
    private readonly encodedKey: string,
  ) {}

  async metadata(
    accountId: string,
  ): Promise<Omit<
    CredentialRecord,
    'currentPasswordEncrypted' | 'previousPasswordEncrypted' | 'pendingPasswordEncrypted'
  > | null> {
    const record = await this.collection.findOne(
      { accountId },
      {
        projection: {
          currentPasswordEncrypted: 0,
          previousPasswordEncrypted: 0,
          pendingPasswordEncrypted: 0,
        },
      },
    );
    return record;
  }

  async getCurrentPassword(accountId: string): Promise<string | null> {
    const record = await this.collection.findOne({ accountId });
    return record ? decrypt(record.currentPasswordEncrypted, this.encodedKey) : null;
  }

  async getCandidates(
    accountId: string,
  ): Promise<{ current: string; previous?: string; pending?: string } | null> {
    const record = await this.collection.findOne({ accountId });
    if (!record) return null;
    return {
      current: decrypt(record.currentPasswordEncrypted, this.encodedKey),
      previous: record.previousPasswordEncrypted
        ? decrypt(record.previousPasswordEncrypted, this.encodedKey)
        : undefined,
      pending: record.pendingPasswordEncrypted
        ? decrypt(record.pendingPasswordEncrypted, this.encodedKey)
        : undefined,
    };
  }

  async stageRotation(options: {
    accountId: string;
    expectedVersion: number;
    newPassword: string;
  }): Promise<void> {
    const result = await this.collection.updateOne(
      { accountId: options.accountId, credentialVersion: options.expectedVersion },
      {
        $set: {
          pendingPasswordEncrypted: encrypt(options.newPassword, this.encodedKey),
          rotationStatus: 'PASSWORD_CHANGE_STARTED',
          updatedAt: new Date(),
        },
      },
    );
    if (result.modifiedCount !== 1) {
      throw new Error('Credential version conflict; pending rotation was not staged');
    }
  }

  async seed(accountId: string, password: string): Promise<void> {
    const now = new Date();
    const result = await this.collection.updateOne(
      { accountId },
      {
        $setOnInsert: {
          accountId,
          currentPasswordEncrypted: encrypt(password, this.encodedKey),
          credentialVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    if (!result.upsertedCount)
      throw new Error('Credential already exists; refusing to overwrite it');
  }

  async replaceCurrent(accountId: string, password: string): Promise<void> {
    const record = await this.collection.findOne({ accountId });
    if (!record) throw new Error('Credential does not exist; seed it before replacement');
    const now = new Date();
    const result = await this.collection.updateOne(
      { accountId, credentialVersion: record.credentialVersion },
      {
        $set: {
          currentPasswordEncrypted: encrypt(password, this.encodedKey),
          previousPasswordEncrypted: record.currentPasswordEncrypted,
          credentialVersion: record.credentialVersion + 1,
          rotationStatus: 'COMPLETED',
          rotatedAt: now,
          updatedAt: now,
        },
        $unset: { pendingPasswordEncrypted: '' },
      },
    );
    if (result.modifiedCount !== 1) {
      throw new Error('Credential version conflict; replacement was not written');
    }
  }

  async commitRotation(options: {
    accountId: string;
    expectedVersion: number;
    oldPassword: string;
    newPassword: string;
    status: RotationState;
  }): Promise<void> {
    const now = new Date();
    const result = await this.collection.updateOne(
      { accountId: options.accountId, credentialVersion: options.expectedVersion },
      {
        $set: {
          currentPasswordEncrypted: encrypt(options.newPassword, this.encodedKey),
          previousPasswordEncrypted: encrypt(options.oldPassword, this.encodedKey),
          credentialVersion: options.expectedVersion + 1,
          rotationStatus: options.status,
          rotatedAt: now,
          updatedAt: now,
        },
        $unset: { pendingPasswordEncrypted: '' },
      },
    );
    if (result.modifiedCount !== 1) {
      throw new Error('Credential version conflict; rotation state was not written');
    }
  }

  async setRotationStatus(accountId: string, status: RotationState): Promise<void> {
    await this.collection.updateOne(
      { accountId },
      { $set: { rotationStatus: status, updatedAt: new Date() } },
    );
  }
}
