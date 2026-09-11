"use client";

/**
 * Settled message bubble (Phase 1A).
 *
 * Tailed, edge-aligned: bot messages get the accent fill and left edge, user
 * messages get the neutral elevated fill and right edge. Bot text renders
 * through the shared markdown component; user text is plain — a message
 * about `**` must show the asterisks.
 *
 * @module bot-chat/SettledBubble
 */

import { Markdown } from "@/components/ai-elements/markdown";
import { cn } from "@/lib/utils";

export interface SettledBubbleProps {
  role: "user" | "bot";
  text: string;
  className?: string;
}

export function SettledBubble({ role, text, className }: SettledBubbleProps) {
  const isBot = role === "bot";
  return (
    <div className={cn("flex w-full", isBot ? "justify-start" : "justify-end", className)}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isBot
            ? "rounded-bl-sm bg-[var(--accent-primary)] text-white"
            : "rounded-br-sm bg-[var(--bg-elevated)] text-[var(--text-primary,#e5e5e5)]",
        )}
      >
        {isBot ? (
          <Markdown>{text}</Markdown>
        ) : (
          <span className="whitespace-pre-wrap break-words">{text}</span>
        )}
      </div>
    </div>
  );
}
