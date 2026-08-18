/**
 * Bot Session Store
 *
 * Manages bounded bot sessions and their associated WIHs. Sessions partition a
 * bot's durable activity into bounded contexts, each with its own context budget,
 * summary, and lifecycle. The store is persisted locally; Wave 3 will reconcile
 * it with the server-owned session API.
 *
 * @module bot-session-store
 */

'use client';

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { createModuleLogger } from '@/lib/logger';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';
import {
  BotSessionSchema,
  WIHSchema,
  type BotSession,
  type WIH,
  type BotSessionStatus,
  createWIHFromGoal,
  createBotSession,
} from './wih-session-contracts';
import type { Goal, Plan } from './goal-task-contracts';

const logger = createModuleLogger('BotSessionStore');

// ============================================================================
// Store State
// ============================================================================

interface BotSessionStoreState {
  /** Sessions keyed by sessionId */
  sessions: Record<string, BotSession>;
  /** WIHs keyed by wihId */
  wihs: Record<string, WIH>;
  /** Active session id per bot */
  activeSessionIdByBot: Record<string, string | undefined>;

  // ── Session actions ────────────────────────────────────────────────────────

  /** Create and store a new bounded session. */
  createSession: (botId: string, title: string, projectId?: string) => BotSession;

  /** Close a session and optionally write a summary. */
  closeSession: (sessionId: string) => void;

  /** Mark a session as active for a bot. */
  setActiveSession: (botId: string, sessionId: string | undefined) => void;

  /** Update a session's summary. */
  setSessionSummary: (sessionId: string, summary: BotSession['summary']) => void;

  /** Update a session's context budget. */
  setSessionContextBudget: (sessionId: string, budget: BotSession['contextBudget']) => void;

  // ── WIH actions ────────────────────────────────────────────────────────────

  /**
   * Materialize a WIH when a structured plan is accepted. Links the WIH to the
   * bot's active session (creating a session if none is active).
   */
  materializeWIH: (
    botId: string,
    goal: Goal,
    plan: Plan,
    options?: { sessionId?: string; projectId?: string },
  ) => WIH;

  /** Update a WIH's status and current task. */
  updateWIH: (wihId: string, patch: Partial<WIH>) => void;

  // ── Selectors ──────────────────────────────────────────────────────────────

  getSession: (sessionId: string) => BotSession | null;
  getWIH: (wihId: string) => WIH | null;
  getActiveSession: (botId: string) => BotSession | null;
  getWIHsForSession: (sessionId: string) => WIH[];
  getActiveWIH: (botId: string) => WIH | null;
}

// ============================================================================
// Store
// ============================================================================

