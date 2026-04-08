import type { NativeSession } from "./native-agent.store";
import { getAgentSessionDescriptor } from "./session-metadata";

export function getChatSessions(sessions: NativeSession[]): NativeSession[] {
  return sessions.filter((session) => {
    const descriptor = getAgentSessionDescriptor(session.metadata);
    return !descriptor.originSurface || descriptor.originSurface === "chat";
  });
}

export function getChatSessionsForProject(
  sessions: NativeSession[],
  projectId: string,
): NativeSession[] {
  if (!projectId) return [];

  return getChatSessions(sessions).filter(
    (session) => getAgentSessionDescriptor(session.metadata).projectId === projectId,
  );
}

export function getRootChatSessions(sessions: NativeSession[]): NativeSession[] {
  return getChatSessions(sessions).filter(
    (session) => !getAgentSessionDescriptor(session.metadata).projectId,
  );
}

export function getCodeSessions(sessions: NativeSession[]): NativeSession[] {
  return sessions.filter((session) => {
    const descriptor = getAgentSessionDescriptor(session.metadata);
    return descriptor.originSurface === "code";
  });
}

export function getCodeSessionsForWorkspace(
  sessions: NativeSession[],
  workspaceId: string,
): NativeSession[] {
  if (!workspaceId) return [];

  return getCodeSessions(sessions).filter(
    (session) => (session.metadata as any)?.workspaceId === workspaceId,
  );
}

export function getCodeAgentSessions(
  sessions: NativeSession[],
): NativeSession[] {
  return getCodeSessions(sessions).filter(
    (session) => getAgentSessionDescriptor(session.metadata).sessionMode === "agent",
  );
}

export function getSessionProjectId(
  session: NativeSession,
): string | undefined {
  return getAgentSessionDescriptor(session.metadata).projectId;
}

export function getSessionWorkspaceId(
  session: NativeSession,
): string | undefined {
  const workspaceId = (session.metadata as any)?.workspaceId;
  return typeof workspaceId === "string" && workspaceId.trim().length > 0
    ? workspaceId
    : undefined;
}

export function buildItemIdsByContainer<T extends { id: string; projectId?: string }>(
  items: T[],
): Map<string, string[]> {
  const idsByContainer = new Map<string, string[]>();
  items.forEach((item) => {
    if (!item.projectId) return;
    const nextIds = idsByContainer.get(item.projectId) ?? [];
    nextIds.push(item.id);
    idsByContainer.set(item.projectId, nextIds);
  });
  return idsByContainer;
}
