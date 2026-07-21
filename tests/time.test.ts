import { describe, expect, it } from 'vitest';
import { isRotationDay, isWithinWindow, istParts } from '../src/shared/time.js';

describe('IST scheduling', () => {
  it('converts UTC to the correct IST day and minute', () => {
    const parts = istParts(new Date('2026-07-14T03:30:00.000Z'));
    expect(parts).toMatchObject({ dateKey: '2026-07-14', minutes: 540, weekday: 2 });
  });

  it('enforces grace windows', () => {
    expect(isWithinWindow(8 * 60 + 45, '09:00', 15, 30)).toBe(true);
    expect(isWithinWindow(9 * 60 + 31, '09:00', 15, 30)).toBe(false);
  });

  it('evaluates configured rotation days in IST', () => {
    expect(isRotationDay(new Date('2026-07-09T20:00:00Z'), [10, 20, 30])).toBe(true);
  });
});
