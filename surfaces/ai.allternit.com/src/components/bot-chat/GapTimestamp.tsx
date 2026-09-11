"use client";

/**
 * Gap timestamp row (Phase 1A).
 *
 * Centered tertiary divider between transcript sections separated by ≥30
 * minutes, e.g. "Yesterday 2:30 PM". `now` is injectable for tests.
 *
 * @module bot-chat/GapTimestamp
 */

import { formatGap } from "./transcript";

export interface GapTimestampProps {
  from: number;
  to: number;
  now?: number;
  className?: string;
}

export function GapTimestamp({ from, to, now, className }: GapTimestampProps) {
  return (
    <div className={className} role="separator">
      <span className="block w-full py-2 text-center text-[11px] text-[var(--text-tertiary)]">
        {formatGap(from, to, now)}
      </span>
    </div>
  );
}
