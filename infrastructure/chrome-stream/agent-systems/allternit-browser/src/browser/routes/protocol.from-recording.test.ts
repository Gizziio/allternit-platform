import { mkdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Express } from 'express';
import {
  ActionKindSchema,
  BrowserSkillManifestSchema,
  BrowserTrajectorySchema,
  BrowserWorkflowSpecSchema,
  ProviderKindSchema,
} from '@allternit/computer-use-protocol';
import { createBrowserRouteContext } from '../server-context.js';
import { registerBrowserProtocolRoutes } from './protocol.js';

/**
 * Integration proof for POST /v1/browser-skills/from-recording: boots the
 * real route handler with a fixture ACU recording and validates the full
 * response against the canonical wire schemas from
 * @allternit/computer-use-protocol. This is the contract proof that the
 * route emits protocol-conformant skill packages (the B- gap: previously
 * only unit tests covered the pieces, not the assembled route response).
 */

const FIXTURE_JSONL = [
  {
    _type: 'manifest',
    recording_id: 'rec-integ001',
    task: 'Log into the dashboard and check status',
    session_id: 'sess-integ',
    run_id: 'run-integ-42',
    vision_provider: 'playwright-local',
    adapter_id: 'local',
    started_at: '2026-09-01T10:00:00.123456+00:00',
    completed_at: '2026-09-01T10:01:00+00:00',
    total_steps: 3,
    status: 'completed',
  },
  {
    recording_id: 'rec-integ001',
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
    recording_id: 'rec-integ001',
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
    recording_id: 'rec-integ001',
    step: 3,
    timestamp: '2026-09-01T10:00:05+00:00',
    action_type: 'click',
    action_target: 'button[type="submit"]',
    action_params: {},
    reasoning: 'Submit the login form',
    reflection: '',
    action_succeeded: true,
  },
];

describe('POST /v1/browser-skills/from-recording (integration vs protocol schema)', () => {
  let app: Express;
  let server: ReturnType<Express['listen']>;
  let baseUrl: string;
  // The route resolves recordings inside ~/.allternit/recordings only
  // (path-escape sandbox by design), so the fixture lives there briefly.
  const recordingsDir = join(homedir(), '.allternit', 'recordings');
  const recordingId = `rec-cu11-integ-${process.pid}`;

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: '10mb' }));
    const ctx = createBrowserRouteContext({ getState: () => null });
    registerBrowserProtocolRoutes(app, ctx);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(join(recordingsDir, `${recordingId}.jsonl`), { force: true });
  });

  async function writeFixture(): Promise<void> {
    await mkdir(recordingsDir, { recursive: true });
    await writeFile(
      join(recordingsDir, `${recordingId}.jsonl`),
      FIXTURE_JSONL.map((line) => JSON.stringify(line)).join('\n') + '\n',
      'utf8',
    );
  }

  it('compiles a fixture ACU recording into a protocol-conformant skill package', async () => {
    await writeFixture();

    const response = await fetch(`${baseUrl}/v1/browser-skills/from-recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordingId,
        title: 'Dashboard login check',
        description: 'Log in and verify the status widget',
        tags: ['integ', 'login'],
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;

    // ── Integration contract: the assembled response must parse against the
    // canonical zod schemas from @allternit/computer-use-protocol ──────────
    const workflow = BrowserWorkflowSpecSchema.parse(body.workflow);
    const manifest = BrowserSkillManifestSchema.parse(body.manifest);

    // The metadata-only trajectory block: every field it claims must match
    // the canonical BrowserTrajectory field types, and the unredacted steps
    // must NOT be present on the wire.
    const trajectory = body.trajectory as Record<string, unknown>;
    expect(typeof trajectory.trajectoryId).toBe('string');
    expect(typeof trajectory.runId).toBe('string');
    expect(typeof trajectory.objective).toBe('string');
    expect(() => ProviderKindSchema.parse(trajectory.provider)).not.toThrow();
    expect(typeof trajectory.committedSteps).toBe('number');
    expect(trajectory.committedSteps).toBeGreaterThanOrEqual(1);
    expect(trajectory).not.toHaveProperty('steps');
    expect(trajectory).not.toHaveProperty('observations');

    // Structural cross-checks between the validated parts.
    expect(workflow.sourceRunId).toBe(trajectory.runId);
    expect(workflow.steps.length).toBe(trajectory.committedSteps);
    expect(manifest.workflowId).toBe(workflow.workflowId);
    expect(manifest.tags).toEqual(['integ', 'login']);

    // Every compiled step's action kind is a canonical protocol ActionKind.
    for (const step of workflow.steps) {
      expect(() => ActionKindSchema.parse(step.kind)).not.toThrow();
    }
    // The recording has 3 successful frames → 3 committed steps.
    expect(workflow.steps.length).toBe(3);
  });

  it('rejects a request with neither recordingId nor path', async () => {
    const response = await fetch(`${baseUrl}/v1/browser-skills/from-recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'no recording ref' }),
    });
    expect(response.status).toBe(400);
  });

  it('returns an error for a missing recording file', async () => {
    const response = await fetch(`${baseUrl}/v1/browser-skills/from-recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId: 'rec-cu11-does-not-exist' }),
    });
    expect(response.status).toBe(400);
  });

  it('the full trajectory (via the loader) validates against BrowserTrajectorySchema', async () => {
    // The route intentionally omits steps from its response; the loader is
    // the in-process source of the full trajectory, and it is what the
    // compiler consumed — prove it satisfies the canonical schema end to end.
    const { loadAcuRecordingToTrajectory } = await import('../../protocol/recording-to-trajectory.js');
    const trajectory = await loadAcuRecordingToTrajectory(recordingId, { recordingsDir });
    const parsed = BrowserTrajectorySchema.parse(trajectory);
    expect(parsed.steps.filter((s) => s.status === 'committed').length).toBe(3);
  });
});
