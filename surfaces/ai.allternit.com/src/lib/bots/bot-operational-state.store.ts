"use client";

/**
 * Bot Operational State Projection Store
 *
 * Server-owned projection of each bot's runtime status. The client never
 * infers or fabricates status — it subscribes to a cursor-based SSE stream
 * or polls `/api/bots/:id/operational-state` and stores the authoritative
 * snapshot here.
 *
 * This store REPLACES the old client-local `run-state.store.ts` as the
 * source of truth for what every bot is doing. The old store is kept for
 * isolated sub-run bookkeeping until Wave 2 migrates it fully.
 *
 * ## Status semantics (W1-040, W1-041)
 *
 * | Status           | Meaning                                                     |
 * |------------------|-------------------------------------------------------------|
 * | idle             | No active session, run, or pending approval                 |
 * | working          | Executing a goal, task, or run                              |
 * | waiting_input    | Paused — needs user message to continue                     |
 * | waiting_approval | Paused — needs approval to proceed                          |
 * | blocked          | Blocked by a repeated blocker; manual intervention needed   |
 * | offline          | Bot daemon is unreachable or not registered                 |
 * | degraded         | Partially functional (connector/computer issue)             |
 * | failed           | Terminal failure in the last run                            |
 * | completed        | Last run/goal finished successfully                         |
 *
 * ## Precedence (W1-041)
 * waiting_approval > blocked > failed > working > waiting_input > degraded > completed > idle > offline
 *
 * @module bot-operational-state.store
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createModuleLogger } from '@/lib/logger';
import {
  type BotOperationalState,
  type BotOperationalStatus,
  BotOperationalStateSchema,
} from './orpc-contracts';
import { type GoalLoopState } from './goal-loop-controller';
import { projectOperationalStateFromGoalLoop } from './bot-operational-projection';

const logger = createModuleLogger('BotOperationalState');

// ============================================================================
// Status Precedence
// ============================================================================

const STATUS_PRECEDENCE: Record<BotOperationalStatus, number> = {
  waiting_approval: 8,
  blocked: 7,
  failed: 6,
  working: 5,
  waiting_input: 4,
  degraded: 3,
  completed: 2,
  idle: 1,
  offline: 0,
};

/**
 * When multiple status signals arrive simultaneously, pick the one with highest
 * precedence. Used internally to merge partial updates.
 */
export function dominantStatus(
  a: BotOperationalStatus,
  b: BotOperationalStatus,
): BotOperationalStatus {
  return STATUS_PRECEDENCE[a] >= STATUS_PRECEDENCE[b] ? a : b;
}

// ============================================================================
// Cursor & Subscription
// ============================================================================

export interface ProjectionCursor {
  botId: string;
  lastSequence: number;
  updatedAt: string;
}

export type SubscriptionState = 'connected' | 'reconnecting' | 'stale' | 'offline';

export interface BotProjectionEntry {
  botId: string;
  state: BotOperationalState;
  subscriptionState: SubscriptionState;
  lastFetchedAt: string;
}

// ============================================================================
// Store State
// ============================================================================

interface BotOperationalStateStoreState {
  /** Server projection snapshots, keyed by botId */
  projections: Record<string, BotProjectionEntry>;

  /** Cursors for resuming SSE/polling streams, keyed by botId */
  cursors: Record<string, ProjectionCursor>;

  /** IDs of bots currently being fetched */
  fetchingBotIds: Set<string>;

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Apply a full projection snapshot received from the server.
   * Validates via BotOperationalStateSchema before storing.
   */
  applySnapshot: (botId: string, raw: unknown) => boolean;

  /**
   * Apply a partial update (e.g. from an SSE event delta).
   * Only overwrites provided fields; merges with existing state.
   */
  applyDelta: (botId: string, delta: Partial<BotOperationalState>) => void;

  /**
   * Apply a goal-loop controller state as a partial operational-state update.
   * Server-sourced fields (lastEventSequence, computerState, nextRoutineRunAt,
   * unreadMessagesCount) are preserved from the existing projection.
   */
  applyGoalLoopState: (botId: string, loopState: GoalLoopState) => void;

  /** Mark a bot as offline when its projection cannot be reached */
  markOffline: (botId: string) => void;

  /** Mark a bot's subscription as stale (reconnecting) */
  markStale: (botId: string) => void;

  /** Mark a bot's subscription as connected */
  markConnected: (botId: string) => void;

  /** Update the resume cursor for a bot */
  setCursor: (botId: string, cursor: ProjectionCursor) => void;

  /** Mark a bot as currently being fetched */
  setFetching: (botId: string, fetching: boolean) => void;

  // ── Selectors ──────────────────────────────────────────────────────────────

  getProjection: (botId: string) => BotProjectionEntry | null;
  getStatus: (botId: string) => BotOperationalStatus;
  isWorking: (botId: string) => boolean;
  needsAttention: (botId: string) => boolean;
  hasPendingApprovals: (botId: string) => boolean;
}

// ============================================================================
// Default State
// ============================================================================

function defaultOperationalState(botId: string): BotOperationalState {
  return {
    status: 'offline',
    pendingApprovalsCount: 0,
    unreadMessagesCount: 0,
    computerState: 'none',
    lastEventSequence: 0,
    updatedAt: new Date().toISOString(),
  };
}

