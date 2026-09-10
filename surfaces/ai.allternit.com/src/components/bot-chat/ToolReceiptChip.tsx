"use client";

/**
 * Tool receipt chip (Phase 1A).
 *
 * Quiet capsule for one tool call: tool name, mono duration, and a status
 * badge (running / ✓ / ✗). Tapping expands inline mono blocks with the
 * input and output summaries.
 *
 * @module bot-chat/ToolReceiptChip
 */

import { useState } from "react";
import { Check, CircleNotch, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ToolCallRecord } from "./types";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export interface ToolReceiptChipProps {
  call: ToolCallRecord;
  className?: string;
}

export function ToolReceiptChip({ call, className }: ToolReceiptChipProps) {
  const [expanded, setExpanded] = useState(false);

  const badge =
    call.status === "running" ? (
      <CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" aria-label="Running" />
    ) : call.status === "success" ? (
      <Check className="size-3.5 text-emerald-400" aria-label="Succeeded" />
    ) : (
      <X className="size-3.5 text-orange-400" aria-label="Failed" />
    );

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border border-[var(--bg-elevated)] bg-[var(--bg-elevated)]/30",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="truncate text-xs font-medium text-[var(--text-secondary,#a1a1aa)]">
          {call.tool}
        </span>
        {typeof call.durationMs === "number" && (
          <span className="shrink-0 font-mono text-[10px] text-[var(--text-tertiary)]">
            • {formatDuration(call.durationMs)}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center">{badge}</span>
      </button>
      {expanded && (
        <div className="space-y-2 px-3 pb-3">
          <div>
            <div className="mb-0.5 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
              Input
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-[var(--bg-elevated)] p-2 font-mono text-[11px] text-[var(--text-tertiary)]">
              {call.inputSummary}
            </pre>
          </div>
          {(call.outputSummary || call.error) && (
            <div>
              <div className="mb-0.5 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                {call.status === "error" ? "Error" : "Output"}
              </div>
              <pre
                className={cn(
                  "overflow-x-auto whitespace-pre-wrap break-words rounded bg-[var(--bg-elevated)] p-2 font-mono text-[11px]",
                  call.status === "error" ? "text-orange-400" : "text-[var(--text-tertiary)]",
                )}
              >
                {call.error ?? call.outputSummary}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
