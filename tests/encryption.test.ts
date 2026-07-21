import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decodeKey, decrypt, encrypt } from '../src/security/encryption.js';

describe('credential encryption', () => {
  it('round-trips with a versioned AES-GCM payload', () => {
    const key = randomBytes(32).toString('base64');
    const encrypted = encrypt('secret-value', key);
    expect(encrypted.algorithm).toBe('aes-256-gcm');
    expect(encrypted.version).toBe(1);
    expect(encrypted.ciphertext).not.toContain('secret-value');
    expect(decrypt(encrypted, key)).toBe('secret-value');
  });

  it('rejects invalid keys and tampered ciphertext', () => {
    expect(() => decodeKey('bad')).toThrow(/32 bytes/);
    const key = randomBytes(32).toString('base64');
    const encrypted = encrypt('secret-value', key);
    encrypted.ciphertext = Buffer.from('tampered').toString('base64');
    expect(() => decrypt(encrypted, key)).toThrow();
  });
});
