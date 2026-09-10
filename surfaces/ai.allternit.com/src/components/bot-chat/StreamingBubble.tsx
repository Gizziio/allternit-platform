"use client";

/**
 * Streaming bot bubble (Phase 1A).
 *
 * Same shape and fill as the settled bot message; while `status` is
 * "streaming" a solid CSS caret sits at the token frontier (no spinner). On
 * settle the caret disappears and the bubble reads as settled — the atomic
 * swap is just this component re-rendering without the caret, keyed on char
 * count by the parent so the scroll follow stays unanimated.
 *
 * @module bot-chat/StreamingBubble
 */

import { Markdown } from "@/components/ai-elements/markdown";
import { cn } from "@/lib/utils";

const CARET_CSS = `
@keyframes bot-chat-caret-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}
.bot-chat-caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 1px;
  vertical-align: -0.15em;
  border-radius: 1px;
  background: currentColor;
  animation: bot-chat-caret-blink 1.1s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .bot-chat-caret { animation: none; }
}
`;

export interface StreamingBubbleProps {
  text: string;
  status?: "streaming" | "settled" | "error";
  className?: string;
}

export function StreamingBubble({ text, status = "streaming", className }: StreamingBubbleProps) {
  const streaming = status === "streaming";
  return (
    <div className={cn("flex w-full justify-start", className)}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed",
          status === "error"
            ? "bg-[var(--bg-elevated)] text-orange-400"
            : "bg-[var(--accent-primary)] text-white",
        )}
      >
        {streaming && <style>{CARET_CSS}</style>}
        <Markdown className="inline">{text}</Markdown>
        {streaming && <span className="bot-chat-caret" aria-hidden="true" />}
      </div>
    </div>
  );
}
