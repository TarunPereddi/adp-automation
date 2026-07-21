import { randomInt } from 'node:crypto';

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  allowedSpecial: string;
  disallowedSubstrings: string[];
}

export function validatePassword(password: string, policy: PasswordPolicy): string[] {
  const errors: string[] = [];
  if (password.length < policy.minLength) errors.push('below minimum length');
  if (password.length > policy.maxLength) errors.push('above maximum length');
  if (policy.requireUppercase && !/[A-Z]/.test(password)) errors.push('missing uppercase');
  if (policy.requireLowercase && !/[a-z]/.test(password)) errors.push('missing lowercase');
  if (policy.requireNumber && !/\d/.test(password)) errors.push('missing number');
  if (
    policy.requireSpecial &&
    ![...password].some((char) => policy.allowedSpecial.includes(char))
  ) {
    errors.push('missing allowed special character');
  }
  for (const value of policy.disallowedSubstrings) {
    if (value && password.toLowerCase().includes(value.toLowerCase()))
      errors.push('contains disallowed account text');
  }
  return errors;
}

export function generatePassword(policy: PasswordPolicy): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const numbers = '23456789';
  const pools = [lower, upper, numbers, policy.allowedSpecial];
  const required = [
    policy.requireLowercase ? lower : '',
    policy.requireUppercase ? upper : '',
    policy.requireNumber ? numbers : '',
    policy.requireSpecial ? policy.allowedSpecial : '',
  ].filter(Boolean);
  const all = pools.join('');
  if (!all) throw new Error('Password policy has no allowed characters');
  const length = Math.min(Math.max(policy.minLength, 16), policy.maxLength);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const chars = required.map(pick);
    while (chars.length < length) chars.push(pick(all));
    shuffle(chars);
    const password = chars.join('');
    if (!validatePassword(password, policy).length) return password;
  }
  throw new Error('Could not generate a compliant password');
}

function pick(pool: string): string {
  return pool[randomInt(pool.length)]!;
}

function shuffle(values: string[]): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const replacement = randomInt(index + 1);
    [values[index], values[replacement]] = [values[replacement]!, values[index]!];
  }
}
