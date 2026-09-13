import React, { useId } from "react";
import { cn } from "@/lib/utils";

interface GaugeCardProps {
  label: string;
  used: number;
  limit: number;
  /** e.g. "Resets Sep 1" — shown under the label. */
  resetHint?: string;
  className?: string;
}

const SIZE = 96;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;

/**
 * Radial usage gauge (hand-rolled SVG donut — no chart dependency needed for
 * a single series). Values are clamped; a used > limit ring turns error-red.
 */
export function GaugeCard({
  label,
  used,
  limit,
  resetHint,
  className,
}: GaugeCardProps): React.ReactNode {
  const gradientId = useId();
  const safeLimit = limit > 0 ? limit : 1;
  const ratio = Math.max(0, Math.min(used / safeLimit, 1));
  const over = used > limit;
  const circumference = 2 * Math.PI * RADIUS;
  const filled = ratio * circumference;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4",
        className
      )}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="-rotate-90"
        role="img"
        aria-label={`${label}: ${used} of ${limit} used`}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-[var(--bg-primary)]"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          stroke={over ? "var(--status-error)" : `url(#${gradientId})`}
          className="transition-[stroke-dasharray] duration-500"
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary)" />
            <stop offset="100%" stopColor="var(--accent-highlight)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="min-w-0">
        <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
          {label}
        </div>
        <div className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">
          {used.toLocaleString()}
          <span className="text-[13px] font-normal text-[var(--text-tertiary)]">
            {" "}
            / {limit.toLocaleString()}
          </span>
        </div>
        {resetHint && (
          <div className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{resetHint}</div>
        )}
      </div>
    </div>
  );
}
