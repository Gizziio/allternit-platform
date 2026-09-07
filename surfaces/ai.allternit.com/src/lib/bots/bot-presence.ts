/**
 * Bot Presence
 *
 * Derives per-bot presence for the TEAMMATES rail section (spec Phase 1) from
 * existing stores — no new backend. Presence windows follow Hermes' lean
 * model: a bot is 'working' while its canonical chat turn is streaming,
 * 'active' within ACTIVE_WINDOW_S of its last activity (canonical chat
 * update or routine run), and 'idle' otherwise. Attention state deliberately
 * does NOT affect presence — badges and presence are separate concerns.
 *
 * @module bot-presence
 */

import { useCallback } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { useBotRosterStore } from './bot-roster.store';
import { useBotRoutineStore } from './bot-routine.service';

/** Presence window: activity newer than this counts as 'active' (90s). */
export const ACTIVE_WINDOW_S = 90_000;

export type BotPresence = 'working' | 'active' | 'idle';

export interface BotPresenceState {
  presence: BotPresence;
  /** Epoch ms of the last observed activity, 0 when never observed. */
  lastActivityAt: number;
}

const IDLE: BotPresenceState = { presence: 'idle', lastActivityAt: 0 };

export interface PresenceSources {
  /** Canonical chat turn currently streaming. */
  streaming: boolean;
  /** Canonical chat session's last update, epoch ms. */
  sessionActivityAt: number;
  /** Latest routine run for the bot, epoch ms. */
  routineActivityAt: number;
}

/** Pure presence derivation (exported for batch consumers like the rail). */
export function deriveBotPresence(sources: PresenceSources, now: number = Date.now()): BotPresenceState {
  const lastActivityAt = Math.max(sources.sessionActivityAt, sources.routineActivityAt);
  if (sources.streaming) return { presence: 'working', lastActivityAt };
  if (lastActivityAt > 0 && now - lastActivityAt < ACTIVE_WINDOW_S) {
    return { presence: 'active', lastActivityAt };
  }
  return { presence: 'idle', lastActivityAt };
}

/**
 * Presence for a single bot, recomputed when any source store changes.
 * Pure derivation + shallow equality, so re-renders stay cheap.
 */
export function useBotPresence(botId: string | null): BotPresenceState {
  const canonicalChatId = useBotRosterStore((state) =>
    botId ? (state.canonicalChatIds[botId] ?? null) : null,
  );

  const chatDerived = useStoreWithEqualityFn(
    useChatSessionStore,
    useCallback(
      (state): { streaming: boolean; sessionActivityAt: number } => {
        if (!canonicalChatId) return { streaming: false, sessionActivityAt: 0 };
        const streaming = state.streamingBySession[canonicalChatId]?.isStreaming ?? false;
        const session = (state.sessions ?? []).find((s) => s.id === canonicalChatId);
        return {
          streaming,
          sessionActivityAt: session ? new Date(session.updatedAt || 0).getTime() : 0,
        };
      },
      [canonicalChatId],
    ),
    shallow,
  );

  const routineActivityAt = useBotRoutineStore((state) => {
    if (!botId) return 0;
    let latest = 0;
    for (const routine of Object.values(state.routines)) {
      if (routine.botId !== botId) continue;
      if (routine.lastRunAt && routine.lastRunAt > latest) latest = routine.lastRunAt;
    }
    return latest;
  });

  if (!botId) return IDLE;
  return deriveBotPresence({ ...chatDerived, routineActivityAt });
}
