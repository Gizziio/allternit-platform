"use client";

/**
 * Working chamber (Phase 1A).
 *
 * Expandable panel showing the bot's thinking buffer (capped at 2000 chars by
 * the fold). Collapses automatically when answer tokens start (rung moves
 * past "thinking"); tapping the header pins it open against that collapse.
 *
 * @module bot-chat/WorkingChamber
 */

import { useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface WorkingChamberProps {
  /** Thinking buffer text (already capped by the fold). */
  thinking: string;
  /**
   * Rung of the active turn: "thinking" keeps the chamber open; anything
   * else (answer tokens flowing) collapses it unless the user pinned it.
   */
  rung: "thinking" | "typing" | "streaming" | null;
  className?: string;
}

export function WorkingChamber({ thinking, rung, className }: WorkingChamberProps) {
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const expanded = pinnedOpen || rung === "thinking";
  const isThinking = rung === "thinking";

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border border-[var(--bg-elevated)] bg-[var(--bg-elevated)]/40",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setPinnedOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left"
      >
        <CaretRight
          className={cn("size-4 shrink-0 text-[var(--text-tertiary)] transition-transform", expanded && "rotate-90")}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-[var(--text-tertiary)]">
          {isThinking ? "Working" : "Worked"}
        </span>
        <span className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]/70">
          {thinking.length > 0 ? `${thinking.length} chars` : ""}
        </span>
      </button>
      {expanded && (
        <div className="max-h-40 overflow-y-auto px-3 pb-3">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--text-tertiary)]">
            {thinking || "Thinking…"}
          </pre>
        </div>
      )}
    </div>
  );
}