function defaultEntry(botId: string): BotProjectionEntry {
  return {
    botId,
    state: defaultOperationalState(botId),
    subscriptionState: 'offline',
    lastFetchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Store
// ============================================================================

export const useBotOperationalStateStore = create<BotOperationalStateStoreState>()(
  devtools(
    (set, get) => ({
      projections: {},
      cursors: {},
      fetchingBotIds: new Set(),

      // ── Actions ────────────────────────────────────────────────────────────

      applySnapshot: (botId, raw) => {
        const result = BotOperationalStateSchema.safeParse(raw);
        if (!result.success) {
          logger.warn({ botId, errors: result.error.issues }, 'Invalid projection snapshot — rejected');
          return false;
        }

        const state = result.data;
        const now = new Date().toISOString();

        set(
          (store) => ({
            projections: {
              ...store.projections,
              [botId]: {
                botId,
                state,
                subscriptionState: 'connected',
                lastFetchedAt: now,
              },
            },
            cursors: {
              ...store.cursors,
              [botId]: {
                botId,
                lastSequence: state.lastEventSequence,
                updatedAt: state.updatedAt,
              },
            },
          }),
          false,
          'applySnapshot',
        );

        logger.debug({ botId, status: state.status, seq: state.lastEventSequence }, 'Projection snapshot applied');
        return true;
      },

      applyDelta: (botId, delta) => {
        set(
          (store) => {
            const existing = store.projections[botId] ?? defaultEntry(botId);
            const merged: BotOperationalState = { ...existing.state, ...delta };

            const newEntry: BotProjectionEntry = {
              ...existing,
              state: merged,
              subscriptionState: 'connected',
              lastFetchedAt: new Date().toISOString(),
            };

            const newCursor: ProjectionCursor = {
              botId,
              lastSequence: merged.lastEventSequence,
              updatedAt: merged.updatedAt,
            };

            return {
              projections: { ...store.projections, [botId]: newEntry },
              cursors: { ...store.cursors, [botId]: newCursor },
            };
          },
          false,
          'applyDelta',
        );
      },

      applyGoalLoopState: (botId, loopState) => {
        set(
          (store) => {
            const existing = store.projections[botId] ?? defaultEntry(botId);
            const delta = projectOperationalStateFromGoalLoop(loopState);

            // Preserve server-sourced fields the loop controller does not own.
            const merged: BotOperationalState = {
              ...existing.state,
              ...delta,
              lastEventSequence: existing.state.lastEventSequence,
              computerState: existing.state.computerState,
              nextRoutineRunAt: existing.state.nextRoutineRunAt,
              unreadMessagesCount: existing.state.unreadMessagesCount,
            };

            const newEntry: BotProjectionEntry = {
              ...existing,
              state: merged,
              subscriptionState: 'connected',
              lastFetchedAt: new Date().toISOString(),
            };

            return {
              projections: { ...store.projections, [botId]: newEntry },
            };
          },
          false,
          'applyGoalLoopState',
        );

        logger.debug({ botId, status: loopState.status }, 'Goal loop state applied to projection');
      },

      markOffline: (botId) => {
        set(
          (store) => {
            const existing = store.projections[botId] ?? defaultEntry(botId);
            return {
              projections: {
                ...store.projections,
                [botId]: {
                  ...existing,
                  state: { ...existing.state, status: 'offline' as const },
                  subscriptionState: 'offline',
                },
              },
            };
          },
          false,
          'markOffline',
        );
        logger.info({ botId }, 'Bot marked offline');
      },

      markStale: (botId) => {
        set(
          (store) => {
            const existing = store.projections[botId] ?? defaultEntry(botId);
            return {
              projections: {
                ...store.projections,
                [botId]: { ...existing, subscriptionState: 'stale' },
              },
            };
          },
          false,
          'markStale',
        );
      },

      markConnected: (botId) => {
        set(
          (store) => {
            const existing = store.projections[botId] ?? defaultEntry(botId);
            return {
              projections: {
                ...store.projections,
                [botId]: { ...existing, subscriptionState: 'connected' },
              },
            };
          },
          false,
          'markConnected',
        );
      },

      setCursor: (botId, cursor) => {
        set(
          (store) => ({ cursors: { ...store.cursors, [botId]: cursor } }),
          false,
          'setCursor',
        );
      },

      setFetching: (botId, fetching) => {
        set(
          (store) => {
            const next = new Set(store.fetchingBotIds);
            if (fetching) next.add(botId);
            else next.delete(botId);
            return { fetchingBotIds: next };
          },
          false,
          'setFetching',
        );
      },

      // ── Selectors ──────────────────────────────────────────────────────────

      getProjection: (botId) => get().projections[botId] ?? null,

      getStatus: (botId) => get().projections[botId]?.state.status ?? 'offline',

      isWorking: (botId) => {
        const status = get().getStatus(botId);
        return status === 'working' || status === 'waiting_input';
      },

      needsAttention: (botId) => {
        const status = get().getStatus(botId);
        return (
          status === 'waiting_approval' ||
          status === 'blocked' ||
          status === 'failed' ||
          status === 'degraded'
        );
      },

      hasPendingApprovals: (botId) => {
        const entry = get().projections[botId];
        return (entry?.state.pendingApprovalsCount ?? 0) > 0;
      },
    }),
    { name: 'BotOperationalStateStore' },
  ),
);

// ============================================================================
// React Hook: useBotStatus
// ============================================================================

/**
 * Convenience hook — returns the canonical operational status for a bot,
 * along with whether it needs user attention.
 *
 * Callers must NOT infer bot status from local state; always use this hook.
 */
export function useBotStatus(botId: string) {
  return useBotOperationalStateStore((s) => ({
    status: s.getStatus(botId),
    isWorking: s.isWorking(botId),
    needsAttention: s.needsAttention(botId),
    hasPendingApprovals: s.hasPendingApprovals(botId),
    subscriptionState: s.projections[botId]?.subscriptionState ?? 'offline',
    projection: s.projections[botId]?.state ?? null,
  }));
}
