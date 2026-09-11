'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, SquaresFour, Users } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';
import { getBots, getBotDisplayName } from '@/lib/bots/bot-profile';
import { useBotRosterStore } from '@/lib/bots/bot-roster.store';
import { useGroupChatStore } from '@/lib/bots/group-chat.store';
import { useStartBotSession } from '@/lib/bots/useStartBotSession';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { BotRailRow, BotGroupRailRow } from '@/views/bots/BotRailRows';
import { BotLaunchpadView } from '@/views/bots/BotLaunchpadView';
import { BotHomeView } from '@/views/bots/BotHomeView';
import { BotChatSessionView } from '@/views/bots/BotChatSessionView';
import { GroupsListView } from '@/views/bots/GroupsListView';
import { GroupChatView } from '@/views/bots/GroupChatView';

export type FabricBotView = 'hub' | 'bot-home' | 'bot-chat' | 'groups' | 'group-chat';

function railItemClass(active: boolean): string {
  return cn(
    'w-full flex items-center gap-2.5 py-1.5 px-3 max-md:min-h-11 rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium',
    active
      ? 'bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-semibold'
      : 'bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]',
  );
}

export function FabricBotModeRail({
  view,
  selectedBotId,
  selectedGroupId,
  onOpenHub,
  onOpenGroups,
  onCloseDrawer,
}: {
  view: FabricBotView;
  selectedBotId: string | null;
  selectedGroupId: string | null;
  onOpenHub: () => void;
  onOpenGroups: () => void;
  onCloseDrawer?: () => void;
}): React.ReactNode {
  const agents = useAgentStore((s) => s.agents);
  const bots = useMemo(() => getBots(agents), [agents]);
  const pinnedBotIds = useBotRosterStore((s) => s.pinnedBotIds);
  const pinBot = useBotRosterStore((s) => s.pinBot);
  const unpinBot = useBotRosterStore((s) => s.unpinBot);
  const canonicalChatIds = useBotRosterStore((s) => s.canonicalChatIds);
  const chatSessions = useChatSessionStore((s) => s.sessions);
  const groups = useGroupChatStore((s) => s.groups);
  const getUnreadCount = useGroupChatStore((s) => s.getUnreadCount);
  const setActiveGroup = useGroupChatStore((s) => s.setActiveGroup);
  const [draggingBotId, setDraggingBotId] = useState<string | null>(null);
  const [pinDropActive, setPinDropActive] = useState(false);

  const { startSession, isStarting } = useStartBotSession();

  const pinnedBots = useMemo(
    () =>
      pinnedBotIds.flatMap((id) => {
        const bot = bots.find((b) => b.id === id);
        return bot ? [bot] : [];
      }),
    [pinnedBotIds, bots],
  );

  const sortedBots = useMemo(() => {
    const activityOf = (bot: Agent): number => {
      const sid = canonicalChatIds[bot.id];
      const session = sid ? (chatSessions || []).find((s) => s.id === sid) : null;
      return session ? new Date(session.updatedAt || 0).getTime() : 0;
    };
    return [...bots].sort((a, b) => {
      const aPinned = pinnedBotIds.includes(a.id) ? 0 : 1;
      const bPinned = pinnedBotIds.includes(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      const diff = activityOf(b) - activityOf(a);
      if (diff !== 0) return diff;
      return getBotDisplayName(a).localeCompare(getBotDisplayName(b));
    });
  }, [bots, pinnedBotIds, canonicalChatIds, chatSessions]);

  const handleOpenBot = useCallback(
    (bot: Agent) => {
      void startSession(bot);
      onCloseDrawer?.();
    },
    [startSession, onCloseDrawer],
  );

  const groupList = useMemo(
    () => Object.values(groups).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [groups],
  );

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        className={railItemClass(false)}
        onClick={() => {
          window.dispatchEvent(new CustomEvent('allternit:open-bot-picker'));
        }}
      >
        <Plus size={16} weight="bold" className="text-[var(--shell-item-muted)]" />
        <span className="text-[12px] font-semibold">New</span>
      </button>
      <button
        type="button"
        className={railItemClass(view === 'hub')}
        onClick={() => {
          onOpenHub();
          onCloseDrawer?.();
        }}
      >
        <SquaresFour size={15} weight={view === 'hub' ? 'fill' : 'bold'} />
        <span className="text-[12px]">Bot Hub</span>
      </button>
      <button
        type="button"
        className={railItemClass(view === 'groups' || view === 'group-chat')}
        onClick={() => {
          onOpenGroups();
          onCloseDrawer?.();
        }}
      >
        <Users size={15} weight={view === 'groups' || view === 'group-chat' ? 'fill' : 'bold'} />
        <span className="text-[12px]">Groups</span>
      </button>

      {(pinnedBots.length > 0 || draggingBotId !== null) && (
        <div className="mt-2">
          <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--shell-item-muted)]">
            Pinned Bots
          </div>
          {draggingBotId !== null && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setPinDropActive(true);
              }}
              onDragLeave={() => setPinDropActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                const droppedId = e.dataTransfer.getData('text/plain') || draggingBotId;
                if (droppedId) pinBot(droppedId);
                setPinDropActive(false);
                setDraggingBotId(null);
              }}
              className={cn(
                'mx-2 mb-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-[12px]',
                pinDropActive
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] text-[var(--shell-item-muted)]',
              )}
            >
              Drag a bot here to pin
            </div>
          )}
          {pinnedBots.map((bot) => (
            <BotRailRow
              key={bot.id}
              bot={bot}
              isActive={view === 'bot-chat' && selectedBotId === bot.id}
              disabled={isStarting}
              onOpen={() => handleOpenBot(bot)}
              onUnpin={() => unpinBot(bot.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-2">
        <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--shell-item-muted)]">
          Group Chats
        </div>
        {groupList.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-[var(--shell-item-muted)]">No group chats yet</div>
        ) : (
          groupList.map((group) => (
            <BotGroupRailRow
              key={group.id}
              group={group}
              unread={getUnreadCount(group.id)}
              isActive={view === 'group-chat' && selectedGroupId === group.id}
              onOpen={() => {
                setActiveGroup(group.id);
                window.dispatchEvent(
                  new CustomEvent('allternit:open-view', {
                    detail: { viewType: 'group-chat', context: { groupId: group.id } },
                  }),
                );
                onCloseDrawer?.();
              }}
            />
          ))
        )}
      </div>

      <div className="mt-2">
        <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--shell-item-muted)]">
          Bots
        </div>
        {sortedBots.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-[var(--shell-item-muted)]">
            No bots yet — create one in Bot Hub
          </div>
        ) : (
          sortedBots.map((bot) => (
            <BotRailRow
              key={bot.id}
              bot={bot}
              isActive={
                (view === 'bot-chat' || view === 'bot-home') && selectedBotId === bot.id
              }
              disabled={isStarting}
              onOpen={() => handleOpenBot(bot)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', bot.id);
                e.dataTransfer.effectAllowed = 'move';
                setDraggingBotId(bot.id);
              }}
              onDragEnd={() => {
                setDraggingBotId(null);
                setPinDropActive(false);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function FabricBotModeCanvas({
  view,
  botId,
  sessionId,
  groupId,
  onView,
}: {
  view: FabricBotView;
  botId: string | null;
  sessionId: string | null;
  groupId: string | null;
  onView: (next: {
    view: FabricBotView;
    botId?: string | null;
    sessionId?: string | null;
    groupId?: string | null;
  }) => void;
}): React.ReactNode {
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        viewType?: string;
        context?: { sessionId?: string; botId?: string; groupId?: string };
      } | undefined;
      if (!detail?.viewType) return;
      if (detail.viewType === 'agent-hub' || detail.viewType === 'bot-launchpad') {
        onView({ view: 'hub', botId: null, sessionId: null });
        return;
      }
      if (detail.viewType === 'bot-home') {
        onView({ view: 'bot-home', botId: detail.context?.botId ?? null });
        return;
      }
      if (detail.viewType === 'bot-chat-session') {
        onView({
          view: 'bot-chat',
          botId: detail.context?.botId ?? null,
          sessionId: detail.context?.sessionId ?? null,
        });
        return;
      }
      if (detail.viewType === 'groups-list') {
        onView({ view: 'groups' });
        return;
      }
      if (detail.viewType === 'group-chat') {
        onView({ view: 'group-chat', groupId: detail.context?.groupId ?? null });
      }
    };
    window.addEventListener('allternit:open-view', onOpen);
    return () => window.removeEventListener('allternit:open-view', onOpen);
  }, [onView]);

  if (view === 'bot-chat' && botId) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <BotChatSessionView
          botId={botId}
          sessionId={sessionId ?? undefined}
          onBack={() => onView({ view: 'hub', botId: null, sessionId: null })}
        />
      </div>
    );
  }
  if (view === 'bot-home' && botId) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <BotHomeView botId={botId} />
      </div>
    );
  }
  if (view === 'group-chat' && groupId) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <GroupChatView groupId={groupId} onBack={() => onView({ view: 'groups', groupId: null })} />
      </div>
    );
  }
  if (view === 'groups') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <GroupsListView
          onOpenGroup={(id) => onView({ view: 'group-chat', groupId: id })}
        />
      </div>
    );
  }
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <BotLaunchpadView />
    </div>
  );
}
