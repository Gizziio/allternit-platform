"use client";

/**
 * Group Chat Composer
 *
 * Text input for group channels with lightweight @mention support. Lists
 * available bots from the unified roster and inserts their handle when chosen.
 *
 * @module GroupChatComposer
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PaperPlaneTilt, ArrowUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUnifiedRoster } from "@/lib/bots/use-unified-roster";
import type { GroupChat } from "@/lib/bots/group-chat.types";

export interface GroupChatComposerProps {
  group: GroupChat;
  onSend: (text: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function GroupChatComposer({
  group,
  onSend,
  isLoading = false,
  placeholder = "Message the group…",
}: GroupChatComposerProps) {
  const [input, setInput] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const roster = useUnifiedRoster();

  const memberIds = useMemo(
    () => new Set(group.members.map((m) => m.botId)),
    [group.members]
  );

  const mentionTargets = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return roster.filter(
      (bot) =>
        memberIds.has(bot.id) &&
        (bot.displayName.toLowerCase().includes(q) ||
          bot.handle.toLowerCase().includes(q) ||
          bot.agent.name.toLowerCase().includes(q))
    );
  }, [roster, memberIds, mentionQuery]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, 44), 200);
    el.style.height = `${nextHeight}px`;
  }, [input]);

  const parseMention = useCallback((val: string) => {
    const lastAt = val.lastIndexOf("@");
    if (lastAt === -1) {
      setMentionOpen(false);
      return;
    }
    const before = val.slice(0, lastAt);
    const after = val.slice(lastAt + 1);
    if (before.length > 0 && !/\s/.test(before.slice(-1))) {
      setMentionOpen(false);
      return;
    }
    if (after.includes(" ") || after.includes("\n")) {
      setMentionOpen(false);
      return;
    }
    setMentionOpen(true);
    setMentionQuery(after);
    setMentionIndex(0);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setInput(val);
      parseMention(val);
    },
    [parseMention]
  );

  const insertMention = useCallback(
    (handle: string) => {
      const lastAt = input.lastIndexOf("@");
      if (lastAt === -1) return;
      const before = input.slice(0, lastAt);
      const after = input.slice(lastAt + mentionQuery.length + 1);
      const next = `${before}@${handle} ${after}`;
      setInput(next);
      setMentionOpen(false);
      setMentionQuery("");
      setMentionIndex(0);
      textareaRef.current?.focus();
    },
    [input, mentionQuery]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen && mentionTargets.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((i) => (i + 1) % mentionTargets.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex(
            (i) => (mentionTargets.length + i - 1) % mentionTargets.length
          );
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const target = mentionTargets[mentionIndex];
          if (target) insertMention(target.handle);
          return;
        }
        if (e.key === "Escape") {
          setMentionOpen(false);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = input.trim();
        if (trimmed && !isLoading) {
          onSend(trimmed);
          setInput("");
          setMentionOpen(false);
        }
      }
    },
    [mentionOpen, mentionTargets, mentionIndex, input, isLoading, onSend, insertMention]
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
    setMentionOpen(false);
  }, [input, isLoading, onSend]);

  return (
    <div className="relative">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={isLoading}
          className={cn(
            "max-h-[120px] min-h-[48px] flex-1 resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)]",
            "placeholder:text-[var(--text-tertiary)]"
          )}
        />
        <Button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="h-11 w-11 shrink-0 rounded-xl p-0 transition-opacity disabled:opacity-50"
          style={{
            background: "var(--accent-primary)",
            color: "#fff",
          }}
          aria-label="Send message"
        >
          {isLoading ? (
            <ArrowUp size={18} weight="bold" className="animate-pulse" />
          ) : (
            <PaperPlaneTilt size={18} weight="fill" />
          )}
        </Button>
      </div>

      {mentionOpen && mentionTargets.length > 0 && (
        <div
          className="absolute left-0 right-0 bottom-full z-50 mb-2 max-h-52 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 shadow-lg"
        >
          {mentionTargets.map((bot, idx) => (
            <button
              key={bot.id}
              type="button"
              onClick={() => insertMention(bot.handle)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                idx === mentionIndex
                  ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              )}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  background: `${bot.accentColor ?? "var(--accent-primary)"}20`,
                  color: bot.accentColor ?? "var(--accent-primary)",
                }}
              >
                {bot.displayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join("")}
              </span>
              <span className="truncate">{bot.displayName}</span>
              <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">
                @{bot.handle}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default GroupChatComposer;
