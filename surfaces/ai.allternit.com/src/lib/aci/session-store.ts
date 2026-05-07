/**
 * ACI Session Store
 *
 * In-memory store for active run sessions.
 * Sessions are keyed by sessionId (UUID).
 * Each session holds the adapter, run state, SSE subscribers, and approval gate.
 */

import type { RunSession, RunState, SseEvent } from './types';

const sessions = new Map<string, RunSession>();

export function createSession(
  sessionId: string,
  goal: string,
  adapter: RunSession['adapter'],
): RunSession {
  const state: RunState = {
    sessionId,
    status: 'Idle',
    goal,
    adapterId: adapter.adapterId,
    currentAction: null,
    screenshot: null,
    lastMessage: null,
    stepIndex: 0,
    totalSteps: null,
    error: null,
    elapsedMs: 0,
    receipts: 0,
  };

  const session: RunSession = {
    sessionId,
    goal,
    adapter,
    state,
    pendingAction: null,
    approvalPromise: null,
    approvalResolve: null,
    subscribers: new Set(),
    startedAt: Date.now(),
    abortController: new AbortController(),
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): RunSession | undefined {
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

export function listSessions(): string[] {
  return [...sessions.keys()];
}

/** Broadcast an SSE event to all subscribers of a session */
export function broadcast(sessionId: string, event: SseEvent): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  for (const sub of session.subscribers) {
    try { sub(event); } catch { /* subscriber closed */ }
  }
}

/** Subscribe to SSE events for a session. Returns unsubscribe fn. */
export function subscribe(
  sessionId: string,
  handler: (event: SseEvent) => void,
): () => void {
  const session = sessions.get(sessionId);
  if (!session) return () => {};
  session.subscribers.add(handler);
  return () => session.subscribers.delete(handler);
}
