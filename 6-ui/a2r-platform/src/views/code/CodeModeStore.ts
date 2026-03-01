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
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() - offsetMinutes * 60_000).toISOString();
}

export function createInitialCodeModeState(): CodeModeStateShape {
  const workspaces: CodeWorkspaceRecord[] = [
    {
      workspace_id: 'ws_a2rchitech',
      root_path: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech',
      display_name: 'a2rchitech',
      repo_status: {
        branch: 'main',
        dirty: true,
        ahead: 2,
        behind: 0,
        staged_count: 4,
        unstaged_count: 7,
        untracked_count: 3,
        last_commit: 'c4d3a1f',
        last_commit_message: 'stabilize gateway + shell wiring',
        snapshot_at: nowIso(1),
      },
      context_anchor: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/CODEBASE.md',
      sessions: ['sess_code_ui', 'sess_policy_pass', 'sess_diff_review'],
    },
    {
      workspace_id: 'ws_summit_demo',
      root_path: '/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/tenants/summit_oic',
      display_name: 'summit_oic',
      repo_status: {
        branch: 'demo/launch-readiness',
        dirty: false,
        ahead: 0,
        behind: 1,
        staged_count: 0,
        unstaged_count: 0,
        untracked_count: 0,
        last_commit: '9ab24ef',
        last_commit_message: 'refresh tenant demo bundle',
        snapshot_at: nowIso(3),
      },
      context_anchor: null,
      sessions: ['sess_merge_back', 'sess_release_notes'],
    },
  ];

  const sessions: CodeSessionRecord[] = [
    {
      session_id: 'sess_code_ui',
      workspace_id: 'ws_a2rchitech',
      title: 'Code Mode Layout Stabilization',
      isolation: 'worktree',
      branch: 'a2r/sess_code_ui',
      worktree_path: '.a2r/worktrees/sess_code_ui',
      mode: 'PLAN',
      state: 'PLAN_READY',
      policy_profile_id: 'pol_plan',
      wih_id: 'CM-UI001',
      run_id: 'run_code_ui_001',
      created_at: nowIso(150),
      updated_at: nowIso(4),
      last_event_at: nowIso(4),
      last_error: null,
      pending_approvals_count: 1,
      files_touched: ['6-ui/a2r-platform/src/views/code/CodeRoot.tsx'],
      preview_sessions: [],
    },
    {
      session_id: 'sess_policy_pass',
      workspace_id: 'ws_a2rchitech',
      title: 'Approval Token Rails Pass',
      isolation: 'worktree',
      branch: 'a2r/sess_policy_pass',
      worktree_path: '.a2r/worktrees/sess_policy_pass',
      mode: 'DEFAULT',
      state: 'AWAITING_APPROVAL',
      policy_profile_id: 'pol_default',
      wih_id: 'CM-K031',
      run_id: 'run_policy_031',
      created_at: nowIso(210),
      updated_at: nowIso(12),
      last_event_at: nowIso(12),
      last_error: null,
      pending_approvals_count: 3,
      files_touched: ['0-substrate/a2r-agent-system-rails/src/work/types.rs'],
      preview_sessions: [],
    },
    {
      session_id: 'sess_diff_review',
      workspace_id: 'ws_a2rchitech',
      title: 'Diff Review Prototype',
      isolation: 'sandbox',
      worktree_path: '.a2r/sandboxes/sess_diff_review',
      mode: 'AUTO',
      state: 'CHANGESET_READY',
      policy_profile_id: 'pol_auto',
      wih_id: 'CM-UI021',
      run_id: 'run_diff_021',
      created_at: nowIso(95),
      updated_at: nowIso(2),
      last_event_at: nowIso(2),
      last_error: null,
      pending_approvals_count: 0,
      files_touched: [
        '6-ui/a2r-platform/src/components/changeset-review/ChangeSetReview.tsx',
        '6-ui/a2r-platform/src/components/changeset-review/FileChangeCard.tsx',
      ],
      preview_sessions: ['preview_diff_review'],
    },
    {
      session_id: 'sess_merge_back',
      workspace_id: 'ws_summit_demo',
      title: 'Merge Back Dry Run',
      isolation: 'worktree',
      branch: 'a2r/sess_merge_back',
      worktree_path: '.a2r/worktrees/sess_merge_back',
      mode: 'SAFE',
      state: 'VERIFYING',
      policy_profile_id: 'pol_safe',
      wih_id: 'CM-UI051',
      run_id: 'run_merge_051',
      created_at: nowIso(330),
      updated_at: nowIso(18),
      last_event_at: nowIso(18),
      last_error: null,
      pending_approvals_count: 0,
      files_touched: ['.a2r/worktrees/sess_merge_back/README.md'],
      preview_sessions: [],
    },
    {
      session_id: 'sess_release_notes',
      workspace_id: 'ws_summit_demo',
      title: 'Release Notes Patch',
      isolation: 'sandbox',
      worktree_path: '.a2r/sandboxes/sess_release_notes',
      mode: 'DEFAULT',
      state: 'FAILED',
      policy_profile_id: 'pol_default',
      wih_id: 'CM-UI024',
      run_id: 'run_release_024',
      created_at: nowIso(480),
      updated_at: nowIso(40),
      last_event_at: nowIso(40),
      last_error: 'Patch apply failed: base hash diverged on docs/launch.md',
      pending_approvals_count: 0,
      files_touched: ['docs/launch.md'],
      preview_sessions: [],
    },
  ];

  return {
    workspaces,
    sessions,
    activeWorkspaceId: workspaces[0].workspace_id,
    activeSessionId: workspaces[0].sessions[0],
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
