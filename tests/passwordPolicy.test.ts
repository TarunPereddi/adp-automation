import { describe, expect, it } from 'vitest';
import {
  generatePassword,
  validatePassword,
  type PasswordPolicy,
} from '../src/automation/passwordRotation/passwordPolicy.js';

const policy: PasswordPolicy = {
  minLength: 12,
  maxLength: 20,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  allowedSpecial: '!@#$%',
  disallowedSubstrings: ['tarun'],
};

describe('password policy', () => {
  it('generates compliant cryptographically random candidates', () => {
    const values = new Set(Array.from({ length: 20 }, () => generatePassword(policy)));
    expect(values.size).toBe(20);
    for (const value of values) expect(validatePassword(value, policy)).toEqual([]);
  });
});
