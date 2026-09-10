"use client";

/**
 * Error row (Phase 1A).
 *
 * Inline orange banner for stream/turn errors. Register-1 copy: it says what
 * happened, no apology theater, no retry promises the component can't keep.
 *
 * @module bot-chat/ErrorRow
 */

import { Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface ErrorRowProps {
  text: string;
  className?: string;
}

export function ErrorRow({ text, className }: ErrorRowProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex w-full items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2.5",
        className,
      )}
    >
      <Warning className="mt-0.5 size-4 shrink-0 text-orange-400" aria-hidden="true" />
      <span className="text-xs leading-relaxed text-orange-300">{text}</span>
    </div>
  );
}
