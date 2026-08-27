"use client";

/**
 * Group Chat Roster Item
 *
 * Single channel card rendered inside BotRoster. Shows the channel avatar,
 * name, last message preview, and unread count.
 *
 * @module GroupChatRosterItem
 */

import React, { useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { GroupChat } from "@/lib/bots/group-chat.types";
import { GroupChatAvatar } from "./GroupChatAvatar";

export interface GroupChatRosterItemProps {
  group: GroupChat;
  unreadCount: number;
  isSelected?: boolean;
  onSelect?: (groupId: string) => void;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export function GroupChatRosterItem({
  group,
  unreadCount,
  isSelected = false,
  onSelect,
}: GroupChatRosterItemProps) {
  const handleClick = useCallback(() => {
    onSelect?.(group.id);
  }, [group.id, onSelect]);

  const lastMessage = useMemo(() => {
    const msg = group.log[group.log.length - 1];
    if (!msg) return undefined;
    return {
      text: msg.text,
      timestamp: msg.timestamp,
      from: msg.from === "user" ? "You" : msg.displayName ?? "Bot",
    };
  }, [group.log]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      onClick={handleClick}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
        isSelected
          ? "border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/10"
          : "border-transparent hover:bg-[var(--surface-hover)]"
      )}
    >
      <GroupChatAvatar name={group.name} members={group.members} size={36} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-xs font-medium",
              isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
            )}
          >
            {group.name}
          </span>
          {unreadCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1 text-[10px] font-semibold text-[var(--ui-text-inverse)]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {lastMessage ? (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
            <span className="shrink-0">{lastMessage.from}:</span>
            <span className="truncate">{lastMessage.text}</span>
            <span className="shrink-0">· {relativeTime(lastMessage.timestamp)}</span>
          </div>
        ) : (
          <div className="truncate text-[11px] text-[var(--text-tertiary)]">
            {group.members.length} bot{group.members.length === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default GroupChatRosterItem;
