import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';

export type CodeSessionMode = 'SAFE' | 'DEFAULT' | 'AUTO' | 'PLAN';

export const CODE_SESSION_MODE_LABELS: Record<CodeSessionMode, string> = {
  SAFE: 'Safe',
  DEFAULT: 'Default',
  AUTO: 'Auto',
  PLAN: 'Plan',
};

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

export interface CodeWorkspaceFile {
  id: string;
  name: string;
  size: number;
  type?: string;
  content?: string;
}

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
  content?: string;
}

export interface CodeCanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

interface RepoStatusSnapshot {
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

interface CodeCanvasHistory {
  past: CodeCanvasTile[][];
  future: CodeCanvasTile[][];
}

interface CanvasMutationOptions {
  recordHistory?: boolean;
}

export interface CodeWorkspaceRecord {
  workspace_id: string;
  root_path: string;
  display_name: string;
  description?: string;
  repo_status: RepoStatusSnapshot;
  context_anchor: string | null;
  sessions: string[];
  instructions?: string[];
  files?: CodeWorkspaceFile[];
  layoutMode?: CodeLayoutMode;
  canvasTiles?: CodeCanvasTile[];
  canvasViewport?: CodeCanvasViewport;
  canvasFocusTileId?: string | null;
  canvasSelectedIds?: string[];
  canvasHistory?: CodeCanvasHistory;
  isFavorite?: boolean;
  isArchived?: boolean;
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
  updateWorkspaceDetails: (workspaceId: string, details: { displayName?: string; description?: string }) => void;
  updateWorkspaceInstructions: (workspaceId: string, instructions: string[]) => void;
  deleteWorkspace: (workspaceId: string) => void;
  toggleWorkspaceFavorite: (workspaceId: string) => void;
  toggleWorkspaceArchive: (workspaceId: string) => void;
  addWorkspaceFile: (workspaceId: string, file: Omit<CodeWorkspaceFile, 'id'>) => void;
  removeWorkspaceFile: (workspaceId: string, fileId: string) => void;
  // Canvas layout actions
  setWorkspaceLayoutMode: (workspaceId: string, mode: CodeLayoutMode) => void;
  addCanvasTile: (workspaceId: string, tile: Omit<CodeCanvasTile, 'tileId'>) => string;
  removeCanvasTile: (workspaceId: string, tileId: string, options?: CanvasMutationOptions) => void;
  removeCanvasTiles: (workspaceId: string, tileIds: string[]) => void;
  updateCanvasTile: (
    workspaceId: string,
    tileId: string,
    updates: Partial<CodeCanvasTile>,
    options?: CanvasMutationOptions,
  ) => void;
  snapshotCanvas: (workspaceId: string) => void;
  setCanvasViewport: (workspaceId: string, viewport: CodeCanvasViewport) => void;
  setCanvasFocusTile: (workspaceId: string, tileId: string | null) => void;
  autoArrangeCanvasTiles: (workspaceId: string) => void;
  importCanvasState: (workspaceId: string, tiles: CodeCanvasTile[], viewport?: CodeCanvasViewport) => void;
  undoCanvas: (workspaceId: string) => void;
  redoCanvas: (workspaceId: string) => void;
  selectCanvasTiles: (workspaceId: string, tileIds: string[]) => void;
  clearCanvasSelection: (workspaceId: string) => void;
  updateSessionFilesTouched: (sessionId: string, files: string[]) => void;
  setSessionMode: (sessionId: string, mode: CodeSessionMode) => void;
  setSessionIsolation: (sessionId: string, isolation: CodeIsolation) => void;
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() - offsetMinutes * 60_000).toISOString();
}

const MAX_CANVAS_HISTORY = 50;

