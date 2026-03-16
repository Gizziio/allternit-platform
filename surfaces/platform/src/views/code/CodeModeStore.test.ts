import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInitialCodeModeState,
  useCodeModeStore,
} from './CodeModeStore';

const SESSION_MODES = ['SAFE', 'DEFAULT', 'AUTO', 'PLAN'];
const SESSION_STATES = [
  'IDLE',
  'PLANNING',
  'PLAN_READY',
  'EXECUTING',
  'AWAITING_APPROVAL',
  'CHANGESET_READY',
  'APPLYING',
  'VERIFYING',
  'DONE',
  'FAILED',
  'TERMINATED',
];
const ISOLATION_TYPES = ['worktree', 'sandbox'];

describe('CodeModeStore', () => {
  beforeEach(() => {
    useCodeModeStore.setState(createInitialCodeModeState());
  });

  it('switches workspace and selects the first session in that workspace', () => {
    useCodeModeStore.getState().setActiveWorkspace('ws_summit_demo');

    const state = useCodeModeStore.getState();
    expect(state.activeWorkspaceId).toBe('ws_summit_demo');
    expect(state.activeSessionId).toBe('sess_merge_back');
  });

  it('selects a session and follows its workspace binding', () => {
    useCodeModeStore.getState().setActiveSession('sess_diff_review');

    const state = useCodeModeStore.getState();
    expect(state.activeSessionId).toBe('sess_diff_review');
    expect(state.activeWorkspaceId).toBe('ws_a2rchitech');
  });

  it('ships session fixtures that satisfy CodeSession contract invariants', () => {
    const state = createInitialCodeModeState();

    for (const session of state.sessions) {
      expect(session.session_id.startsWith('sess_')).toBe(true);
      expect(session.workspace_id.startsWith('ws_')).toBe(true);
      expect(ISOLATION_TYPES).toContain(session.isolation);
      expect(SESSION_MODES).toContain(session.mode);
      expect(SESSION_STATES).toContain(session.state);
      expect(session.policy_profile_id.startsWith('pol_')).toBe(true);
      expect(Number.isNaN(Date.parse(session.created_at))).toBe(false);
      expect(Number.isNaN(Date.parse(session.updated_at))).toBe(false);
      expect(session.last_event_at === null || !Number.isNaN(Date.parse(session.last_event_at))).toBe(true);
      expect(session.pending_approvals_count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(session.files_touched)).toBe(true);
      expect(Array.isArray(session.preview_sessions)).toBe(true);
    }
  });

  it('keeps parallel workspace sessions isolated by unique worktree paths', () => {
    const state = createInitialCodeModeState();
    const workspaceSessions = state.sessions.filter(
      (session) => session.workspace_id === 'ws_a2rchitech',
    );

    expect(workspaceSessions).toHaveLength(3);

    const isolationPaths = workspaceSessions.map(
      (session) => `${session.isolation}:${session.worktree_path ?? session.session_id}`,
    );

    expect(new Set(isolationPaths).size).toBe(workspaceSessions.length);
  });
});
