/**
 * groupSessionsByTime — bucket any list of items into time-labeled groups
 * matching the ChatGPT / Claude sidebar convention:
 *
 *   Today · Yesterday · Previous 7 Days · Previous 30 Days · Older
 *
 * Generic over T so it works for NativeSession, Task, CodeSessionRecord, etc.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeGroupKey =
  | 'today'
  | 'yesterday'
  | 'previous-7-days'
  | 'previous-30-days'
  | 'older';

export const TIME_GROUP_LABELS: Record<TimeGroupKey, string> = {
  'today': 'Today',
  'yesterday': 'Yesterday',
  'previous-7-days': 'Previous 7 Days',
  'previous-30-days': 'Previous 30 Days',
  'older': 'Older',
};

export const TIME_GROUP_ORDER: TimeGroupKey[] = [
  'today',
  'yesterday',
  'previous-7-days',
  'previous-30-days',
  'older',
];

export interface TimeGroup<T> {
  key: TimeGroupKey;
  label: string;
  items: T[];
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Classify a date into a TimeGroupKey relative to `now`.
 * All comparisons are calendar-day-based (midnight boundaries).
 */
export function classifyDate(date: Date, now: Date = new Date()): TimeGroupKey {
  const todayStart = startOfDay(now);
  const yesterdayStart = offsetDays(todayStart, -1);
  const sevenDaysAgo = offsetDays(todayStart, -7);
  const thirtyDaysAgo = offsetDays(todayStart, -30);

  const t = date.getTime();

  if (t >= todayStart.getTime()) return 'today';
  if (t >= yesterdayStart.getTime()) return 'yesterday';
  if (t >= sevenDaysAgo.getTime()) return 'previous-7-days';
  if (t >= thirtyDaysAgo.getTime()) return 'previous-30-days';
  return 'older';
}

/**
 * Group an array of items into time buckets.
 *
 * @param items    - Source array (already sorted descending by date recommended)
 * @param getDate  - Extractor that returns a Date, ISO string, or timestamp for each item
 * @param now      - Reference "now" (default: real current time; injectable for tests)
 * @returns        Array of TimeGroup<T> in display order, omitting empty groups.
 */
export function groupSessionsByTime<T>(
  items: T[],
  getDate: (item: T) => Date | string | number,
  now: Date = new Date(),
): TimeGroup<T>[] {
  const buckets: Record<TimeGroupKey, T[]> = {
    'today': [],
    'yesterday': [],
    'previous-7-days': [],
    'previous-30-days': [],
    'older': [],
  };

  for (const item of items) {
    const raw = getDate(item);
    const date = raw instanceof Date ? raw : new Date(raw);
    // Guard against invalid dates — fall through to older
    const key = isNaN(date.getTime()) ? 'older' : classifyDate(date, now);
    buckets[key].push(item);
  }

  return TIME_GROUP_ORDER
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({
      key,
      label: TIME_GROUP_LABELS[key],
      items: buckets[key],
    }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function offsetDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
