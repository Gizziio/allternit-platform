import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
export type CodeLayoutMode = 'thread' | 'canvas';

export interface CodeCanvasTile {
  tileId: string;
  type: 'session' | 'preview' | 'diff' | 'terminal' | 'notes' | 'knowledge' | 'knowledge-graph';
  sessionId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  label?: string;
  url?: string;
  diffText?: string;
  filePath?: string;
}

export interface CodeCanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

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
  layoutMode?: CodeLayoutMode;
  canvasTiles?: CodeCanvasTile[];
  canvasViewport?: CodeCanvasViewport;
  canvasFocusTileId?: string | null;
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
  // Canvas layout actions
  setWorkspaceLayoutMode: (workspaceId: string, mode: CodeLayoutMode) => void;
  addCanvasTile: (workspaceId: string, tile: Omit<CodeCanvasTile, 'tileId'>) => string;
  removeCanvasTile: (workspaceId: string, tileId: string) => void;
  updateCanvasTile: (workspaceId: string, tileId: string, updates: Partial<CodeCanvasTile>) => void;
  setCanvasViewport: (workspaceId: string, viewport: CodeCanvasViewport) => void;
  setCanvasFocusTile: (workspaceId: string, tileId: string | null) => void;
  autoArrangeCanvasTiles: (workspaceId: string) => void;
  updateSessionFilesTouched: (sessionId: string, files: string[]) => void;
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

export function createCodeModeFixtureState(): CodeModeStateShape {
  const now = new Date().toISOString();
  return {
    workspaces: [
      {
        workspace_id: 'ws_allternit',
        root_path: '/Users/macbook/allternit',
        display_name: 'Allternit Platform',
        repo_status: {
          branch: 'main',
          dirty: true,
          ahead: 0,
          behind: 0,
          staged_count: 0,
          unstaged_count: 0,
          untracked_count: 0,
          last_commit: 'abc1234',
          last_commit_message: 'init',
          snapshot_at: now,
        },
        context_anchor: null,
        sessions: ['sess_code_ui', 'sess_policy_pass', 'sess_diff_review'],
      },
      {
        workspace_id: 'ws_summit_demo',
        root_path: '/Users/macbook/summit',
        display_name: 'Summit Demo',
        repo_status: {
          branch: 'demo/launch-readiness',
          dirty: false,
          ahead: 0,
          behind: 0,
          staged_count: 0,
          unstaged_count: 0,
          untracked_count: 0,
          last_commit: 'def5678',
          last_commit_message: 'init',
          snapshot_at: now,
        },
        context_anchor: null,
        sessions: ['sess_merge_back', 'sess_release_notes'],
      },
    ],
    sessions: [
      {
        session_id: 'sess_code_ui',
        workspace_id: 'ws_allternit',
        title: 'Code Mode Layout Stabilization',
        isolation: 'worktree',
        branch: 'main',
        worktree_path: '/worktrees/sess_code_ui',
        mode: 'PLAN',
        state: 'PLAN_READY',
        policy_profile_id: 'pol_default',
        wih_id: null,
        run_id: null,
        created_at: now,
        updated_at: now,
        last_event_at: now,
        last_error: null,
        pending_approvals_count: 0,
        files_touched: [],
        preview_sessions: [],
      },
      {
        session_id: 'sess_policy_pass',
        workspace_id: 'ws_allternit',
        title: 'Policy Pass',
        isolation: 'worktree',
        branch: 'main',
        worktree_path: '/worktrees/sess_policy_pass',
        mode: 'DEFAULT',
        state: 'AWAITING_APPROVAL',
        policy_profile_id: 'pol_default',
        wih_id: null,
        run_id: null,
        created_at: now,
        updated_at: now,
        last_event_at: now,
        last_error: null,
        pending_approvals_count: 1,
        files_touched: [],
        preview_sessions: [],
      },
      {
        session_id: 'sess_diff_review',
        workspace_id: 'ws_allternit',
        title: 'Diff Review Prototype',
        isolation: 'worktree',
        branch: 'main',
        worktree_path: '/worktrees/sess_diff_review',
        mode: 'AUTO',
        state: 'CHANGESET_READY',
        policy_profile_id: 'pol_default',
        wih_id: null,
        run_id: null,
        created_at: now,
        updated_at: now,
        last_event_at: now,
        last_error: null,
        pending_approvals_count: 0,
        files_touched: [],
        preview_sessions: [],
      },
      {
        session_id: 'sess_merge_back',
        workspace_id: 'ws_summit_demo',
        title: 'Merge Back',
        isolation: 'worktree',
        branch: 'demo/launch-readiness',
        worktree_path: '/worktrees/sess_merge_back',
        mode: 'SAFE',
        state: 'VERIFYING',
        policy_profile_id: 'pol_default',
        wih_id: null,
        run_id: null,
        created_at: now,
        updated_at: now,
        last_event_at: now,
        last_error: null,
        pending_approvals_count: 0,
        files_touched: [],
        preview_sessions: [],
      },
      {
        session_id: 'sess_release_notes',
        workspace_id: 'ws_summit_demo',
        title: 'Release Notes',
        isolation: 'worktree',
        branch: 'demo/launch-readiness',
        worktree_path: '/worktrees/sess_release_notes',
        mode: 'DEFAULT',
        state: 'IDLE',
        policy_profile_id: 'pol_default',
        wih_id: null,
        run_id: null,
        created_at: now,
        updated_at: now,
        last_event_at: now,
        last_error: null,
        pending_approvals_count: 0,
        files_touched: [],
        preview_sessions: [],
      },
    ],
    activeWorkspaceId: 'ws_allternit',
    activeSessionId: 'sess_code_ui',
  };
}

