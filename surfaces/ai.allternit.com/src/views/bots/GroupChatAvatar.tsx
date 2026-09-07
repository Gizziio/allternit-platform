"use client";

/**
 * Group Chat Avatar
 *
 * Renders a channel/group avatar. Shows a stack of member initials when member
 * data is available, falling back to a channel icon for empty groups.
 *
 * @module GroupChatAvatar
 */

import React, { useMemo } from "react";
import { Users } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { GroupChatMember } from "@/lib/bots/group-chat.types";

export interface GroupChatAvatarProps {
  name: string;
  members?: GroupChatMember[];
  size?: number;
  className?: string;
}

function initials(name: string): string {
  return (name || "Channel")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function stringToHsl(str: string, saturation = 55, lightness = 45): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function GroupChatAvatar({
  name,
  members = [],
  size = 40,
  className,
}: GroupChatAvatarProps) {
  const accent = useMemo(() => stringToHsl(name), [name]);
  const fallback = useMemo(() => initials(name), [name]);

  const displayMembers = members.slice(0, 3);
  const hasMembers = displayMembers.length > 0;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0 overflow-hidden rounded-lg border",
        className
      )}
      style={{
        width: size,
        height: size,
        background: `${accent}20`,
        borderColor: `${accent}40`,
        color: accent,
      }}
      aria-label={`${name} group avatar`}
    >
      {hasMembers ? (
        <div className="flex -space-x-1.5">
          {displayMembers.map((member) => (
            <div
              key={member.botId}
              className="flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[10px] font-semibold"
              style={{
                width: Math.max(14, size * 0.4),
                height: Math.max(14, size * 0.4),
                minWidth: Math.max(14, size * 0.4),
              }}
              title={member.displayName}
            >
              {initials(member.displayName)}
            </div>
          ))}
        </div>
      ) : (
        <>
          <Users size={Math.max(14, size * 0.45)} weight="duotone" />
          <span className="sr-only">{fallback}</span>
        </>
      )}
    </div>
  );
}

export default GroupChatAvatar;
