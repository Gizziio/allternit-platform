"use client";

/**
 * Live activity line (bot streaming UX).
 *
 * Transient row shown directly under the in-flight message while a bot turn
 * runs: the most recent tool call with a brief input summary and a running /
 * done marker. It lives only on the active turn — never in the settled rows —
 * so it disappears when the turn finishes. Visual idiom follows the watch
 * strip (quiet secondary text) and the tool receipt chip (same border/fill),
 * but it is not interactive.
 *
 * @module bot-chat/ActivityLine
 */

import { Check, CircleNotch, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ToolActivity } from "./types";

const SUMMARY_MAX = 80;

function clipSummary(summary: string): string {
  const oneLine = summary.replace(/\s+/g, " ").trim();
  return oneLine.length > SUMMARY_MAX ? `${oneLine.slice(0, SUMMARY_MAX)}…` : oneLine;
}

export interface ActivityLineProps {
  activity: ToolActivity;
  className?: string;
}

export function ActivityLine({ activity, className }: ActivityLineProps) {
  const badge =
    activity.status === "running" ? (
      <CircleNotch className="size-3 animate-spin motion-reduce:animate-none" aria-label="Running" />
    ) : activity.status === "success" ? (
      <Check className="size-3 text-emerald-400" aria-label="Succeeded" />
    ) : (
      <X className="size-3 text-orange-400" aria-label="Failed" />
    );

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1.5 overflow-hidden rounded-lg border border-[var(--bg-elevated)] bg-[var(--bg-elevated)]/30 px-3 py-1.5",
        className,
      )}
    >
      {badge}
      <span className="shrink-0 text-[11px] font-medium text-[var(--text-secondary)]">
        {activity.tool}
      </span>
      <span className="truncate text-[11px] text-[var(--text-tertiary)]">
        {clipSummary(activity.inputSummary)}
      </span>
    </div>
  );
}
