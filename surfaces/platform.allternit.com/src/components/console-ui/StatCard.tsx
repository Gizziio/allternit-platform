import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { TrendingUpIcon, TrendingDownIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { ConsoleNavIcon } from "./navConfig";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: ConsoleNavIcon;
  /** Signed change, e.g. 12.4 or -3.1. Rendered as a trend arrow. */
  trend?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  className,
}: StatCardProps): React.ReactNode {
  const trendPositive = trend !== undefined && trend >= 0;
  return (
    <div
      className={cn(
        "rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
          {label}
        </span>
        {icon && (
          <HugeiconsIcon icon={icon} size={16} className="text-[var(--text-tertiary)]" />
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">
          {value}
        </span>
        {trend !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[12px] font-medium",
              trendPositive ? "text-[var(--status-success)]" : "text-[var(--status-error)]"
            )}
          >
            <HugeiconsIcon
              icon={trendPositive ? TrendingUpIcon : TrendingDownIcon}
              size={12}
            />
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {hint && <p className="m-0 mt-1 text-[12px] text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  );
}