export const useCodeModeStore = create<CodeModeState>()(
  persist(
    (set, get) => ({
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
      root_path: '',
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

  // Canvas layout actions
  setWorkspaceLayoutMode: (workspaceId, mode) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId ? { ...w, layoutMode: mode } : w,
      ),
    })),

  addCanvasTile: (workspaceId, tile) => {
    const tileId = `tile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId
          ? {
              ...w,
              canvasTiles: [...(w.canvasTiles ?? []), { ...tile, tileId }],
            }
          : w,
      ),
    }));
    return tileId;
  },

  removeCanvasTile: (workspaceId, tileId) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId
          ? { ...w, canvasTiles: (w.canvasTiles ?? []).filter((t) => t.tileId !== tileId) }
          : w,
      ),
    })),

  updateCanvasTile: (workspaceId, tileId, updates) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId
          ? {
              ...w,
              canvasTiles: (w.canvasTiles ?? []).map((t) =>
                t.tileId === tileId ? { ...t, ...updates } : t,
              ),
            }
          : w,
      ),
    })),

  setCanvasViewport: (workspaceId, viewport) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId ? { ...w, canvasViewport: viewport } : w,
      ),
    })),

  setCanvasFocusTile: (workspaceId, tileId) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId ? { ...w, canvasFocusTileId: tileId } : w,
      ),
    })),

  autoArrangeCanvasTiles: (workspaceId) =>
    set((state) => {
      const workspace = state.workspaces.find((w) => w.workspace_id === workspaceId);
      const tiles = workspace?.canvasTiles ?? [];
      const cols = Math.ceil(Math.sqrt(tiles.length)) || 1;
      const gap = 24;
      const tileW = 480;
      const tileH = 360;
      return {
        workspaces: state.workspaces.map((w) =>
          w.workspace_id === workspaceId
            ? {
                ...w,
                canvasTiles: tiles.map((t, i) => ({
                  ...t,
                  x: gap + (i % cols) * (tileW + gap),
                  y: gap + Math.floor(i / cols) * (tileH + gap),
                  width: tileW,
                  height: tileH,
                  zIndex: i + 1,
                })),
              }
            : w,
        ),
      };
    }),

  updateSessionFilesTouched: (sessionId, files) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.session_id === sessionId ? { ...s, files_touched: files } : s,
      ),
    })),
  }),
  {
    name: 'allternit-code-storage-v1',
    partialize: (state) => ({
      workspaces: state.workspaces,
      sessions: state.sessions,
      activeWorkspaceId: state.activeWorkspaceId,
      activeSessionId: state.activeSessionId,
    }),
  },
));

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

export function getWorkspaceLayoutMode(workspace: CodeWorkspaceRecord | undefined): CodeLayoutMode {
  return workspace?.layoutMode ?? 'thread';
}
