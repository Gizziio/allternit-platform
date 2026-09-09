import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Checks, UsersThree } from '@phosphor-icons/react';
import { useAgentsWithSwarms } from '@/lib/agents';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { Agent } from '@/lib/agents/agent.types';
import { isBot } from '@/lib/bots/bot-profile';
import { deriveBotPresence, type BotPresenceState } from '@/lib/bots/bot-presence';
import {
  useBotActivityWatermarkStore,
  canonicalActivityAt,
} from '@/lib/bots/bot-activity-watermark';
import {
  getBotActivityToastsPref,
  setBotActivityToastsPref,
  BOT_ACTIVITY_TOASTS_CHANGED_EVENT,
  type BotActivityToastsPref,
} from '@/lib/bots/bot-activity-toasts';
import { computeInboxBadge, selectVisibleBotAttention } from '@/lib/bots/bot-inbox';
import { useBotRosterStore } from '@/lib/bots/bot-roster.store';
import { useCommRailsMailStore } from '@/lib/bots/comrails-mail.store';
import { openBotCanonicalChat, openBotChatView } from '@/lib/bots/bot-canonical-chat.service';
import { useGroupChatStore } from '@/lib/bots/group-chat.store';
import {
  refreshGroupEscalations,
  resolveGroupRoomHold,
  startGroupRoomsSync,
  useGroupRoomsSyncStore,
} from '@/lib/bots/group-rooms-sync';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { BotAvatar } from '@/views/bots/BotAvatar';
import { cn } from '@/lib/utils';

function formatRelativeTime(ts: number): string {
  if (!ts || Number.isNaN(ts)) return '';
  const now = Date.now();
  const diff = now - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function defaultOpenView(view: string, context?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('allternit:open-view', { detail: { viewType: view, context } }),
  );
}

/**
 * Unified Inbox badge count (unread CommRails mail + visible bot attention +
 * new-activity watermarks). Shared by the BotInboxContent header and the
 * shell bell badge.
 */
export function useInboxBadgeCount(): number {
  const agents = useAgentsWithSwarms();
  const bots = useMemo(() => agents.filter(isBot), [agents]);
  const attention = useAgentStore((state) => state.attention);
  const sessions = useChatSessionStore((state) => state.sessions);
  const canonicalChatIds = useBotRosterStore((state) => state.canonicalChatIds);
  const mailMessages = useCommRailsMailStore((state) => state.messages);
  const watermarks = useBotActivityWatermarkStore((state) => state.watermarks);
  const focusedSessionId = useBotActivityWatermarkStore((state) => state.focusedSessionId);

  const activityByBot = useMemo(() => {
    const map: Record<string, number> = {};
    const list = sessions ?? [];
    for (const bot of bots) {
      map[bot.id] = canonicalActivityAt(bot.id, list, canonicalChatIds);
    }
    return map;
  }, [bots, sessions, canonicalChatIds]);

  return useMemo(
    () =>
      computeInboxBadge({
        messages: mailMessages,
        bots,
        attention,
        agents,
        activityByBot,
        watermarks,
        focusedSessionId,
        canonicalChatIds,
      }),
    [mailMessages, bots, attention, agents, activityByBot, watermarks, focusedSessionId, canonicalChatIds],
  );
}

export interface BotInboxContentProps {
  onOpen?: (view: string, context?: Record<string, unknown>) => void;
}

/**
 * The former rail Inbox popover body, extracted as a reusable panel: Mail
 * threads, group escalations, needs-attention, and active-bot sections plus
 * the activity-toasts opt-in. Fills whatever container it is rendered in.
 */
