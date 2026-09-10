"use client";

/**
 * Typing indicator (Phase 1A).
 *
 * Three-dot capsule shown after the working chamber, before the first answer
 * token. Dots scale on a sine-staggered loop; `motion-safe:` keeps the dots
 * static under `prefers-reduced-motion`. Tinted with the bot accent.
 *
 * @module bot-chat/TypingDots
 */

import { cn } from "@/lib/utils";

const DOT_CSS = `
@keyframes bot-chat-dot {
  0%, 100% { transform: scale(0.55); opacity: 0.45; }
  50% { transform: scale(1); opacity: 1; }
}
`;

const DOT_DELAYS = [0, 140, 280];

export interface TypingDotsProps {
  className?: string;
}

export function TypingDots({ className }: TypingDotsProps) {
  return (
    <div
      role="status"
      aria-label="Bot is typing"
      className={cn("flex w-full justify-start", className)}
    >
      <style>{DOT_CSS}</style>
      <div className="flex min-h-[44px] items-center gap-1.5 rounded-2xl rounded-bl-sm bg-[var(--accent-primary)] px-4 py-3">
        {DOT_DELAYS.map((delay) => (
          <span
            key={delay}
            className="size-1.5 rounded-full bg-white motion-safe:animate-[bot-chat-dot_1.2s_ease-in-out_infinite]"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
