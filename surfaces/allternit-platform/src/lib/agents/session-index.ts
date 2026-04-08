import { useMemo } from "react";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { useNativeAgentStore, type NativeSession } from "./native-agent.store";
import {
  getAgentSessionDescriptor,
  deriveSessionDisplayTitle,
  formatAgentSessionMetaLabel,
  type AgentSessionDescriptor,
} from "./session-metadata";

type SessionIndexSource = {
  sessions: NativeSession[];
  activeSessionId: string | null;
};

export interface SessionIndexEntry {
  id: string;
  title: string;
  updatedAt: number;
  session: NativeSession;
  isActive: boolean;
  descriptor: AgentSessionDescriptor;
  metaLabel: string | undefined;
}

export interface SessionIndexSnapshot {
  activeSessionId: string | null;
  entries: SessionIndexEntry[];
}

function toTimestamp(value: string | number | undefined | null): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function buildSessionIndexSnapshot(
  state: SessionIndexSource,
): SessionIndexSnapshot {
  const { sessions, activeSessionId } = state;
  return {
    activeSessionId,
    entries: sessions.map((session) => {
      const descriptor = getAgentSessionDescriptor(session.metadata);
      return {
        id: session.id,
        title: deriveSessionDisplayTitle(session.name, session.metadata),
        updatedAt: toTimestamp(session.updatedAt),
        session,
        isActive: session.id === activeSessionId,
        descriptor,
        metaLabel: formatAgentSessionMetaLabel(session.metadata),
      };
    }),
  };
}

export function useSessionIndexSnapshot(): SessionIndexSnapshot {
  return useStoreWithEqualityFn(
    useNativeAgentStore,
    (state) =>
      buildSessionIndexSnapshot({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    shallow,
  );
}

export function useSessionIndexEntries(): SessionIndexEntry[] {
  return useSessionIndexSnapshot().entries;
}

export function useActiveSessionIndexEntry(): SessionIndexEntry | null {
  const { entries, activeSessionId } = useSessionIndexSnapshot();
  return useMemo(
    () => entries.find((entry) => entry.id === activeSessionId) ?? null,
    [activeSessionId, entries],
  );
}

export function filterSessionIndexBySurface(
  entries: SessionIndexEntry[],
  surface: "chat" | "cowork" | "code" | "browser",
): SessionIndexEntry[] {
  return entries.filter((entry) => {
    if (surface === "chat") {
      return !entry.descriptor.originSurface || entry.descriptor.originSurface === "chat";
    }
    return entry.descriptor.originSurface === surface;
  });
}
