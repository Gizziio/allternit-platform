/**
 * Bot Activity Watermark
 *
 * Unread semantics for bot canonical chats (spec Phase 2): a bot shows new
 * activity when its canonical chat's `updatedAt` advances past the watermark.
 * Watermarks are seeded on mount (set-if-absent) so history never marks
 * unread. While a bot's canonical chat is the focused/open session the
 * watermark follows activity automatically (refresh-in-place) — switching
 * away never shows a stale unread for turns you just watched.
 *
 * @module bot-activity-watermark
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { useBotRosterStore } from './bot-roster.store';
import type { Agent } from '@/lib/agents/agent.types';

export interface BotActivityWatermarkState {
  /** botId → last-seen canonical-chat activity (epoch ms). */
  watermarks: Record<string, number>;
  /** Canonical chat session currently open and focused, if any. */
  focusedSessionId: string | null;
  /** Set a watermark only when none exists (seed-on-mount). */
  seedWatermark: (botId: string, activityAt: number) => void;
  /** Advance a watermark to an observed activity. */
  markSeen: (botId: string, activityAt: number) => void;
  /** Mark a whole set of bots seen at their current activity (Inbox mark-all-read). */
  markAllSeen: (entries: Array<{ botId: string; activityAt: number }>) => void;
  setFocusedSession: (sessionId: string | null) => void;
  reset: () => void;
}

export const useBotActivityWatermarkStore = create<BotActivityWatermarkState>()((set) => ({
  watermarks: {},
  focusedSessionId: null,

  seedWatermark: (botId, activityAt) =>
    set((state) =>
      state.watermarks[botId] !== undefined
        ? state
        : { watermarks: { ...state.watermarks, [botId]: activityAt } },
    ),

  markSeen: (botId, activityAt) =>
    set((state) => ({
      watermarks: { ...state.watermarks, [botId]: Math.max(activityAt, state.watermarks[botId] ?? 0) },
    })),

  markAllSeen: (entries) =>
    set((state) => {
      const watermarks = { ...state.watermarks };
      for (const { botId, activityAt } of entries) {
        watermarks[botId] = Math.max(activityAt, watermarks[botId] ?? 0);
      }
      return { watermarks };
    }),

  setFocusedSession: (sessionId) => set({ focusedSessionId: sessionId }),

  reset: () => set({ watermarks: {}, focusedSessionId: null }),
}));

/** Pure unread comparison (exported for tests + badge aggregation). */
export function computeHasNewActivity(
  activityAt: number,
  watermark: number | undefined,
): boolean {
  return activityAt > 0 && activityAt > (watermark ?? 0);
}

/** Canonical-chat activity for a bot from the chat session store state. */
export function canonicalActivityAt(
  botId: string,
  sessions: Array<{ id: string; updatedAt?: string }>,
  canonicalChatIds: Record<string, string>,
): number {
  const canonicalId = canonicalChatIds[botId];
  if (!canonicalId) return 0;
  const session = sessions.find((s) => s.id === canonicalId);
  return session ? new Date(session.updatedAt || 0).getTime() : 0;
}

/**
 * True when the bot's canonical chat has activity newer than its watermark
 * and that chat is not the currently focused session. When focused, the
 * watermark is advanced instead (refresh-in-place), so this stays false.
 */
export function useBotHasNewActivity(botId: string | null): boolean {
  const canonicalChatId = useBotRosterStore((state) =>
    botId ? (state.canonicalChatIds[botId] ?? null) : null,
  );
  const activityAt = useChatSessionStore((state) => {
    if (!canonicalChatId) return 0;
    const session = (state.sessions ?? []).find((s) => s.id === canonicalChatId);
    return session ? new Date(session.updatedAt || 0).getTime() : 0;
  });
  const watermark = useBotActivityWatermarkStore((state) =>
    botId ? state.watermarks[botId] : undefined,
  );
  const focusedSessionId = useBotActivityWatermarkStore((state) => state.focusedSessionId);
  const markSeen = useBotActivityWatermarkStore((state) => state.markSeen);

  const focused = canonicalChatId !== null && focusedSessionId === canonicalChatId;

  useEffect(() => {
    if (botId && focused && activityAt > 0) {
      markSeen(botId, activityAt);
    }
  }, [botId, focused, activityAt, markSeen]);

  if (!botId || focused) return false;
  return computeHasNewActivity(activityAt, watermark);
}

const FOCUSED_CHAT_VIEWS = new Set(['chat', 'bot-chat-session']);

/**
 * Mount once in the shell: seeds watermarks for every bot (history never
 * marks unread, including bots created later in the session) and mirrors the
 * focused chat session so open chats badge as "seen" in place.
 */
export function useSyncBotWatermarks(viewType: string | null, bots: Agent[]): void {
  const botIdsKey = bots.map((b) => b.id).join(',');

  // Seed-on-mount (and when new bots appear): set-if-absent only.
  useEffect(() => {
    const state = useChatSessionStore.getState();
    const canonicalChatIds = useBotRosterStore.getState().canonicalChatIds;
    for (const botId of botIdsKey ? botIdsKey.split(',') : []) {
      if (!botId) continue;
      useBotActivityWatermarkStore
        .getState()
        .seedWatermark(botId, canonicalActivityAt(botId, state.sessions ?? [], canonicalChatIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botIdsKey]);

  // Focused session tracking.
  const activeSessionId = useChatSessionStore((state) => state.activeSessionId);
  const setFocusedSession = useBotActivityWatermarkStore((state) => state.setFocusedSession);
  useEffect(() => {
    setFocusedSession(viewType && FOCUSED_CHAT_VIEWS.has(viewType) ? (activeSessionId ?? null) : null);
  }, [viewType, activeSessionId, setFocusedSession]);
}
