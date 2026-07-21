export interface LeaveRecord {
  startDate: string;
  endDate: string;
  type: string;
  status: string;
}

const blockingStatuses = new Set(['approved', 'submitted']);

export function findBlockingLeave(
  records: LeaveRecord[],
  dateKey: string,
): LeaveRecord | undefined {
  return records.find(
    (record) =>
      blockingStatuses.has(record.status.trim().toLowerCase()) &&
      record.startDate <= dateKey &&
      record.endDate >= dateKey,
  );
}
