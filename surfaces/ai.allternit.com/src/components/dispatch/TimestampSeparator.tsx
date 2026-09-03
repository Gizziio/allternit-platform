"use client";

import React, { useMemo } from 'react';

/**
 * Date divider rendered above the first block of session messages.
 * Shows the current date so a refreshed session transcript is anchored in
 * time the same way chat threads separate messages by day.
 */
export function TimestampSeparator(): React.ReactNode {
  const label = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  return (
    <div className="flex items-center gap-3 select-none" aria-hidden>
      <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      <span className="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-[var(--border-subtle)]" />
    </div>
  );
}
