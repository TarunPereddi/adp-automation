import { describe, expect, it } from 'vitest';
import { sanitize, sanitizeText } from '../src/security/sanitize.js';

describe('sanitization', () => {
  it('redacts nested sensitive fields', () => {
    expect(sanitize({ password: 'hidden', nested: { latitude: 17, message: 'safe' } })).toEqual({
      password: '[REDACTED]',
      nested: { latitude: '[REDACTED]', message: 'safe' },
    });
  });

  it('redacts URIs, bearer tokens, and emails from text', () => {
    const value = sanitizeText(
      'mongodb+srv://user:pass@cluster/db Bearer abc.def test@example.com',
    );
    expect(value).not.toContain('user:pass');
    expect(value).not.toContain('abc.def');
    expect(value).not.toContain('test@example.com');
  });
});
