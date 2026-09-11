'use client';

import React from 'react';
import { Plus, Robot, SquaresFour, Users } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { BotAvatar } from '@/views/bots/BotAvatar';
import { BotChatSessionView } from '@/views/bots/BotChatSessionView';
import { useUnifiedRoster, type UnifiedRosterBot } from '@/lib/bots/use-unified-roster';
import { useGroupChatStore } from '@/lib/bots/group-chat.store';


function railRowClass(active: boolean): string {
  return cn(
    'w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium',
    active
      ? 'bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold'
      : 'bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]',
  );
}

export function FabricBotModeRail({
  selectedBotId,
  hubOpen,
  onSelectBot,
  onOpenHub,
}: {
  selectedBotId: string | null;
  hubOpen: boolean;
  onSelectBot: (botId: string) => void;
  onOpenHub: () => void;
}): React.ReactNode {
  const roster = useUnifiedRoster();
  const groups = useGroupChatStore((s) => Object.values(s.groups));

  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" className={railRowClass(false)} onClick={onOpenHub}>
        <Plus size={15} weight="bold" />
        <span className="text-[12px]">New</span>
      </button>
      <button type="button" className={railRowClass(hubOpen && !selectedBotId)} onClick={onOpenHub}>
        <SquaresFour size={15} weight={hubOpen && !selectedBotId ? 'fill' : 'bold'} />
        <span className="text-[12px]">Bot Hub</span>
      </button>
      {groups.length > 0 ? (
        <div className="mt-2">
          <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--shell-item-muted)]">
            Group Chats
          </div>
          {groups.map((group) => (
            <div key={group.id} className={railRowClass(false)}>
              <Users size={15} />
              <span className="text-[12px] truncate min-w-0 flex-1">{group.name}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-2">
        <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--shell-item-muted)]">
          Bots
        </div>
        {roster.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-[var(--shell-item-muted)]">
            No bots yet — create one in Bot Hub
          </div>
        ) : (
          roster.map((bot) => (
            <button
              key={bot.id}
              type="button"
              onClick={() => onSelectBot(bot.id)}
              className={railRowClass(selectedBotId === bot.id)}
            >
              <BotAvatar bot={bot.agent} size={22} />
              <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
                {bot.displayName}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function FabricBotHub({
  onSelectBot,
}: {
  onSelectBot: (botId: string) => void;
}): React.ReactNode {
  const roster = useUnifiedRoster();

  if (roster.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center">
        <Robot size={40} className="mb-3 opacity-40" />
        <p className="text-[15px] font-medium m-0 mb-1">No bots yet</p>
        <p className="text-[13px] text-[var(--text-secondary)] m-0 max-w-sm">
          Bots on this Allternit account show up here. Create one from Bot Hub on the desktop.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
      <h2 className="text-[15px] font-semibold m-0 mb-3">Bots</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {roster.map((bot) => (
          <BotHubCard key={bot.id} bot={bot} onSelect={() => onSelectBot(bot.id)} />
        ))}
      </div>
    </div>
  );
}

function BotHubCard({
  bot,
  onSelect,
}: {
  bot: UnifiedRosterBot;
  onSelect: () => void;
}): React.ReactNode {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[44px] items-center gap-3 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] px-4 py-3 text-left cursor-pointer"
    >
      <BotAvatar bot={bot.agent} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{bot.displayName}</span>
        {bot.tagline ? (
          <span className="block truncate text-[12px] text-[var(--shell-item-muted)]">{bot.tagline}</span>
        ) : null}
      </span>
    </button>
  );
}

export function FabricBotModeCanvas({
  selectedBotId,
  onSelectBot,
  onBack,
}: {
  selectedBotId: string | null;
  onSelectBot: (botId: string) => void;
  onBack: () => void;
}): React.ReactNode {
  if (selectedBotId) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <BotChatSessionView botId={selectedBotId} onBack={onBack} />
      </div>
    );
  }
  return <FabricBotHub onSelectBot={onSelectBot} />;
}