export const useBotSessionStore = create<BotSessionStoreState>()(
  devtools(
    persist(
      (set, get) => ({
      sessions: {},
      wihs: {},
      activeSessionIdByBot: {},

      createSession: (botId, title, projectId) => {
        const session = createBotSession(
          `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          botId,
          title,
          projectId,
        );
        set(
          (state) => ({
            sessions: { ...state.sessions, [session.id]: session },
            activeSessionIdByBot: { ...state.activeSessionIdByBot, [botId]: session.id },
          }),
          false,
          'createSession',
        );
        logger.info({ sessionId: session.id, botId }, 'Bot session created');
        return session;
      },

      closeSession: (sessionId) => {
        set(
          (state) => {
            const session = state.sessions[sessionId];
            if (!session) return state;
            const now = new Date().toISOString();
            const closed: BotSession = {
              ...session,
              status: 'closed',
              updatedAt: now,
              closedAt: now,
            };
            return { sessions: { ...state.sessions, [sessionId]: closed } };
          },
          false,
          'closeSession',
        );
        logger.info({ sessionId }, 'Bot session closed');
      },

      setActiveSession: (botId, sessionId) => {
        set(
          (state) => ({
            activeSessionIdByBot: { ...state.activeSessionIdByBot, [botId]: sessionId },
          }),
          false,
          'setActiveSession',
        );
      },

      setSessionSummary: (sessionId, summary) => {
        set(
          (state) => {
            const session = state.sessions[sessionId];
            if (!session) return state;
            return {
              sessions: {
                ...state.sessions,
                [sessionId]: { ...session, summary, updatedAt: new Date().toISOString() },
              },
            };
          },
          false,
          'setSessionSummary',
        );
      },

      setSessionContextBudget: (sessionId, contextBudget) => {
        set(
          (state) => {
            const session = state.sessions[sessionId];
            if (!session) return state;
            return {
              sessions: {
                ...state.sessions,
                [sessionId]: { ...session, contextBudget, updatedAt: new Date().toISOString() },
              },
            };
          },
          false,
          'setSessionContextBudget',
        );
      },

      materializeWIH: (botId, goal, plan, options = {}) => {
        let sessionId = options.sessionId;
        if (!sessionId) {
          const active = get().getActiveSession(botId);
          if (active) {
            sessionId = active.id;
          }
        }
        if (!sessionId || !get().sessions[sessionId]) {
          const newSession = get().createSession(botId, goal.objective, options.projectId);
          sessionId = newSession.id;
        }

        const wihId = `wih_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const wih = createWIHFromGoal(
          wihId,
          sessionId,
          goal.id,
          plan.taskGraph.id,
          goal.objective,
          botId,
          options.projectId,
          {
            status: 'active',
            tools: goal.constraints,
            validationCriteria: goal.validationCriteria,
            budget: goal.budget,
          },
        );

        set(
          (state) => {
            const session = state.sessions[sessionId!];
            if (!session) return state;
            return {
              wihs: { ...state.wihs, [wih.id]: wih },
              sessions: {
                ...state.sessions,
                [sessionId!]: {
                  ...session,
                  goalIds: [...session.goalIds, goal.id],
                  wihIds: [...session.wihIds, wih.id],
                  currentWihId: wih.id,
                  lastActivityAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              },
              activeSessionIdByBot: { ...state.activeSessionIdByBot, [botId]: sessionId },
            };
          },
          false,
          'materializeWIH',
        );

        logger.info({ wihId, sessionId, goalId: goal.id, botId }, 'WIH materialized');
        return wih;
      },

      updateWIH: (wihId, patch) => {
        set(
          (state) => {
            const wih = state.wihs[wihId];
            if (!wih) return state;
            const updated: WIH = { ...wih, ...patch, updatedAt: new Date().toISOString() };
            return { wihs: { ...state.wihs, [wihId]: updated } };
          },
          false,
          'updateWIH',
        );
      },

      getSession: (sessionId) => get().sessions[sessionId] ?? null,

      getWIH: (wihId) => get().wihs[wihId] ?? null,

      getActiveSession: (botId) => {
        const sessionId = get().activeSessionIdByBot[botId];
        if (!sessionId) return null;
        return get().sessions[sessionId] ?? null;
      },

      getWIHsForSession: (sessionId) =>
        Object.values(get().wihs).filter((w) => w.sessionId === sessionId),

      getActiveWIH: (botId) => {
        const session = get().getActiveSession(botId);
        if (!session?.currentWihId) return null;
        return get().wihs[session.currentWihId] ?? null;
      },

      /**
       * Return the bounded context for a session: identity, summary, and promoted
       * memory candidates. Does NOT include raw transcript events, enforcing the
       * no-raw-prior-transcript rule.
       */
      getSessionContext: (sessionId: string) => {
        const session = get().sessions[sessionId];
        if (!session) return null;
        return {
          sessionId: session.id,
          botId: session.botId,
          projectId: session.projectId,
          title: session.title,
          status: session.status,
          summary: session.summary,
          memoryCandidates: session.summary?.memoryCandidates ?? [],
          contextBudget: session.contextBudget,
        };
      },
    }),
    {
      name: 'allternit-bot-session-store-v1',
      storage: createBrowserJSONStorage(),
      partialize: (state) => ({
        sessions: state.sessions,
        wihs: state.wihs,
        activeSessionIdByBot: state.activeSessionIdByBot,
      }),
    },
  ),
  { name: 'BotSessionStore' },
));
