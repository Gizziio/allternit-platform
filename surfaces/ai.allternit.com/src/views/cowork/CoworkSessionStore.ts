/**
 * Cowork Session Store (Production Implementation)
 * 
 * Owns all cowork-mode sessions completely independently from Chat and Code.
 * Like Claude Desktop's "Projects" tab - sessions here don't appear in Chat.
 * 
 * PRODUCTION FEATURES:
 * - Automatic agent workspace loading
 * - SOUL.md trust tier enforcement
 * - HEARTBEAT.md task execution (optimized for cowork workflows)
 * - Context sent with every message
 * 
 * Cowork mode is optimized for:
 * - Longer running tasks
 * - Artifacts and workspace integration
 * - Computer use capabilities
 * 
 * @module CoworkSessionStore
 */

import {
  createModeSessionStore, 
  type ModeSession, 
  type CreateModeSessionOptions,
  type SendMessageOptions,
} from '@/lib/agents/mode-session-store';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CoworkSessionStore');

export type { 
  ModeSession as CoworkSession, 
  CreateModeSessionOptions as CreateCoworkSessionOptions,
  SendMessageOptions as CoworkSendMessageOptions,
};

export const useCoworkSessionStore = createModeSessionStore({
  name: 'CoworkSessionStore',
  storageKey: 'allternit-cowork-sessions',
  originSurface: 'cowork',
});

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

function useCoworkSessions() {
  return useCoworkSessionStore((state) => state.sessions ?? []);
}

function useActiveCoworkSession() {
  return useCoworkSessionStore((state) => {
    if (!state.activeSessionId) return null;
    return (state.sessions ?? []).find((s) => s.id === state.activeSessionId) || null;
  });
}

function useActiveCoworkSessionId() {
  return useCoworkSessionStore((state) => state.activeSessionId);
}

function useIsCoworkSessionLoading() {
  return useCoworkSessionStore((state) => state.isLoading);
}

function useCoworkSessionError() {
  return useCoworkSessionStore((state) => state.error);
}

// ---------------------------------------------------------------------------
// Helper: Get agent sessions only
// ---------------------------------------------------------------------------

function useAgentCoworkSessions() {
  return useCoworkSessionStore((state) => 
    state.sessions.filter((s) => s.metadata.sessionMode === 'agent')
  );
}

// ---------------------------------------------------------------------------
// Helper: Get sessions by task
// ---------------------------------------------------------------------------

function useCoworkSessionsByTask(taskId: string | null) {
  return useCoworkSessionStore((state) => {
    if (!taskId) return state.sessions;
    return state.sessions.filter((s) => s.metadata.taskId === taskId);
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function useCoworkSessionActions() {
  return useCoworkSessionStore((state) => ({
    createSession: state.createSession,
    deleteSession: state.deleteSession,
    updateSession: state.updateSession,
    setActiveSession: state.setActiveSession,
    sendMessage: state.sendMessage,
    sendMessageStream: state.sendMessageStream,
    loadSessions: state.loadSessions,
    refreshContext: state.refreshContext,
    setSessionMode: state.setSessionMode,
  }));
}

// ---------------------------------------------------------------------------
// Persistence bridge — creates a gizzi session AND syncs to Prisma + injects memory
// ---------------------------------------------------------------------------

export async function createCoworkSession(options?: CreateModeSessionOptions): Promise<string> {
  const sessionId = await useCoworkSessionStore.getState().createSession(options);

  // Sync to Prisma cowork sessions table (fire-and-forget, non-blocking).
  // The backend mints its own row id, so remember it on the session record —
  // the unmount checkpoint PATCH must target this server id, not the local
  // mode-session id, which the cowork_sessions table never contains.
  fetch('/api/v1/cowork/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: options?.name ?? 'New Cowork Session',
      projectId: options?.projectId ?? null,
      status: 'active',
      mode: options?.sessionMode === 'agent' ? 'agent' : 'regular',
      // The A:// DAG linkage keys the session run by the native chat id —
      // without it the agent-chat bridge cannot resolve row → run, and the
      // POST is the idempotency key for session rows (reposts return the
      // existing row instead of duplicating it).
      nativeSessionId: sessionId,
    }),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(async (data: { session?: { id?: string } }) => {
      const serverId = data?.session?.id;
      if (!serverId) return;
      // updateSession merges metadata, so only the new key is passed — a full
      // snapshot here could clobber memoryContext written by the fetch below.
      await useCoworkSessionStore.getState().updateSession(sessionId, {
        metadata: { coworkServerId: serverId },
      });
    })
    .catch((err) => { logger.error({ err: err }, 'Failed to persist session to server'); });

  // Inject memory context — use semantic search when we have a task name, else formatted context list
  const taskName = options?.name;
  const memoryUrl = taskName
    ? `/api/v1/cowork/memory/search?query=${encodeURIComponent(taskName)}&limit=10`
    : `/api/v1/cowork/memory?limit=10&format=context`;

  fetch(memoryUrl)
    .then((r) => r.json())
    .then((data: { results?: Array<{ content: string }>; context?: string; entries?: Array<{ content: string }> }) => {
      let memoryContext = '';
      if (data.context) {
        memoryContext = data.context;
      } else if (data.results?.length) {
        memoryContext = `Relevant memory:\n${data.results.map((r) => r.content).join('\n')}`;
      } else if (data.entries?.length) {
        memoryContext = data.entries.map((e) => e.content).join('\n---\n');
      }
      if (!memoryContext) return;
      // No metadata snapshot spread here: updateSession already merges, and a
      // stale snapshot could drop keys written concurrently (coworkServerId).
      useCoworkSessionStore.getState().updateSession(sessionId, {
        metadata: { originSurface: 'cowork', memoryContext },
      });
    })
    .catch((err) => { logger.error({ err: err }, 'Failed to fetch memory context'); });

  return sessionId;
}
