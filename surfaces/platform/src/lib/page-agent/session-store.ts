/**
 * Page-Agent Session Store
 *
 * In-memory store for active page-agent sessions.
 * Each session tracks SSE subscribers and an abort controller.
 */

export interface PageAgentEvent {
  id: string;
  type: string;
  payload?: unknown;
  timestamp: number;
}

export interface PageAgentSession {
  sessionId: string;
  task: string;
  startedAt: number;
  subscribers: Set<(event: PageAgentEvent) => void>;
  abortController: AbortController;
}

const sessions = new Map<string, PageAgentSession>();

export function createSession(sessionId: string, task: string): PageAgentSession {
  const session: PageAgentSession = {
    sessionId,
    task,
    startedAt: Date.now(),
    subscribers: new Set(),
    abortController: new AbortController(),
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): PageAgentSession | undefined {
  return sessions.get(sessionId);
}

export function destroySession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.abortController.abort();
    session.subscribers.clear();
    sessions.delete(sessionId);
  }
}

export function broadcast(sessionId: string, event: PageAgentEvent): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  for (const sub of session.subscribers) {
    try { sub(event); } catch { /* subscriber closed */ }
  }
}

export function subscribe(
  sessionId: string,
  handler: (event: PageAgentEvent) => void,
): () => void {
  const session = sessions.get(sessionId);
  if (!session) return () => {};
  session.subscribers.add(handler);
  return () => session.subscribers.delete(handler);
}
