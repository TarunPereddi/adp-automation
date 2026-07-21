import type { Db } from 'mongodb';
import { CalendarRepository } from '../repositories/calendarRepository.js';
import { CredentialRepository } from '../repositories/credentialRepository.js';
import { LockRepository } from '../repositories/lockRepository.js';
import { RotationRepository } from '../repositories/rotationRepository.js';
import { RunRepository } from '../repositories/runRepository.js';
import type { AppConfig } from '../config/config.js';
import type { AutomationRun, CredentialRecord } from '../types/domain.js';

export function createRepositories(db: Db, config: AppConfig & { storeKey: string }) {
  return {
    credentials: new CredentialRepository(
      db.collection<CredentialRecord>('credentials'),
      config.storeKey,
    ),
    locks: new LockRepository(db.collection('automation_locks')),
    runs: new RunRepository(db.collection<AutomationRun>('automation_runs')),
    calendars: new CalendarRepository(db.collection('calendar_checks')),
    rotations: new RotationRepository(db.collection('rotation_runs')),
  };
}
