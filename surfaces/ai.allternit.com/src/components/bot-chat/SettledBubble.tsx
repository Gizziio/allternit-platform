"use client";

/**
 * Settled message bubble (Phase 1A).
 *
 * Tailed, edge-aligned: bot messages get the neutral panel fill and left
 * edge, user messages get the same panel fill with the right edge. Bot text
 * renders through the shared markdown component; user text is plain — a
 * message about `**` must show the asterisks. Both bubbles use
 * `--surface-panel` + `--border-subtle` so they stay visible on the
 * `--bg-elevated` chat background (an elevated-colored bubble is invisible).
 *
 * View merge (OpenMaus ChatView → Allternit tokens): hover "…" copy handle;
 * long user pastes collapse behind a fade.
 *
 * @module bot-chat/SettledBubble
 */

import React, { useMemo, useState } from "react";
import { Markdown } from "@/components/ai-elements/markdown";
import { parseStructuredContent } from "@/lib/ai/rust-stream-adapter-extended";
import { cn } from "@/lib/utils";
import { InlineArtifactRenderer } from "./InlineArtifactRenderer";
import type { InlineArtifact } from "./types";
import { CopyMessageButton, MessageHoverActions } from "./MessageHoverActions";

const USER_COLLAPSE_CHARS = 600;
const USER_COLLAPSE_LINES = 8;

function shouldCollapseUser(text: string): boolean {
  return text.length > USER_COLLAPSE_CHARS || text.split("\n").length > USER_COLLAPSE_LINES;
}

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
    return <UserBubble text={text} className={className} />;
  }

  const copyText = textContent || text;
  return (
    <div className={cn("group flex w-full items-end justify-start gap-1", className)}>
      <div className="flex min-w-0 max-w-[85%] flex-col gap-2">
        {textContent ? (
          <div className="rounded-2xl rounded-bl-sm border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[var(--text-primary)]">
            <Markdown>{textContent}</Markdown>
          </div>
        ) : null}

        {artifacts.map((art) => (
          <div key={art.id} className="w-full max-w-[95%]">
            <InlineArtifactRenderer artifact={art} />
          </div>
        ))}
      </div>
      {copyText ? (
        <MessageHoverActions side="bot">
          <CopyMessageButton text={copyText} />
        </MessageHoverActions>
      ) : null}
    </div>
  );
}

function UserBubble({ text, className }: { text: string; className?: string }) {
  const collapsible = shouldCollapseUser(text);
  const [expanded, setExpanded] = useState(false);
  const collapsed = collapsible && !expanded;
  return (
    <div className={cn("group flex w-full items-end justify-end gap-1", className)}>
      <MessageHoverActions side="user">
        <CopyMessageButton text={text} />
      </MessageHoverActions>
      <div className="relative max-w-[85%]">
        <div
          className={cn(
            "rounded-2xl rounded-br-sm border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[var(--text-primary,#e5e5e5)]",
            collapsed && "max-h-40 overflow-hidden",
          )}
        >
          <span className="whitespace-pre-wrap break-words">{text}</span>
        </div>
        {collapsed ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute inset-x-0 bottom-0 rounded-b-2xl border-none bg-gradient-to-t from-[var(--surface-panel)] from-40% to-transparent pt-10 pb-2 text-center text-[12px] font-medium text-[var(--text-secondary)] cursor-pointer"
          >
            Show more
          </button>
        ) : null}
      </div>
    </div>
  );
}
