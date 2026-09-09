import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BrowserTrajectorySchema, type BrowserActionTrajectoryStep, type BrowserTrajectory } from '@allternit/computer-use-protocol';
import { compileBrowserTrajectoryToSkill } from './skill-factory.js';
import {
  acuRecordingJsonlToTrajectory,
  loadAcuRecordingToTrajectory,
  mapAcuActionKind,
  normalizeIsoTimestamp,
  resolveRecordingPath,
} from './recording-to-trajectory.js';

/** ACU recordings only produce action steps; narrow the step union for assertions. */
function actionSteps(trajectory: BrowserTrajectory): BrowserActionTrajectoryStep[] {
  return trajectory.steps.filter((step): step is BrowserActionTrajectoryStep => step.kind === 'action');
}

const FIXTURE_JSONL = [
  {
    _type: 'manifest',
    recording_id: 'rec-abc123def456',
    task: 'Log into the dashboard and check status',
    session_id: 'sess-1',
    run_id: 'run-42',
    vision_provider: 'playwright-local',
    adapter_id: 'local',
    started_at: '2026-09-01T10:00:00.123456+00:00',
    completed_at: '2026-09-01T10:01:00+00:00',
    total_steps: 4,
    status: 'completed',
  },
  {
    recording_id: 'rec-abc123def456',
    step: 1,
    timestamp: '2026-09-01T10:00:01+00:00',
    action_type: 'goto',
    action_target: '',
    action_params: { url: 'https://app.example.com/login' },
    reasoning: 'Open the login page',
    reflection: '',
    action_succeeded: true,
  },
  {
    recording_id: 'rec-abc123def456',
    step: 2,
    timestamp: '2026-09-01T10:00:03+00:00',
    action_type: 'type_text',
    action_target: 'input[name="email"]',
    action_params: { text: 'ops@example.com' },
    reasoning: 'Enter account email',
    reflection: '',
    action_succeeded: true,
  },
  {
    recording_id: 'rec-abc123def456',
    step: 3,
    timestamp: '2026-09-01T10:00:05+00:00',
    action_type: 'type_text',
    action_target: 'input[name="password"]',
    action_params: { text: 'hunter2-secret' },
    reasoning: 'Enter the password',
    reflection: '',
    action_succeeded: true,
  },
  {
    recording_id: 'rec-abc123def456',
    step: 4,
    timestamp: '2026-09-01T10:00:07+00:00',
    action_type: 'click',
    action_target: 'button[type="submit"]',
    action_params: {},
    reasoning: 'Submit the login form',
    reflection: '',
    action_succeeded: true,
  },
  {
    recording_id: 'rec-abc123def456',
    step: 5,
    timestamp: '2026-09-01T10:00:09+00:00',
    action_type: 'click',
    action_target: '#missing-element',
    action_params: {},
    reasoning: 'Click a control that was not there',
    reflection: 'Element never appeared',
    action_succeeded: false,
  },
].map((line) => JSON.stringify(line)).join('\n') + '\n';

describe('acuRecordingJsonlToTrajectory', () => {
  it('converts an ACU JSONL recording into a valid BrowserTrajectory', () => {
    const trajectory = acuRecordingJsonlToTrajectory(FIXTURE_JSONL);
    expect(() => BrowserTrajectorySchema.parse(trajectory)).not.toThrow();
    expect(trajectory.trajectoryId).toBe('trajectory_rec-abc123def456');
    expect(trajectory.runId).toBe('run-42');
    expect(trajectory.sessionId).toBe('sess-1');
    expect(trajectory.objective).toBe('Log into the dashboard and check status');
    expect(trajectory.provider).toBe('local-playwright');
    expect(trajectory.createdAt).toBe('2026-09-01T10:00:00.123Z');
    expect(trajectory.steps).toHaveLength(5);
    const steps = actionSteps(trajectory);
    expect(steps.map((step) => step.action.kind)).toEqual([
      'navigate',
      'type',
      'type',
      'click',
      'click',
    ]);
    expect(steps[4].status).toBe('failed');
    expect(steps[0].status).toBe('committed');
    expect(steps[1].action.targetDescription).toBe('input[name="email"]');
    expect(steps[4].action.reason).toContain('Element never appeared');
  });

  it('maps unknown ACU action types to extract and preserves the original type', () => {
    const jsonl = [
      JSON.stringify({ _type: 'manifest', recording_id: 'rec-x', task: 't', started_at: '2026-09-01T00:00:00Z' }),
      JSON.stringify({ step: 1, action_type: 'move_mouse', action_params: { x: 10, y: 20 } }),
    ].join('\n');
    const trajectory = acuRecordingJsonlToTrajectory(jsonl);
    const steps = actionSteps(trajectory);
    expect(steps[0].action.kind).toBe('extract');
    expect(steps[0].action.input.__acuActionType).toBe('move_mouse');
  });

  it('rejects empty and malformed recordings', () => {
    expect(() => acuRecordingJsonlToTrajectory('')).toThrow('empty');
    expect(() => acuRecordingJsonlToTrajectory('not json\n')).toThrow('valid JSON');
  });
});

