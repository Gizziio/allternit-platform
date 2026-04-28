/**
 * Thread Agent Session Store
 *
 * Tracks agent sub-sessions per thread for mixed LLM/agent threads.
 * When a user @mentions an agent in a thread, a sub-session is created
 * for that agent. Messages from all sub-sessions are merged into the
 * thread's transcript view.
 *
 * @module thread-agent-sessions
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThreadAgentSessionsState {
  /** threadId -> array of agent session IDs */
  threadAgentSessions: Record<string, string[]>;
  /** threadId:agentId -> sessionId (for quick lookup) */
  threadAgentSessionMap: Record<string, string>;
  /** threadId -> last @mentioned agentId (for persistent composer pill) */
  lastMentionAgentIdByThread: Record<string, string>;

  registerAgentSession: (
    threadId: string,
    agentId: string,
    sessionId: string
  ) => void;
  getAgentSessionId: (
    threadId: string,
    agentId: string
  ) => string | undefined;
  getAgentSessionsForThread: (threadId: string) => string[];
  getLastMentionAgentId: (threadId: string) => string | undefined;
  setLastMentionAgentId: (threadId: string, agentId: string) => void;
  unlinkAgentSession: (threadId: string, agentId: string) => void;
  clearThreadSessions: (threadId: string) => void;
}

function makeKey(threadId: string, agentId: string): string {
  return `${threadId}:${agentId}`;
}

export const useThreadAgentSessionsStore = create<ThreadAgentSessionsState>()(
  persist(
    (set, get) => ({
      threadAgentSessions: {},
      threadAgentSessionMap: {},
      lastMentionAgentIdByThread: {},

      registerAgentSession: (threadId, agentId, sessionId) => {
        const key = makeKey(threadId, agentId);
        set((state) => {
          const existing = state.threadAgentSessions[threadId] || [];
          const newSessions = existing.includes(sessionId)
            ? existing
            : [...existing, sessionId];
          return {
            threadAgentSessions: {
              ...state.threadAgentSessions,
              [threadId]: newSessions,
            },
            threadAgentSessionMap: {
              ...state.threadAgentSessionMap,
              [key]: sessionId,
            },
          };
        });
      },

      getAgentSessionId: (threadId, agentId) => {
        return get().threadAgentSessionMap[makeKey(threadId, agentId)];
      },

      getAgentSessionsForThread: (threadId) => {
        return get().threadAgentSessions[threadId] || [];
      },

      getLastMentionAgentId: (threadId) => {
        return get().lastMentionAgentIdByThread[threadId];
      },

      setLastMentionAgentId: (threadId, agentId) => {
        set((state) => ({
          lastMentionAgentIdByThread: {
            ...state.lastMentionAgentIdByThread,
            [threadId]: agentId,
          },
        }));
      },

      unlinkAgentSession: (threadId, agentId) => {
        const key = makeKey(threadId, agentId);
        set((state) => {
          const sessionId = state.threadAgentSessionMap[key];
          if (!sessionId) return state;
          const existing = state.threadAgentSessions[threadId] || [];
          const newSessions = existing.filter((id) => id !== sessionId);
          const nextAgentSessions = { ...state.threadAgentSessions };
          if (newSessions.length === 0) {
            delete nextAgentSessions[threadId];
          } else {
            nextAgentSessions[threadId] = newSessions;
          }
          const nextMap = { ...state.threadAgentSessionMap };
          delete nextMap[key];
          return {
            threadAgentSessions: nextAgentSessions,
            threadAgentSessionMap: nextMap,
          };
        });
      },

      clearThreadSessions: (threadId) => {
        set((state) => {
          const sessions = state.threadAgentSessions[threadId] || [];
          const nextMap = { ...state.threadAgentSessionMap };
          // Remove all entries for this thread
          Object.keys(nextMap).forEach((key) => {
            if (key.startsWith(`${threadId}:`)) {
              delete nextMap[key];
            }
          });
          const nextAgentSessions = { ...state.threadAgentSessions };
          delete nextAgentSessions[threadId];
          const nextLastMention = { ...state.lastMentionAgentIdByThread };
          delete nextLastMention[threadId];
          return {
            threadAgentSessions: nextAgentSessions,
            threadAgentSessionMap: nextMap,
            lastMentionAgentIdByThread: nextLastMention,
          };
        });
      },
    }),
    {
      name: "allternit-thread-agent-sessions",
    }
  )
);
