import type { AttendanceAction } from '../types/domain.js';

export interface IstParts {
  dateKey: string;
  weekday: number;
  minutes: number;
}

export function istParts(date: Date): IstParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return {
    dateKey: `${year}-${month}-${day}`,
    weekday: weekdays[get('weekday')] ?? -1,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  if (hour === undefined || minute === undefined) throw new Error(`Invalid time: ${value}`);
  return hour * 60 + minute;
}

export function isWithinWindow(
  nowMinutes: number,
  target: string,
  beforeMinutes: number,
  afterMinutes: number,
): boolean {
  const targetMinutes = timeToMinutes(target);
  return nowMinutes >= targetMinutes - beforeMinutes && nowMinutes <= targetMinutes + afterMinutes;
}

export function actionWindow(
  action: AttendanceAction,
  schedule: {
    punchIn: string;
    punchOut: string;
    punchInBefore: number;
    punchInAfter: number;
    punchOutBefore: number;
    punchOutAfter: number;
  },
): { target: string; before: number; after: number } {
  return action === 'PUNCH_IN'
    ? { target: schedule.punchIn, before: schedule.punchInBefore, after: schedule.punchInAfter }
    : { target: schedule.punchOut, before: schedule.punchOutBefore, after: schedule.punchOutAfter };
}
