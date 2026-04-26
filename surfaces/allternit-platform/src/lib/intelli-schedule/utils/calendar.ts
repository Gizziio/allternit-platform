export interface WorkCalendar {
  isWorkDay(date: Date): boolean;
  getWorkDayStart(date: Date): Date;
  getWorkDayEnd(date: Date): Date;
}

export function createCalendar(config: {
  workDays?: number[];
  holidays?: Date[];
  workHours?: { start: number; end: number };
}): WorkCalendar {
  const workDays = config.workDays ?? [1, 2, 3, 4, 5]; // Mon-Fri
  const holidays = new Set((config.holidays ?? []).map((d) => d.toISOString().split('T')[0]));
  const workHours = config.workHours ?? { start: 9, end: 17 };

  return {
    isWorkDay(date: Date): boolean {
      const dayStr = date.toISOString().split('T')[0];
      if (holidays.has(dayStr)) return false;
      return workDays.includes(date.getDay());
    },
    getWorkDayStart(date: Date): Date {
      const d = new Date(date);
      d.setHours(workHours.start, 0, 0, 0);
      return d;
    },
    getWorkDayEnd(date: Date): Date {
      const d = new Date(date);
      d.setHours(workHours.end, 0, 0, 0);
      return d;
    },
  };
}