function pushCanvasHistory(
  history: CodeCanvasHistory | undefined,
  tiles: CodeCanvasTile[],
): CodeCanvasHistory {
  return {
    past: [...(history?.past ?? []), tiles].slice(-MAX_CANVAS_HISTORY),
    future: [],
  };
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
      isFavorite: false,
      isArchived: false,
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

  updateWorkspaceDetails: (workspaceId, details) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId
          ? {
              ...w,
              ...(details.displayName !== undefined ? { display_name: details.displayName } : {}),
              ...(details.description !== undefined ? { description: details.description } : {}),
            }
          : w,
      ),
    })),

  updateWorkspaceInstructions: (workspaceId, instructions) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId ? { ...w, instructions } : w,
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

  toggleWorkspaceFavorite: (workspaceId) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId ? { ...w, isFavorite: !w.isFavorite } : w
      ),
    })),

  toggleWorkspaceArchive: (workspaceId) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId ? { ...w, isArchived: !w.isArchived } : w
      ),
    })),

  addWorkspaceFile: (workspaceId, file) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId
          ? { ...w, files: [...(w.files ?? []), { ...file, id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }] }
          : w
      ),
    })),

  removeWorkspaceFile: (workspaceId, fileId) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId
          ? { ...w, files: (w.files ?? []).filter((f) => f.id !== fileId) }
          : w
      ),
    })),

  // Canvas layout actions
  setWorkspaceLayoutMode: (workspaceId, mode) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId ? { ...w, layoutMode: mode } : w,
      ),
    })),

  addCanvasTile: (workspaceId, tile) => {
    const tileId = `tile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      const workspace = state.workspaces.find((w) => w.workspace_id === workspaceId);
      if (!workspace) return state;
      return {
        workspaces: state.workspaces.map((w) =>
          w.workspace_id === workspaceId
            ? {
                ...w,
                canvasTiles: [...(w.canvasTiles ?? []), { ...tile, tileId }],
                canvasHistory: pushCanvasHistory(w.canvasHistory, w.canvasTiles ?? []),
              }
            : w,
        ),
      };
    });
    return tileId;
  },

  removeCanvasTile: (workspaceId, tileId, options) =>
    set((state) => {
      const workspace = state.workspaces.find((w) => w.workspace_id === workspaceId);
      if (!workspace || !(workspace.canvasTiles ?? []).some((tile) => tile.tileId === tileId)) {
        return state;
      }
      return {
        workspaces: state.workspaces.map((w) =>
          w.workspace_id === workspaceId
            ? {
                ...w,
                canvasTiles: (w.canvasTiles ?? []).filter((t) => t.tileId !== tileId),
                canvasSelectedIds: (w.canvasSelectedIds ?? []).filter((id) => id !== tileId),
                canvasFocusTileId: w.canvasFocusTileId === tileId ? null : w.canvasFocusTileId,
                canvasHistory:
                  options?.recordHistory === false
                    ? w.canvasHistory
                    : pushCanvasHistory(w.canvasHistory, w.canvasTiles ?? []),
              }
            : w,
        ),
      };
    }),

  removeCanvasTiles: (workspaceId, tileIds) =>
    set((state) => {
      const ids = new Set(tileIds);
      if (ids.size === 0) return state;
      const workspace = state.workspaces.find((w) => w.workspace_id === workspaceId);
      if (!workspace || !(workspace.canvasTiles ?? []).some((tile) => ids.has(tile.tileId))) {
        return state;
      }
      return {
        workspaces: state.workspaces.map((w) =>
          w.workspace_id === workspaceId
            ? {
                ...w,
                canvasTiles: (w.canvasTiles ?? []).filter((tile) => !ids.has(tile.tileId)),
                canvasSelectedIds: (w.canvasSelectedIds ?? []).filter((id) => !ids.has(id)),
                canvasFocusTileId:
                  w.canvasFocusTileId && ids.has(w.canvasFocusTileId)
                    ? null
                    : w.canvasFocusTileId,
                canvasHistory: pushCanvasHistory(w.canvasHistory, w.canvasTiles ?? []),
              }
            : w,
        ),
      };
    }),

  updateCanvasTile: (workspaceId, tileId, updates, options) =>
    set((state) => {
      const workspace = state.workspaces.find((w) => w.workspace_id === workspaceId);
      if (!workspace || !(workspace.canvasTiles ?? []).some((tile) => tile.tileId === tileId)) {
        return state;
      }
      return {
        workspaces: state.workspaces.map((w) =>
          w.workspace_id === workspaceId
            ? {
                ...w,
                canvasTiles: (w.canvasTiles ?? []).map((t) =>
                  t.tileId === tileId ? { ...t, ...updates } : t,
                ),
                canvasHistory:
                  options?.recordHistory === false
                    ? w.canvasHistory
                    : pushCanvasHistory(w.canvasHistory, w.canvasTiles ?? []),
              }
            : w,
        ),
      };
    }),

  snapshotCanvas: (workspaceId) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId
          ? {
              ...w,
              canvasHistory: pushCanvasHistory(w.canvasHistory, w.canvasTiles ?? []),
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
                canvasHistory: pushCanvasHistory(w.canvasHistory, w.canvasTiles ?? []),
              }
            : w,
        ),
      };
    }),

  importCanvasState: (workspaceId, tiles, viewport) =>
    set((state) => {
      const workspace = state.workspaces.find((w) => w.workspace_id === workspaceId);
      if (!workspace) return state;
      return {
        workspaces: state.workspaces.map((w) =>
          w.workspace_id === workspaceId
            ? {
                ...w,
                canvasTiles: tiles,
                canvasViewport: viewport ?? w.canvasViewport,
                canvasSelectedIds: [],
                canvasFocusTileId: null,
                canvasHistory: pushCanvasHistory(w.canvasHistory, w.canvasTiles ?? []),
              }
            : w,
        ),
      };
    }),

  undoCanvas: (workspaceId) =>
    set((state) => {
      const workspace = state.workspaces.find((w) => w.workspace_id === workspaceId);
      const history = workspace?.canvasHistory;
      if (!history || history.past.length === 0) return state;
      const previous = history.past[history.past.length - 1];
      const newPast = history.past.slice(0, -1);
      const newFuture = [workspace?.canvasTiles ?? [], ...history.future];
      const previousIds = new Set(previous.map((tile) => tile.tileId));
      return {
        workspaces: state.workspaces.map((w) =>
          w.workspace_id === workspaceId
            ? {
                ...w,
                canvasTiles: previous,
                canvasSelectedIds: (w.canvasSelectedIds ?? []).filter((id) => previousIds.has(id)),
                canvasFocusTileId:
                  w.canvasFocusTileId && previousIds.has(w.canvasFocusTileId)
                    ? w.canvasFocusTileId
                    : null,
                canvasHistory: { past: newPast, future: newFuture },
              }
            : w,
        ),
      };
    }),

  redoCanvas: (workspaceId) =>
    set((state) => {
      const workspace = state.workspaces.find((w) => w.workspace_id === workspaceId);
      const history = workspace?.canvasHistory;
      if (!history || history.future.length === 0) return state;
      const next = history.future[0];
      const newFuture = history.future.slice(1);
      const newPast = [...history.past, workspace?.canvasTiles ?? []];
      const nextIds = new Set(next.map((tile) => tile.tileId));
      return {
        workspaces: state.workspaces.map((w) =>
          w.workspace_id === workspaceId
            ? {
                ...w,
                canvasTiles: next,
                canvasSelectedIds: (w.canvasSelectedIds ?? []).filter((id) => nextIds.has(id)),
                canvasFocusTileId:
                  w.canvasFocusTileId && nextIds.has(w.canvasFocusTileId)
                    ? w.canvasFocusTileId
                    : null,
                canvasHistory: { past: newPast, future: newFuture },
              }
            : w,
        ),
      };
    }),

  selectCanvasTiles: (workspaceId, tileIds) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId ? { ...w, canvasSelectedIds: tileIds } : w,
      ),
    })),

  clearCanvasSelection: (workspaceId) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.workspace_id === workspaceId ? { ...w, canvasSelectedIds: [] } : w,
      ),
    })),

  setSessionMode: (sessionId, mode) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.session_id === sessionId ? { ...s, mode } : s,
      ),
    })),

  setSessionIsolation: (sessionId, isolation) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.session_id === sessionId ? { ...s, isolation } : s,
      ),
    })),

  updateSessionFilesTouched: (sessionId, files) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.session_id === sessionId ? { ...s, files_touched: files } : s,
      ),
    })),
  }),
  {
    name: 'allternit-code-storage-v1',
    storage: createBrowserJSONStorage(),
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
