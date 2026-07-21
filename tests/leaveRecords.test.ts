import { describe, expect, it } from 'vitest';
import { findBlockingLeave } from '../src/calendar/leaveRecords.js';

describe('leave records', () => {
  const records = [
    {
      startDate: '2026-04-27',
      endDate: '2026-04-29',
      type: 'Casual leave',
      status: 'Approved',
    },
    {
      startDate: '2026-07-22',
      endDate: '2026-07-22',
      type: 'Sick leave',
      status: 'Submitted',
    },
    {
      startDate: '2026-06-18',
      endDate: '2026-06-18',
      type: 'Sick leave',
      status: 'Withdrawn',
    },
  ];

  it('blocks every date in an approved leave range', () => {
    expect(findBlockingLeave(records, '2026-04-28')?.status).toBe('Approved');
  });

  it('blocks submitted leave', () => {
    expect(findBlockingLeave(records, '2026-07-22')?.status).toBe('Submitted');
  });

  it('does not block withdrawn leave', () => {
    expect(findBlockingLeave(records, '2026-06-18')).toBeUndefined();
  });
});
