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

import React, { useMemo } from "react";
import { Markdown } from "@/components/ai-elements/markdown";
import { parseStructuredContent } from "@/lib/ai/rust-stream-adapter-extended";
import { cn } from "@/lib/utils";
import { InlineArtifactRenderer } from "./InlineArtifactRenderer";
import type { InlineArtifact } from "./types";

export interface SettledBubbleProps {
  role: "user" | "bot";
  text: string;
  className?: string;
}

export function SettledBubble({ role, text, className }: SettledBubbleProps) {
  const isBot = role === "bot";

  const { textContent, artifacts } = useMemo(() => {
    if (!isBot) return { textContent: text, artifacts: [] };
    try {
      const parts = parseStructuredContent(text);
      const artParts: InlineArtifact[] = [];
      const textSegments: string[] = [];

      for (const part of parts) {
        if (part.type === "artifact") {
          artParts.push({
            id: part.artifactId || `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            kind: part.kind,
            title: part.title,
            content: part.content ?? "",
            url: part.url,
          });
        } else if (part.type === "text" && part.text.trim()) {
          textSegments.push(part.text);
        }
      }

      return {
        textContent: textSegments.length > 0 ? textSegments.join("\n\n") : artParts.length > 0 ? "" : text,
        artifacts: artParts,
      };
    } catch {
      return { textContent: text, artifacts: [] };
    }
  }, [isBot, text]);

  if (!isBot) {
    return (
      <div className={cn("flex w-full justify-end", className)}>
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--bg-elevated)] px-4 py-3 text-sm leading-relaxed text-[var(--text-primary,#e5e5e5)]">
          <span className="whitespace-pre-wrap break-words">{text}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col justify-start gap-2", className)}>
      {textContent ? (
        <div
          className={cn(
            "rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed",
            artifacts.length > 0
              ? "max-w-[95%] bg-[var(--surface-panel)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
              : "max-w-[85%] bg-[var(--accent-primary)] text-white"
          )}
        >
          <Markdown>{textContent}</Markdown>
        </div>
      ) : null}

      {artifacts.map((art) => (
        <div key={art.id} className="w-full max-w-[95%]">
          <InlineArtifactRenderer artifact={art} />
        </div>
      ))}
    </div>
  );
}
