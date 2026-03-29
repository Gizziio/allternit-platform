/**
 * Surface session mapping — re-exported from NativeAgentStore.
 *
 * The state previously owned by this file's `useEmbeddedAgentSessionStore`
 * has been folded into NativeAgentStore (`sessionIdBySurface`).  This file
 * now re-exports the hook and the store accessor so all existing callers
 * continue to work without modification.
 */

import { useMemo } from "react";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import { useNativeAgentStore, type NativeSession } from "./native-agent.store";
import {
  getAgentSessionDescriptor,
  type AgentSessionDescriptor,
} from "./session-metadata";

// ---------------------------------------------------------------------------
// useEmbeddedAgentSessionStore — compatibility shim backed by NativeAgentStore
// ---------------------------------------------------------------------------

type EmbeddedSessionStoreApi = {
  sessionIdBySurface: Record<AgentModeSurface, string | null>;
  setSurfaceSession: (surface: AgentModeSurface, sessionId: string | null) => void;
  clearSurfaceSession: (surface: AgentModeSurface) => void;
  clearAll: () => void;
};

/**
 * Drop-in replacement for the old `useEmbeddedAgentSessionStore`.
 * Reads/writes surface session IDs directly from NativeAgentStore.
 */
export function useEmbeddedAgentSessionStore<T>(
  selector?: (state: EmbeddedSessionStoreApi) => T,
): T | EmbeddedSessionStoreApi {
  const sessionIdBySurface = useNativeAgentStore((s) => s.sessionIdBySurface);
  const setSurfaceSession = useNativeAgentStore((s) => s.setSurfaceSession);
  const clearSurfaceSession = useNativeAgentStore((s) => s.clearSurfaceSession);
  const clearAllSurfaceSessions = useNativeAgentStore((s) => s.clearAllSurfaceSessions);

  const state: EmbeddedSessionStoreApi = useMemo(
    () => ({
      sessionIdBySurface,
      setSurfaceSession,
      clearSurfaceSession,
      clearAll: clearAllSurfaceSessions,
    }),
    [sessionIdBySurface, setSurfaceSession, clearSurfaceSession, clearAllSurfaceSessions],
  );

  return selector ? selector(state) : state;
}

// Expose a static getState() accessor so non-React callers continue to work.
useEmbeddedAgentSessionStore.getState = (): EmbeddedSessionStoreApi => {
  const s = useNativeAgentStore.getState();
  return {
    sessionIdBySurface: s.sessionIdBySurface,
    setSurfaceSession: s.setSurfaceSession,
    clearSurfaceSession: s.clearSurfaceSession,
    clearAll: s.clearAllSurfaceSessions,
  };
};

// ---------------------------------------------------------------------------
// useEmbeddedAgentSession — unchanged public API
// ---------------------------------------------------------------------------

export interface EmbeddedAgentSessionContext {
  sessionId: string | null;
  session: NativeSession | null;
  descriptor: AgentSessionDescriptor;
  isEmbedded: boolean;
}

export function useEmbeddedAgentSession(
  surface: AgentModeSurface,
): EmbeddedAgentSessionContext {
  const sessionId = useNativeAgentStore(
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
