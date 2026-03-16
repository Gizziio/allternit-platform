import { create } from 'zustand';

export type CodeSessionMode = 'SAFE' | 'DEFAULT' | 'AUTO' | 'PLAN';
export type CodeSessionState =
  | 'IDLE'
  | 'PLANNING'
  | 'PLAN_READY'
  | 'EXECUTING'
  | 'AWAITING_APPROVAL'
  | 'CHANGESET_READY'
  | 'APPLYING'
  | 'VERIFYING'
  | 'DONE'
  | 'FAILED'
  | 'TERMINATED';
export type CodeIsolation = 'worktree' | 'sandbox';

export interface RepoStatusSnapshot {
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
  last_commit: string;
  last_commit_message: string;
  snapshot_at: string;
}

export interface CodeWorkspaceRecord {
  workspace_id: string;
  root_path: string;
  display_name: string;
  repo_status: RepoStatusSnapshot;
  context_anchor: string | null;
  sessions: string[];
}

export interface CodeSessionRecord {
  session_id: string;
  workspace_id: string;
  title: string;
  isolation: CodeIsolation;
  branch?: string;
  worktree_path?: string;
  mode: CodeSessionMode;
  state: CodeSessionState;
  policy_profile_id: string;
  wih_id: string | null;
  run_id: string | null;
  created_at: string;
  updated_at: string;
  last_event_at: string | null;
  last_error: string | null;
  pending_approvals_count: number;
  files_touched: string[];
  preview_sessions: string[];
}

export interface CodeModeStateShape {
  workspaces: CodeWorkspaceRecord[];
  sessions: CodeSessionRecord[];
  activeWorkspaceId: string;
  activeSessionId: string;
}

interface CodeModeState extends CodeModeStateShape {
  setActiveWorkspace: (workspaceId: string) => void;
  setActiveSession: (sessionId: string) => void;
  createWorkspace: (displayName: string) => string;
  createSession: (title: string, workspaceId: string, mode?: CodeSessionMode) => string;
  renameWorkspace: (workspaceId: string, displayName: string) => void;
  deleteWorkspace: (workspaceId: string) => void;
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() - offsetMinutes * 60_000).toISOString();
}

export function createInitialCodeModeState(): CodeModeStateShape {
  return {
    workspaces: [],
    sessions: [],
    activeWorkspaceId: '',
    activeSessionId: '',
  };
}

export const useCodeModeStore = create<CodeModeState>((set, get) => ({
  ...createInitialCodeModeState(),

  setActiveWorkspace: (workspaceId) =>
    set((state) => {
      const workspace = state.workspaces.find((item) => item.workspace_id === workspaceId);
      if (!workspace) {
        return state;
      }

      const nextActiveSessionId =
        workspace.sessions.find((sessionId) =>
          state.sessions.some(
            (session) =>
              session.session_id === sessionId && session.workspace_id === workspaceId,
          ),
        ) ?? state.activeSessionId;

      return {
        activeWorkspaceId: workspaceId,
        activeSessionId: nextActiveSessionId,
      };
    }),

  setActiveSession: (sessionId) =>
    set((state) => {
      const session = state.sessions.find((item) => item.session_id === sessionId);
      if (!session) {
        return state;
      }

      return {
        activeSessionId: sessionId,
        activeWorkspaceId: session.workspace_id,
      };
    }),

  createWorkspace: (displayName: string) => {
    const workspace_id = `ws_${Date.now().toString(36)}`;
    const newWorkspace: CodeWorkspaceRecord = {
      workspace_id,
      display_name: displayName,
      root_path: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech',
      repo_status: {
        branch: 'main',
        dirty: false,
        ahead: 0,
        behind: 0,
        staged_count: 0,
        unstaged_count: 0,
        untracked_count: 0,
        last_commit: '0000000',
        last_commit_message: 'initial',
        snapshot_at: new Date().toISOString(),
      },
      context_anchor: null,
      sessions: [],
    };

    set((state) => ({
      workspaces: [...state.workspaces, newWorkspace],
      activeWorkspaceId: workspace_id,
      activeSessionId: '',
    }));

    return workspace_id;
  },

  createSession: (title: string, workspaceId: string, mode: CodeSessionMode = 'DEFAULT') => {
    const session_id = `sess_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const newSession: CodeSessionRecord = {
      session_id,
      workspace_id: workspaceId,
      title,
      isolation: 'worktree',
      mode,
      state: 'IDLE',
      policy_profile_id: 'pol_default',
      wih_id: null,
      run_id: null,
      created_at: now,
      updated_at: now,
      last_event_at: null,
      last_error: null,
      pending_approvals_count: 0,
      files_touched: [],
      preview_sessions: [],
    };

    set((state) => {
      const nextWorkspaces = state.workspaces.map((w) => {
        if (w.workspace_id === workspaceId) {
          return { ...w, sessions: [...w.sessions, session_id] };
        }
        return w;
      });

      return {
        sessions: [...state.sessions, newSession],
        workspaces: nextWorkspaces,
        activeSessionId: session_id,
        activeWorkspaceId: workspaceId,
      };
    });

    return session_id;
  },

  renameWorkspace: (workspaceId, displayName) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId ? { ...w, display_name: displayName } : w,
      ),
    })),

  deleteWorkspace: (workspaceId) =>
    set((state) => {
      const nextWorkspaces = state.workspaces.filter((w) => w.workspace_id !== workspaceId);
      let nextActiveWorkspaceId = state.activeWorkspaceId;
      let nextActiveSessionId = state.activeSessionId;

      if (state.activeWorkspaceId === workspaceId) {
        nextActiveWorkspaceId = nextWorkspaces.length > 0 ? nextWorkspaces[0].workspace_id : '';
        nextActiveSessionId = nextWorkspaces.length > 0 ? nextWorkspaces[0].sessions[0] || '' : '';
      }

      return {
        workspaces: nextWorkspaces,
        sessions: state.sessions.filter((s) => s.workspace_id !== workspaceId),
        activeWorkspaceId: nextActiveWorkspaceId,
        activeSessionId: nextActiveSessionId,
      };
    }),
}));

export function getActiveWorkspace(state: CodeModeStateShape): CodeWorkspaceRecord | undefined {
  return state.workspaces.find((workspace) => workspace.workspace_id === state.activeWorkspaceId);
}

export function getActiveSession(state: CodeModeStateShape): CodeSessionRecord | undefined {
  return state.sessions.find((session) => session.session_id === state.activeSessionId);
}

export function getSessionsForWorkspace(
  state: CodeModeStateShape,
  workspaceId: string,
): CodeSessionRecord[] {
  return state.sessions.filter((session) => session.workspace_id === workspaceId);
}
