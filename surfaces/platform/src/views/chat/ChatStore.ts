/**
 * ChatStore — compatibility adapter over NativeAgentStore.
 *
 * Thread state (threads, activeThreadId) is no longer owned here.
 * It is kept in sync from NativeAgentStore via a subscription so that all
 * existing callers of useChatStore() continue to work without modification.
 *
 * Project state (projects, sandboxMode, activeProjectId) remains owned here
 * and is persisted to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildAgentSessionMetadata,
  createCanonicalSession,
  getChatSessions,
  getAgentSessionDescriptor,
} from '@/lib/agents';
import { useNativeAgentStore, type NativeSession } from '@/lib/agents/native-agent.store';
import * as kernelProjects from '../../integration/kernel/projects';

// ---------------------------------------------------------------------------
// Types (preserved for callers)
// ---------------------------------------------------------------------------

export interface ChatThread {
  id: string;
  title: string;
  projectId?: string;
  mode?: ChatThreadMode;
  agentId?: string;
  updatedAt: number;
}

export type ChatThreadMode = 'llm' | 'agent';

export interface ProjectFile {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: number;
}

export interface ChatProject {
  id: string;
  localKey?: string;
  title: string;
  threadIds: string[];
  files: ProjectFile[];
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Session → ChatThread mapper
// ---------------------------------------------------------------------------

function mapSession(s: NativeSession): ChatThread {
  const descriptor = getAgentSessionDescriptor(s.metadata);
  return {
    id: s.id,
    title: s.name ?? 'Untitled',
    // AgentSessionMode uses "regular" where ChatThreadMode uses "llm"
    mode: descriptor.sessionMode === 'agent' ? 'agent' : 'llm',
    agentId: descriptor.agentId,
    updatedAt: new Date(s.updatedAt).getTime(),
  };
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface ChatState {
  // Derived from NativeAgentStore — updated by subscription below
  threads: ChatThread[];
  activeThreadId: string | null;

  // ChatStore-owned state
  projects: ChatProject[];
  sandboxMode: 'read-only' | 'full';
  activeProjectId: string | null;
  activeProjectLocalKey: string | null;

  // Thread ops — delegate to NativeAgentStore
  createThread: (
    title: string,
    projectId?: string,
    mode?: ChatThreadMode,
    agentId?: string | null,
  ) => Promise<string>;
  deleteThread: (id: string) => void;
  renameThread: (id: string, title: string) => void;
  setThreadMode: (id: string, mode: ChatThreadMode, agentId?: string | null) => void;
  setActiveThread: (id: string | null) => void;
  setSandboxMode: (mode: 'read-only' | 'full') => void;

  // Project ops
  createProject: (title: string) => Promise<string>;
  deleteProject: (id: string) => void;
  renameProject: (id: string, title: string) => void;
  setActiveProject: (id: string | null, localKey?: string | null) => void;
  moveThreadToProject: (threadId: string, projectId: string | null) => void;
  addFileToProject: (projectId: string, file: Omit<ProjectFile, 'id' | 'addedAt'>) => void;
  removeFileFromProject: (projectId: string, fileId: string) => void;

  // Internal — called by the NativeAgentStore subscription
  _syncFromNative: (sessions: NativeSession[], activeSessionId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      // Derived — initialized empty; subscription fills these in immediately.
      threads: [],
      activeThreadId: null,

      // Owned
      projects: [],
      sandboxMode: 'read-only',
      activeProjectId: null,
      activeProjectLocalKey: null,

      // Thread ops
      createThread: async (title, projectId, mode = 'llm', agentId = null) => {
        const session = await createCanonicalSession(
          title,
          undefined,
          {
            // ChatThreadMode "llm" maps to AgentSessionMode "regular"
            sessionMode: mode === 'agent' ? 'agent' : 'regular',
            agentId: agentId ?? undefined,
            projectId,
          },
        );
        set({ activeProjectId: null, activeProjectLocalKey: null });
        return session.id;
      },

      deleteThread: (id) => {
        void useNativeAgentStore.getState().deleteSession(id);
      },

      renameThread: (id, title) => {
        void useNativeAgentStore.getState().updateSession(id, { name: title });
      },

      setThreadMode: (id, mode, agentId = null) => {
        const session = useNativeAgentStore
          .getState()
          .sessions.find((s) => s.id === id);
        void useNativeAgentStore.getState().updateSession(id, {
          metadata: buildAgentSessionMetadata({
            metadata: session?.metadata ?? {},
            sessionMode: mode === 'agent' ? 'agent' : 'regular',
            agentId: agentId ?? undefined,
          }),
        });
      },

      setActiveThread: (id) => {
        useNativeAgentStore.getState().setActiveSession(id);
        set({ activeProjectId: null, activeProjectLocalKey: null });
      },

      setSandboxMode: (mode) => set({ sandboxMode: mode }),

      // Project ops
      createProject: async (title) => {
        let id: string;
        try {
          const proj = await kernelProjects.createProject(title);
          id = proj.id;
        } catch {
          id = `local-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }
        const localKey = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          projects: [
            { id, localKey, title, threadIds: [], files: [], createdAt: Date.now() },
            ...state.projects,
          ],
          activeProjectId: id,
          activeProjectLocalKey: localKey,
          activeThreadId: null,
        }));
        return id;
      },

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
          activeProjectLocalKey:
            state.activeProjectId === id ? null : state.activeProjectLocalKey,
        })),

      renameProject: (id, title) =>
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, title } : p)),
        })),

      setActiveProject: (id, localKey = null) =>
        set((state) => ({
          activeProjectId: id,
          activeProjectLocalKey:
            id === null
              ? null
              : localKey ??
                state.projects.find((p) => p.id === id)?.localKey ??
                null,
          activeThreadId: null,
        })),

      moveThreadToProject: (threadId, projectId) =>
        set((state) => {
          // Remove from every project's threadIds, then add to the target project.
          const projects = state.projects.map((p) => {
            const withoutThread = p.threadIds.filter((id) => id !== threadId);
            if (projectId !== null && p.id === projectId) {
              return {
                ...p,
                threadIds: withoutThread.includes(threadId)
                  ? withoutThread
                  : [...withoutThread, threadId],
              };
            }
            return { ...p, threadIds: withoutThread };
          });
          const session = useNativeAgentStore
            .getState()
            .sessions.find((s) => s.id === threadId);
          void useNativeAgentStore.getState().updateSession(threadId, {
            metadata: buildAgentSessionMetadata({
              metadata: session?.metadata ?? {},
              projectId: projectId ?? undefined,
            }),
          });
          return { projects };
        }),

      addFileToProject: (projectId, file) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  files: [
                    ...p.files,
                    {
                      ...file,
                      id: Math.random().toString(36).substring(7),
                      addedAt: Date.now(),
                    },
                  ],
                }
              : p,
          ),
        })),

      removeFileFromProject: (projectId, fileId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, files: p.files.filter((f) => f.id !== fileId) }
              : p,
          ),
        })),

      _syncFromNative: (sessions, activeSessionId) => {
        const chatSessions = getChatSessions(sessions);
        set({ threads: chatSessions.map(mapSession), activeThreadId: activeSessionId });
      },
    }),
    {
      name: 'allternit-chat-storage-v6',
      partialize: (state) => ({
        projects: state.projects,
        // activeProjectId is intentionally NOT persisted — it's navigation state.
        // Restoring it across sessions caused the chat view to always open to
        // ProjectView on startup.
        sandboxMode: state.sandboxMode,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Sync threads and activeThreadId from NativeAgentStore
// ---------------------------------------------------------------------------

useNativeAgentStore.subscribe((state) => {
  useChatStore.getState()._syncFromNative(state.sessions, state.activeSessionId);
});