export function BotInboxContent({ onOpen }: BotInboxContentProps): React.ReactNode {
  const openView = onOpen ?? defaultOpenView;
  const agents = useAgentsWithSwarms();
  const bots = useMemo(() => agents.filter(isBot), [agents]);
  const attention = useAgentStore((state) => state.attention);
  const sessions = useChatSessionStore((state) => state.sessions);
  const canonicalChatIds = useBotRosterStore((state) => state.canonicalChatIds);
  const mailMessages = useCommRailsMailStore((state) => state.messages);
  const mailThreads = useCommRailsMailStore((state) => state.threads);
  const loadThreads = useCommRailsMailStore((state) => state.loadThreads);
  const acknowledgeMail = useCommRailsMailStore((state) => state.acknowledgeMail);
  const markAllSeen = useBotActivityWatermarkStore((state) => state.markAllSeen);
  const watermarks = useBotActivityWatermarkStore((state) => state.watermarks);
  const focusedSessionId = useBotActivityWatermarkStore((state) => state.focusedSessionId);
  const groupHolds = useGroupRoomsSyncStore((state) => state.holds);
  const groupsById = useGroupChatStore((state) => state.groups);

  // Server-side group-room sync (pull on focus/reconnect, disband tombstones).
  useEffect(() => startGroupRoomsSync(), []);

  const [toastsPref, setToastsPref] = useState<BotActivityToastsPref>(() => getBotActivityToastsPref());

  useEffect(() => {
    const sync = () => setToastsPref(getBotActivityToastsPref());
    globalThis.addEventListener?.(BOT_ACTIVITY_TOASTS_CHANGED_EVENT, sync);
    return () => globalThis.removeEventListener?.(BOT_ACTIVITY_TOASTS_CHANGED_EVENT, sync);
  }, []);

  const firstBotId = bots[0]?.id;
  useEffect(() => {
    // Threads are global; enrich from the first bot's perspective.
    if (firstBotId) void loadThreads(firstBotId);
    void refreshGroupEscalations();
  }, [firstBotId, loadThreads]);

  const activityByBot = useMemo(() => {
    const map: Record<string, number> = {};
    const list = sessions ?? [];
    for (const bot of bots) {
      map[bot.id] = canonicalActivityAt(bot.id, list, canonicalChatIds);
    }
    return map;
  }, [bots, sessions, canonicalChatIds]);

  const presenceByBot = useMemo(() => {
    const map: Record<string, BotPresenceState> = {};
    const list = sessions ?? [];
    for (const bot of bots) {
      const canonicalId = canonicalChatIds[bot.id];
      const session = canonicalId ? list.find((s) => s.id === canonicalId) : undefined;
      map[bot.id] = deriveBotPresence({
        streaming: canonicalId ? (useChatSessionStore.getState().streamingBySession[canonicalId]?.isStreaming ?? false) : false,
        sessionActivityAt: session ? new Date(session.updatedAt || 0).getTime() : 0,
        routineActivityAt: 0,
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots, sessions, canonicalChatIds]);

  const badge = useMemo(
    () =>
      computeInboxBadge({
        messages: mailMessages,
        bots,
        attention,
        agents,
        activityByBot,
        watermarks,
        focusedSessionId,
        canonicalChatIds,
      }),
    [mailMessages, bots, attention, agents, activityByBot, watermarks, focusedSessionId, canonicalChatIds],
  );

  const attentionItems = useMemo(
    () => selectVisibleBotAttention(attention, agents),
    [attention, agents],
  );

  const activeBots = useMemo(
    () =>
      bots.filter((b) => {
        const p = presenceByBot[b.id];
        return p && p.presence !== 'idle';
      }),
    [bots, presenceByBot],
  );

  const threadsNewestFirst = useMemo(
    () => [...mailThreads].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)),
    [mailThreads],
  );

  const botById = useMemo(() => {
    const map: Record<string, Agent> = {};
    for (const agent of agents) map[agent.id] = agent;
    return map;
  }, [agents]);

  const handleMarkAllRead = () => {
    const entries: Array<{ botId: string; activityAt: number }> = [];
    for (const bot of bots) {
      const activityAt = activityByBot[bot.id] ?? 0;
      entries.push({ botId: bot.id, activityAt });
    }
    markAllSeen(entries);
    for (const m of mailMessages) {
      if (m.toAgentId && (m.status === 'unread' || m.requiresAck)) {
        void acknowledgeMail(m.toAgentId, m.id);
      }
    }
  };

  const openBotChat = useCallback(
    (bot: Agent) => {
      const name = bot.botProfile?.displayName ?? bot.name;
      void openBotCanonicalChat({ botId: bot.id, botName: name, setActive: false }).then((sessionId) =>
        openBotChatView(sessionId, bot.id, 'chat'),
      );
    },
    [],
  );

  const handleOpenThread = (thread: (typeof threadsNewestFirst)[number]) => {
    const botId = thread.participants.find((p) => botById[p] && isBot(botById[p]));
    if (botId) openView('bot-inbox', { botId });
  };

  const showMail = threadsNewestFirst.length > 0;
  const showAttention = attentionItems.length > 0;
  const showActive = activeBots.length > 0;
  const unresolvedGroupHolds = groupHolds.filter((h) => !h.resolved);
  const showGroupHolds = unresolvedGroupHolds.length > 0;

  const handleOpenGroupHold = (hold: (typeof unresolvedGroupHolds)[number]) => {
    openView('group-chat', { groupId: hold.room_id });
    // Room view opened — resolve fire-and-forget.
    void resolveGroupRoomHold(hold.room_id, hold.hold_id);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border-subtle)] shrink-0">
        <span className="text-[13px] font-semibold text-[var(--shell-item-fg)] flex-1">
          Inbox
          {badge > 0 && <span className="ml-1.5 text-[11px] text-[var(--shell-item-muted)]">{badge}</span>}
        </span>
        <button
          type="button"
          onClick={handleMarkAllRead}
          title="Mark all read"
          className="p-1 rounded-md bg-transparent border-none text-[var(--shell-item-muted)] hover:text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer"
        >
          <Checks size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {showMail && (
          <div className="py-1">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--shell-item-muted)]">
              Mail
            </div>
            {threadsNewestFirst.map((thread) => {
              const bot = thread.participants.map((p) => botById[p]).find((a) => a && isBot(a));
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => handleOpenThread(thread)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 bg-transparent border-none cursor-pointer text-left hover:bg-[var(--shell-item-hover)]"
                >
                  {bot ? (
                    <BotAvatar bot={bot} size={20} />
                  ) : (
                    <span className="size-5 rounded-full bg-[var(--shell-item-hover)] shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-[var(--shell-item-fg)] truncate">
                      {thread.subject}
                    </span>
                    <span className="block text-[10px] text-[var(--shell-item-muted)]">
                      {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}
                      {thread.unreadCount > 0 ? ` · ${thread.unreadCount} unread` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-[var(--shell-item-muted)]">
                      {formatRelativeTime(new Date(thread.lastMessageAt).getTime())}
                    </span>
                    {thread.unreadCount > 0 && (
                      <span className="size-1.5 rounded-full bg-[var(--accent-primary)]" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {showGroupHolds && (
          <div className="py-1 border-t border-[var(--border-subtle)]">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--shell-item-muted)]">
              Group escalations
            </div>
            {unresolvedGroupHolds.map((hold) => {
              const roomName = groupsById[hold.room_id]?.name ?? hold.room_id;
              const memberBot = botById[hold.member_id];
              const memberName =
                memberBot?.botProfile?.displayName ?? memberBot?.name ?? hold.member_id;
              return (
                <button
                  key={hold.hold_id}
                  type="button"
                  onClick={() => handleOpenGroupHold(hold)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 bg-transparent border-none cursor-pointer text-left hover:bg-[var(--shell-item-hover)]"
                >
                  <span className="size-5 rounded-full bg-[var(--shell-item-hover)] shrink-0 flex items-center justify-center text-[var(--accent-primary)]">
                    <UsersThree size={12} weight="bold" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-[var(--shell-item-fg)] truncate">
                      {roomName}
                    </span>
                    <span className="block text-[10px] text-[var(--shell-item-muted)] truncate">
                      {memberName}
                      {hold.message_excerpt ? ` · ${hold.message_excerpt}` : ' needs you'}
                    </span>
                  </span>
                  <span className="text-[10px] text-[var(--shell-item-muted)] shrink-0">
                    {formatRelativeTime(new Date(hold.created_at).getTime())}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {showAttention && (
          <div className="py-1 border-t border-[var(--border-subtle)]">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--shell-item-muted)]">
              Needs attention
            </div>
            {attentionItems.map(({ bot, entry }) => (
              <button
                key={bot.id}
                type="button"
                onClick={() => openBotChat(bot)}
                className="w-full flex items-center gap-2 px-3 py-1.5 bg-transparent border-none cursor-pointer text-left hover:bg-[var(--shell-item-hover)]"
              >
                <BotAvatar bot={bot} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-[var(--shell-item-fg)] truncate">
                    {bot.botProfile?.displayName ?? bot.name}
                  </span>
                  <span className="block text-[10px] text-[var(--shell-item-muted)] truncate">
                    {entry.hint}
                  </span>
                </span>
                <span className="text-[10px] text-[var(--shell-item-muted)] shrink-0">
                  {formatRelativeTime(entry.notedAt)}
                </span>
              </button>
            ))}
          </div>
        )}

        {showActive && (
          <div className="py-1 border-t border-[var(--border-subtle)]">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--shell-item-muted)]">
              Active
            </div>
            {activeBots.map((bot) => {
              const p = presenceByBot[bot.id];
              return (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => openBotChat(bot)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 bg-transparent border-none cursor-pointer text-left hover:bg-[var(--shell-item-hover)]"
                >
                  <span className="relative shrink-0">
                    <BotAvatar bot={bot} size={20} />
                    <span
                      className={cn(
                        'absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full border border-[var(--surface-panel)]',
                        p?.presence === 'working' ? 'bg-[var(--accent-primary)]' : 'bg-[var(--status-success)]',
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] text-[var(--shell-item-fg)] truncate">
                    {bot.botProfile?.displayName ?? bot.name}
                  </span>
                  <span className="text-[10px] text-[var(--shell-item-muted)] shrink-0">
                    {p?.presence === 'working' ? 'Working…' : 'Active'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!showMail && !showAttention && !showActive && !showGroupHolds && (
          <div className="px-3 py-6 text-[12px] text-[var(--shell-item-muted)] text-center">
            No mail, attention, or active bots right now.
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 px-3 py-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--shell-item-muted)] cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={toastsPref === 'on'}
          onChange={(e) => setBotActivityToastsPref(e.target.checked ? 'on' : 'off')}
          className="accent-[var(--accent-primary)]"
        />
        Activity toasts (opt-in)
      </label>
    </div>
  );
}
