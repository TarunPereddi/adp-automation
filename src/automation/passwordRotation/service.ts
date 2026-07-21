import { randomUUID } from 'node:crypto';
import type { CredentialRepository } from '../../repositories/credentialRepository.js';
import type { LockRepository } from '../../repositories/lockRepository.js';
import type { RotationRepository } from '../../repositories/rotationRepository.js';
import { istParts } from '../../shared/time.js';
import type { PasswordPolicy } from './passwordPolicy.js';
import { generatePassword } from './passwordPolicy.js';

export interface PasswordPortal {
  verifyPassword(password: string): Promise<boolean>;
  rotationRequired(): boolean;
  discoverPasswordPolicy(): Promise<PasswordPolicy | null>;
  changePassword(oldPassword: string, newPassword: string): Promise<boolean>;
}

interface RotationDependencies {
  accountId: string;
  runKey: string;
  credentials: CredentialRepository;
  locks: LockRepository;
  rotations: RotationRepository;
  portal: PasswordPortal;
}

export class PasswordRotationService {
  constructor(private readonly dependencies: RotationDependencies) {}

  async run(now = new Date()): Promise<'COMPLETED' | 'SKIPPED' | 'MANUAL_INTERVENTION_REQUIRED'> {
    const dateKey = istParts(now).dateKey;
    const run = await this.dependencies.rotations.create(
      this.dependencies.accountId,
      dateKey,
      this.dependencies.runKey,
    );
    if (!run) return 'SKIPPED';
    const lockKey = `password-rotation:${this.dependencies.accountId}:${dateKey}`;
    const owner = randomUUID();
    if (!(await this.dependencies.locks.acquire(lockKey, owner, 30 * 60_000))) return 'SKIPPED';
    const transition = (state: Parameters<RotationRepository['transition']>[1], message?: string) =>
      this.dependencies.rotations.transition(run.idempotencyKey, state, message);
    try {
      await transition('LOCK_ACQUIRED');
      const metadata = await this.dependencies.credentials.metadata(this.dependencies.accountId);
      const candidates = await this.dependencies.credentials.getCandidates(
        this.dependencies.accountId,
      );
      if (!metadata || !candidates) throw new Error('Current credential is unavailable');
      await transition('CURRENT_PASSWORD_LOADED');
      if (!(await this.dependencies.portal.verifyPassword(candidates.current))) {
        await transition(
          'MANUAL_INTERVENTION_REQUIRED',
          'Current credential could not be verified',
        );
        await this.dependencies.credentials.setRotationStatus(
          this.dependencies.accountId,
          'MANUAL_INTERVENTION_REQUIRED',
        );
        return 'MANUAL_INTERVENTION_REQUIRED';
      }
      await transition('CURRENT_PASSWORD_VERIFIED');
      if (!this.dependencies.portal.rotationRequired()) {
        await transition('COMPLETED', 'Portal did not request a password change');
        return 'SKIPPED';
      }
      const policy = await this.dependencies.portal.discoverPasswordPolicy();
      if (!policy) {
        await transition('MANUAL_INTERVENTION_REQUIRED', 'Portal password policy is not verified');
        return 'MANUAL_INTERVENTION_REQUIRED';
      }
      const next = generatePassword(policy);
      await this.dependencies.credentials.stageRotation({
        accountId: this.dependencies.accountId,
        expectedVersion: metadata.credentialVersion,
        newPassword: next,
      });
      await transition('PASSWORD_CHANGE_STARTED');
      if (!(await this.dependencies.portal.changePassword(candidates.current, next))) {
        await transition('FAILED', 'Portal did not confirm the password change');
        return 'MANUAL_INTERVENTION_REQUIRED';
      }
      await transition('PORTAL_PASSWORD_CHANGED');
      if (!(await this.dependencies.portal.verifyPassword(next))) {
        await transition('ROLLBACK_REQUIRED', 'New password failed fresh-session verification');
        await this.dependencies.credentials.setRotationStatus(
          this.dependencies.accountId,
          'ROLLBACK_REQUIRED',
        );
        return 'MANUAL_INTERVENTION_REQUIRED';
      }
      await transition('NEW_PASSWORD_VERIFIED');
      await this.dependencies.credentials.commitRotation({
        accountId: this.dependencies.accountId,
        expectedVersion: metadata.credentialVersion,
        oldPassword: candidates.current,
        newPassword: next,
        status: 'DATABASE_UPDATED',
      });
      await transition('DATABASE_UPDATED');
      const stored = await this.dependencies.credentials.getCandidates(this.dependencies.accountId);
      if (!stored || stored.current !== next || stored.previous !== candidates.current) {
        await transition(
          'MANUAL_INTERVENTION_REQUIRED',
          'Post-write credential consistency check failed',
        );
        return 'MANUAL_INTERVENTION_REQUIRED';
      }
      await transition('CONSISTENCY_VERIFIED');
      await this.dependencies.credentials.setRotationStatus(
        this.dependencies.accountId,
        'COMPLETED',
      );
      await transition('COMPLETED');
      return 'COMPLETED';
    } catch (error) {
      await transition(
        'MANUAL_INTERVENTION_REQUIRED',
        error instanceof Error ? error.message : 'Unknown rotation failure',
      ).catch(() => undefined);
      await this.dependencies.credentials
        .setRotationStatus(this.dependencies.accountId, 'MANUAL_INTERVENTION_REQUIRED')
        .catch(() => undefined);
      return 'MANUAL_INTERVENTION_REQUIRED';
    } finally {
      await this.dependencies.locks.release(lockKey, owner).catch(() => undefined);
    }
  }
}
