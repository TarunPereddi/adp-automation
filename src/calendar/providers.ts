import type { CalendarResult } from '../types/domain.js';

export interface HolidayProvider {
  getHolidayStatus(dateKey: string): Promise<CalendarResult>;
}

export interface LeaveProvider {
  getLeaveStatus(dateKey: string): Promise<CalendarResult>;
}

function expiry(): Date {
  return new Date(Date.now() + 6 * 60 * 60 * 1000);
}

export class ManualHolidayProvider implements HolidayProvider {
  constructor(private readonly verifiedDates: Set<string>) {}

  async getHolidayStatus(dateKey: string): Promise<CalendarResult> {
    const holiday = this.verifiedDates.has(dateKey);
    return {
      status: holiday ? 'HOLIDAY' : 'UNKNOWN',
      verified: holiday,
      source: 'manual-config',
      checkedAt: new Date(),
      expiresAt: expiry(),
      reason: holiday
        ? 'Date exists in operator-verified holiday configuration'
        : 'No verified workday source',
    };
  }
}

export class ManualLeaveProvider implements LeaveProvider {
  constructor(private readonly verifiedDates: Set<string>) {}

  async getLeaveStatus(dateKey: string): Promise<CalendarResult> {
    const leave = this.verifiedDates.has(dateKey);
    return {
      status: leave ? 'LEAVE' : 'UNKNOWN',
      verified: leave,
      source: 'manual-config',
      checkedAt: new Date(),
      expiresAt: expiry(),
      reason: leave
        ? 'Date exists in operator-verified leave configuration'
        : 'No verified leave source',
    };
  }
}

export function combineCalendar(
  holiday: CalendarResult,
  leave: CalendarResult,
  portalWorkdayConfirmed: boolean,
): CalendarResult {
  if (holiday.status === 'HOLIDAY' && holiday.verified) return holiday;
  if (leave.status === 'LEAVE' && leave.verified) return leave;
  if (portalWorkdayConfirmed) {
    return {
      status: 'WORKDAY',
      verified: true,
      source: 'portal-attendance-state',
      checkedAt: new Date(),
      expiresAt: expiry(),
    };
  }
  return {
    status: 'UNKNOWN',
    verified: false,
    source: 'combined-calendar',
    checkedAt: new Date(),
    expiresAt: expiry(),
    reason: 'No authoritative source confirmed a workday',
  };
}
