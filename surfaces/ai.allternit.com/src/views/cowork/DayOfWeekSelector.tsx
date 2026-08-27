import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Day-of-week selector that supplements a cron expression.
 *
 * `value` is an array of weekday numbers where 0 = Sunday ... 6 = Saturday.
 * The parent is responsible for syncing this with the cron day-of-week field.
 */

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_TITLES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface DayOfWeekSelectorProps {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}

export function DayOfWeekSelector({
  value,
  onChange,
  disabled,
}: DayOfWeekSelectorProps): React.ReactNode {
  const selected = new Set(value);

  const toggle = (day: number) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  return (
    <div className="flex items-center gap-2">
      {DAY_LABELS.map((label, day) => {
        const isSelected = selected.has(day);
        return (
          <button
            key={day}
            type="button"
            disabled={disabled}
            title={DAY_TITLES[day]}
            onClick={() => toggle(day)}
            className={cn(
              'size-9 rounded-lg border border-solid text-[13px] font-semibold transition-colors',
              isSelected
                ? 'bg-[var(--text-primary)] text-[var(--bg-elevated)] border-[var(--text-primary)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Parse the day-of-week field of a cron expression into selected day numbers.
 * Supports `*`, individual numbers, and ranges like `1-5`.
 */
export function parseCronDays(expression: string): number[] {
  const parts = expression.trim().split(/\s+/);
  const field = parts.length >= 5 ? parts[4] : '*';

  if (field === '*' || field === '?') {
    return field === '*' ? [0, 1, 2, 3, 4, 5, 6] : [];
  }

  const days = new Set<number>();
  for (const chunk of field.split(',')) {
    if (chunk.includes('-')) {
      const [start, end] = chunk.split('-');
      if (start && end) {
        const s = parseInt(start, 10);
        const e = parseInt(end, 10);
        if (!Number.isNaN(s) && !Number.isNaN(e)) {
          for (let d = Math.max(0, s); d <= Math.min(6, e); d += 1) {
            days.add(d);
          }
        }
      }
    } else {
      const d = parseInt(chunk, 10);
      if (!Number.isNaN(d) && d >= 0 && d <= 6) {
        days.add(d);
      }
    }
  }

  return Array.from(days).sort((a, b) => a - b);
}

/**
 * Rewrite the day-of-week field of a cron expression with the selected days.
 */
export function applyCronDays(expression: string, days: number[]): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) {
    // Fallback to a daily expression at 09:00 if malformed.
    parts.length = 5;
    parts[0] = parts[0] || '0';
    parts[1] = parts[1] || '9';
    parts[2] = parts[2] || '*';
    parts[3] = parts[3] || '*';
  }

  if (days.length === 0) {
    parts[4] = '?';
  } else if (days.length === 7) {
    parts[4] = '*';
  } else {
    parts[4] = days.join(',');
  }

  return parts.join(' ');
}
