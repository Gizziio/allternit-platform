import { useMemo } from "react";
import { create } from "zustand";

import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";

import { useNativeAgentStore, type NativeSession } from "./native-agent.store";
import {
  getAgentSessionDescriptor,
  type AgentSessionDescriptor,
} from "./session-metadata";

type EmbeddedSessionMap = Record<AgentModeSurface, string | null>;

interface EmbeddedAgentSessionState {
  sessionIdBySurface: EmbeddedSessionMap;
  setSurfaceSession: (surface: AgentModeSurface, sessionId: string | null) => void;
  clearSurfaceSession: (surface: AgentModeSurface) => void;
  clearAll: () => void;
}

const DEFAULT_SESSION_MAP: EmbeddedSessionMap = {
  chat: null,
  cowork: null,
  code: null,
  browser: null,
};

export const useEmbeddedAgentSessionStore = create<EmbeddedAgentSessionState>(
  (set) => ({
    sessionIdBySurface: DEFAULT_SESSION_MAP,
    setSurfaceSession: (surface, sessionId) =>
      set((state) => ({
        sessionIdBySurface: {
          ...state.sessionIdBySurface,
          [surface]: sessionId,
        },
      })),
    clearSurfaceSession: (surface) =>
      set((state) => ({
        sessionIdBySurface: {
          ...state.sessionIdBySurface,
          [surface]: null,
        },
      })),
    clearAll: () => set({ sessionIdBySurface: DEFAULT_SESSION_MAP }),
  }),
);

export interface EmbeddedAgentSessionContext {
  sessionId: string | null;
  session: NativeSession | null;
  descriptor: AgentSessionDescriptor;
  isEmbedded: boolean;
}

export function useEmbeddedAgentSession(
  surface: AgentModeSurface,
): EmbeddedAgentSessionContext {
  const sessionId = useEmbeddedAgentSessionStore(
    (state) => state.sessionIdBySurface[surface],
  );
  const sessions = useNativeAgentStore((state) => state.sessions);

  const session = useMemo(
    () => (sessionId ? sessions.find((item) => item.id === sessionId) ?? null : null),
    [sessionId, sessions],
  );

  const descriptor = useMemo(
    () => getAgentSessionDescriptor(session?.metadata),
    [session?.metadata],
  );

  return {
    sessionId,
    session,
    descriptor,
    isEmbedded: Boolean(sessionId && session),
  };
}
