import { beforeEach, describe, expect, it } from 'vitest';
import {
  createCodeModeFixtureState,
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
    useCodeModeStore.setState(createCodeModeFixtureState());
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
    expect(state.activeWorkspaceId).toBe('ws_allternit');
  });

  it('ships session fixtures that satisfy CodeSession contract invariants', () => {
    const state = createCodeModeFixtureState();

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
    const state = createCodeModeFixtureState();
    const workspaceSessions = state.sessions.filter(
      (session) => session.workspace_id === 'ws_allternit',
    );

    expect(workspaceSessions).toHaveLength(3);

    const isolationPaths = workspaceSessions.map(
      (session) => `${session.isolation}:${session.worktree_path ?? session.session_id}`,
    );

    expect(new Set(isolationPaths).size).toBe(workspaceSessions.length);
  });

  it('treats a drag as one undoable canvas interaction', () => {
    const store = useCodeModeStore.getState();
    const tileId = store.addCanvasTile('ws_allternit', {
      type: 'notes',
      x: 0,
      y: 0,
      width: 480,
      height: 360,
      zIndex: 1,
    });

    useCodeModeStore.getState().snapshotCanvas('ws_allternit');
    useCodeModeStore
      .getState()
      .updateCanvasTile('ws_allternit', tileId, { x: 80, y: 40 }, { recordHistory: false });
    useCodeModeStore
      .getState()
      .updateCanvasTile('ws_allternit', tileId, { x: 160, y: 80 }, { recordHistory: false });

    useCodeModeStore.getState().undoCanvas('ws_allternit');
    let tile = useCodeModeStore
      .getState()
      .workspaces.find((workspace) => workspace.workspace_id === 'ws_allternit')
      ?.canvasTiles?.find((item) => item.tileId === tileId);
    expect(tile).toMatchObject({ x: 0, y: 0 });

    useCodeModeStore.getState().redoCanvas('ws_allternit');
    tile = useCodeModeStore
      .getState()
      .workspaces.find((workspace) => workspace.workspace_id === 'ws_allternit')
      ?.canvasTiles?.find((item) => item.tileId === tileId);
    expect(tile).toMatchObject({ x: 160, y: 80 });
  });

  it('removes a canvas selection atomically and restores it with one undo', () => {
    const firstId = useCodeModeStore.getState().addCanvasTile('ws_allternit', {
      type: 'notes',
      x: 0,
      y: 0,
      width: 480,
      height: 360,
      zIndex: 1,
    });
    const secondId = useCodeModeStore.getState().addCanvasTile('ws_allternit', {
      type: 'diff',
      x: 500,
      y: 0,
      width: 480,
      height: 360,
      zIndex: 2,
    });

    useCodeModeStore.getState().selectCanvasTiles('ws_allternit', [firstId, secondId]);
    useCodeModeStore.getState().removeCanvasTiles('ws_allternit', [firstId, secondId]);

    let workspace = useCodeModeStore
      .getState()
      .workspaces.find((item) => item.workspace_id === 'ws_allternit');
    expect(workspace?.canvasTiles).toEqual([]);
    expect(workspace?.canvasSelectedIds).toEqual([]);

    useCodeModeStore.getState().undoCanvas('ws_allternit');
    workspace = useCodeModeStore
      .getState()
      .workspaces.find((item) => item.workspace_id === 'ws_allternit');
    expect(workspace?.canvasTiles?.map((tile) => tile.tileId)).toEqual([firstId, secondId]);
  });

  it('caps persisted canvas history', () => {
    for (let index = 0; index < 60; index += 1) {
      useCodeModeStore.getState().snapshotCanvas('ws_allternit');
    }

    const workspace = useCodeModeStore
      .getState()
      .workspaces.find((item) => item.workspace_id === 'ws_allternit');
    expect(workspace?.canvasHistory?.past).toHaveLength(50);
  });
});