describe('mapAcuActionKind', () => {
  it('covers the ACU desktop/browser vocabulary', () => {
    expect(mapAcuActionKind('goto')).toBe('navigate');
    expect(mapAcuActionKind('type_text')).toBe('type');
    expect(mapAcuActionKind('key_press')).toBe('press');
    expect(mapAcuActionKind('select_option')).toBe('select');
    expect(mapAcuActionKind('dialog_accept')).toBe('dialog.accept');
    expect(mapAcuActionKind('tab_open')).toBe('tab.open');
    expect(mapAcuActionKind('WHAT_IS_THIS')).toBe('extract');
  });
});

describe('normalizeIsoTimestamp', () => {
  it('converts Python +00:00 offsets and microseconds to Z form', () => {
    expect(normalizeIsoTimestamp('2026-09-01T10:00:00.123456+00:00', 'x')).toBe('2026-09-01T10:00:00.123Z');
    expect(normalizeIsoTimestamp('2026-09-01T10:00:00Z', 'x')).toBe('2026-09-01T10:00:00.000Z');
    expect(normalizeIsoTimestamp(undefined, '2026-09-01T10:00:00.000Z')).toBe('2026-09-01T10:00:00.000Z');
    expect(normalizeIsoTimestamp('garbage', '2026-09-01T10:00:00.000Z')).toBe('2026-09-01T10:00:00.000Z');
  });
});

describe('recording → skill package pipeline', () => {
  it('compiles a fixture recording into a skill package with redaction', () => {
    const trajectory = acuRecordingJsonlToTrajectory(FIXTURE_JSONL);
    const pkg = compileBrowserTrajectoryToSkill(trajectory, {
      now: () => new Date('2026-09-01T10:05:00.000Z'),
    });

    // Failed step 5 is excluded; the 4 committed steps compile.
    expect(pkg.workflow.steps).toHaveLength(4);
    expect(pkg.workflow.title).toBe('Log into the dashboard and check status');
    expect(pkg.workflow.sourceRunId).toBe('run-42');
    expect(pkg.workflow.provider).toBe('local-playwright');
    expect(pkg.workflow.steps[0]).toMatchObject({
      kind: 'navigate',
      input: { url: 'https://app.example.com/login' },
    });

    // Redaction: the typed email matches the sensitive-value pattern and the
    // password field name matches the secret-name pattern; neither leaks.
    expect(pkg.workflow.safety.redactions).toEqual(
      expect.arrayContaining(['input.text']),
    );
    const typedInputs = pkg.workflow.steps
      .filter((step) => step.kind === 'type')
      .map((step) => step.input.text);
    expect(typedInputs).not.toContain('ops@example.com');
    expect(typedInputs).not.toContain('hunter2-secret');
    expect(typedInputs).toEqual(['{{text}}', '{{password}}']);

    // Side-effecting kinds require approval.
    expect(pkg.workflow.safety.requiresApprovalFor).toEqual(expect.arrayContaining(['type', 'click']));

    // Manifest is consistent with the workflow.
    expect(pkg.manifest.workflowId).toBe(pkg.workflow.workflowId);
    expect(pkg.manifest.tags).toContain('local-playwright');
  });

  it('throws when the recording has no committed steps', () => {
    const jsonl = [
      JSON.stringify({ _type: 'manifest', recording_id: 'rec-fail', task: 't', started_at: '2026-09-01T00:00:00Z' }),
      JSON.stringify({ step: 1, action_type: 'click', action_succeeded: false }),
    ].join('\n');
    const trajectory = acuRecordingJsonlToTrajectory(jsonl);
    expect(() => compileBrowserTrajectoryToSkill(trajectory)).toThrow('no committed steps');
  });
});

describe('resolveRecordingPath / loadAcuRecordingToTrajectory', () => {
  it('resolves ids and relative paths inside the recordings dir only', () => {
    const dir = join('/tmp', 'recordings-test');
    expect(resolveRecordingPath('rec-1', dir)).toBe(join(dir, 'rec-1.jsonl'));
    expect(resolveRecordingPath('sub/rec-1.jsonl', dir)).toBe(join(dir, 'sub', 'rec-1.jsonl'));
    expect(() => resolveRecordingPath('../escape.jsonl', dir)).toThrow('escapes');
  });

  it('loads a recording file from disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'acu-rec-'));
    try {
      await writeFile(join(dir, 'rec-fixture.jsonl'), FIXTURE_JSONL, 'utf8');
      const trajectory = await loadAcuRecordingToTrajectory('rec-fixture', { recordingsDir: dir });
      expect(trajectory.runId).toBe('run-42');
      const byPath = await loadAcuRecordingToTrajectory(join(dir, 'rec-fixture.jsonl'), { recordingsDir: dir });
      expect(byPath).toEqual(trajectory);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
