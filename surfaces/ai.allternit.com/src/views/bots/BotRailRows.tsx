'use client';

import React from 'react';
import { PushPinSlash } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/agents/agent.types';
import { getBotDisplayName } from '@/lib/bots/bot-profile';
import { useBotStatus } from '@/lib/bots/bot-operational-state.store';
import type { GroupChat } from '@/lib/bots/group-chat.types';
import { BotAvatar } from './BotAvatar';
import { GroupChatAvatar } from './GroupChatAvatar';

export function BotNeedsYouHint({ botId }: { botId: string }): React.ReactNode {
  const { needsAttention, hasPendingApprovals } = useBotStatus(botId);
  if (!needsAttention && !hasPendingApprovals) return null;
  return (
    <span className="shrink-0 text-[10px] font-medium text-[var(--accent-primary)]">
      Needs you
    </span>
  );
}

export function BotRailRow({
  bot,
  isActive,
  disabled,
  onOpen,
  onUnpin,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  bot: Agent;
  isActive?: boolean;
  disabled?: boolean;
  onOpen: () => void;
  onUnpin?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}): React.ReactNode {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl cursor-pointer transition-all duration-200 font-medium',
        isActive
          ? 'bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold'
          : 'bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium disabled:opacity-60"
      >
        <BotAvatar bot={bot} size={22} />
        <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
          {getBotDisplayName(bot)}
        </span>
        <BotNeedsYouHint botId={bot.id} />
      </button>
      {onUnpin && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUnpin();
          }}
          title="Unpin from rail"
          className="opacity-0 max-md:opacity-100 group-hover:opacity-100 shrink-0 -ml-1 size-6 max-md:size-11 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center justify-center transition-all"
        >
          <PushPinSlash size={13} />
        </button>
      )}
    </div>
  );
}

export function BotGroupRailRow({
  group,
  unread,
  isActive,
  onOpen,
}: {
  group: GroupChat;
  unread: number;
  isActive?: boolean;
  onOpen: () => void;
}): React.ReactNode {
  return (
    <div
      data-rail-item={`group-${group.id}`}
      className={cn(
        'group relative w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl cursor-pointer transition-all duration-200 font-medium',
        isActive
          ? 'bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold'
          : 'bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-none p-0 text-left cursor-pointer font-medium"
      >
        <GroupChatAvatar name={group.name} members={group.members} size={22} />
        <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
          {group.name}
        </span>
        {unread > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 text-[11px] font-semibold text-[var(--ui-text-inverse)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
