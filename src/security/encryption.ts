import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { EncryptedValue } from '../types/domain.js';

export function decodeKey(encoded: string): Buffer {
  const value = encoded.trim();
  const key = /^[a-f\d]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('ADP_STORE_KEY must decode to exactly 32 bytes');
  return key;
}

export function encrypt(plaintext: string, encodedKey: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', decodeKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decrypt(value: EncryptedValue, encodedKey: string): string {
  if (value.version !== 1 || value.algorithm !== 'aes-256-gcm') {
    throw new Error('Unsupported encrypted payload');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    decodeKey(encodedKey),
    Buffer.from(value.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(value.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
