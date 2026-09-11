"use client";

/**
 * Tool run capsule (Phase 1A).
 *
 * Folded group of 2+ consecutive tool calls: "Running N steps ➜" while any
 * member is running, "Ran N steps ✓" when all settle. Chevron expands the
 * capsule inline to show individual receipt chips. Expansion is component
 * state — the fold never carries UI toggles (the row model's `expanded`
 * flag stays untouched).
 *
 * @module bot-chat/ToolRunCapsule
 */

import { useState } from "react";
import { CaretRight, Check, CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ToolRunGroup } from "./types";
import { ToolReceiptChip } from "./ToolReceiptChip";

export interface ToolRunCapsuleProps {
  run: ToolRunGroup;
  className?: string;
}

export function ToolRunCapsule({ run, className }: ToolRunCapsuleProps) {
  const [expanded, setExpanded] = useState(false);
  const n = run.calls.length;
  const running = run.status === "running";

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
        {running ? (
          <CircleNotch className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none text-[var(--text-tertiary)]" aria-hidden="true" />
        ) : (
          <Check className="size-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
        )}
        <span className="text-xs font-medium text-[var(--text-secondary,#a1a1aa)]">
          {running ? `Running ${n} steps` : `Ran ${n} steps`}
        </span>
        <span className="shrink-0 text-[var(--text-tertiary)]" aria-hidden="true">
          {running ? "➜" : "✓"}
        </span>
        <CaretRight
          className={cn("ml-auto size-4 shrink-0 text-[var(--text-tertiary)] transition-transform", expanded && "rotate-90")}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="space-y-1.5 px-3 pb-3">
          {run.calls.map((call) => (
            <ToolReceiptChip key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}
