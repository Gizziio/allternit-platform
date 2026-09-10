"use client";

/**
 * Waiting-on-you pill (Phase 1B).
 *
 * Roster-row surface for a bot with a pending approval: accent-tinted
 * capsule, raised-hand icon, "Waiting on you". Parent handles navigation;
 * this is the button only.
 *
 * @module bot-chat/WaitingOnYouPill
 */

import { Hand } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface WaitingOnYouPillProps {
  accentColor?: string;
  onClick?: () => void;
  className?: string;
}

export function WaitingOnYouPill({
  accentColor = "var(--accent-primary)",
  onClick,
  className,
}: WaitingOnYouPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
        color: accentColor,
      }}
    >
      <Hand className="size-3.5" aria-hidden="true" />
      Waiting on you
    </button>
  );
}
