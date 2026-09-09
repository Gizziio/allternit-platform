import { describe, expect, it } from 'vitest';
import {
  ActionIntentSchema,
  BrowserActionTrajectoryStepSchema,
  BrowserEventSchema,
  BrowserToolCallTrajectoryStepSchema,
  BrowserTrajectorySchema,
  COMPUTER_USE_PROTOCOL_VERSION,
  SitePluginManifestSchema,
  SiteToolCallSchema,
  SiteToolDescriptorSchema,
} from './index.js';

describe('SiteToolDescriptorSchema', () => {
  it('accepts a WebMCP-shaped descriptor (name/description/inputSchema)', () => {
    const descriptor = SiteToolDescriptorSchema.parse({
      name: 'github.review_pr',
      description: 'Open a GitHub PR, read the diff, and post a review comment.',
      inputSchema: {
        type: 'object',
        properties: {
          prUrl: { type: 'string', format: 'uri' },
          reviewText: { type: 'string' },
        },
        required: ['prUrl', 'reviewText'],
        additionalProperties: false,
      },
    });
    expect(descriptor.name).toBe('github.review_pr');
    expect(descriptor.inputSchema.required).toEqual(['prUrl', 'reviewText']);
  });

  it('defaults inputSchema to an empty object schema', () => {
    const descriptor = SiteToolDescriptorSchema.parse({
      name: 'gmail.read_inbox',
      description: 'Read unread Gmail messages.',
      inputSchema: {},
    });
    expect(descriptor.inputSchema.type).toBe('object');
    expect(descriptor.inputSchema.properties).toEqual({});
  });
});

describe('SiteToolCallSchema', () => {
  it('round-trips a full tool call', () => {
    const call = SiteToolCallSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      toolCallId: 'tc-1',
      runId: 'run-1',
      sessionId: 'sess-1',
      toolName: 'github.review_pr',
      args: { prUrl: 'https://github.com/acme/app/pull/1', reviewText: 'LGTM' },
      resultSummary: 'Review comment posted on acme/app#1',
      latencyMs: 1842,
      redacted: false,
      invokedAt: '2026-09-09T12:00:00.000Z',
    });
    const json = JSON.parse(JSON.stringify(call));
    expect(SiteToolCallSchema.parse(json)).toEqual(call);
  });

  it('defaults args to {} and redacted to false, and allows error without result', () => {
    const call = SiteToolCallSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      toolCallId: 'tc-2',
      runId: 'run-1',
      sessionId: 'sess-1',
      toolName: 'gmail.read_inbox',
      error: 'Action \'delete_all_emails\' is blocked by plugin policy',
      invokedAt: '2026-09-09T12:00:00.000Z',
    });
    expect(call.args).toEqual({});
    expect(call.redacted).toBe(false);
    expect(call.resultSummary).toBeUndefined();
  });

  it('rejects negative latency', () => {
    expect(() => SiteToolCallSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      toolCallId: 'tc-3',
      runId: 'run-1',
      sessionId: 'sess-1',
      toolName: 'gmail.read_inbox',
      latencyMs: -5,
      invokedAt: '2026-09-09T12:00:00.000Z',
    })).toThrow();
  });
});

describe('BrowserTrajectoryStepSchema union', () => {
  const action = ActionIntentSchema.parse({
    schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
    actionId: 'a-1',
    runId: 'run-1',
    sessionId: 'sess-1',
    kind: 'navigate',
    reason: 'Open the page',
    input: { url: 'https://github.com/acme/app/pull/1' },
  });

  it('parses action steps without an explicit kind (default)', () => {
    const step = BrowserActionTrajectoryStepSchema.parse({
      stepId: 'step_1',
      action,
      status: 'committed',
    });
    expect(step.kind).toBe('action');
  });

  it('parses tool_call steps and round-trips inside a trajectory', () => {
    const trajectory = BrowserTrajectorySchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      trajectoryId: 'traj-1',
      runId: 'run-1',
      sessionId: 'sess-1',
      objective: 'Review the PR',
      createdAt: '2026-09-09T12:00:00.000Z',
      provider: 'local-playwright',
      steps: [
        { stepId: 'step_1', action, status: 'committed' },
        {
          kind: 'tool_call',
          stepId: 'step_2',
          status: 'committed',
          toolCall: {
            schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
            toolCallId: 'tc-1',
            runId: 'run-1',
            sessionId: 'sess-1',
            toolName: 'github.review_pr',
            resultSummary: 'Review comment posted',
            latencyMs: 1200,
            redacted: false,
            invokedAt: '2026-09-09T12:00:01.000Z',
          },
        },
      ],
    });
    expect(trajectory.steps).toHaveLength(2);
    expect(trajectory.steps[1].kind).toBe('tool_call');
    const roundTrip = BrowserTrajectorySchema.parse(JSON.parse(JSON.stringify(trajectory)));
    expect(roundTrip).toEqual(trajectory);
  });

  it('rejects a tool_call step missing the toolCall payload', () => {
    expect(() => BrowserToolCallTrajectoryStepSchema.parse({
      kind: 'tool_call',
      stepId: 'step_2',
      status: 'committed',
    })).toThrow();
  });
});

describe('tool.called event', () => {
  it('is a valid BrowserEvent type carrying a SiteToolCall payload', () => {
    const call = SiteToolCallSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      toolCallId: 'tc-1',
      runId: 'run-1',
      sessionId: 'sess-1',
      toolName: 'notion.create_page',
      resultSummary: 'Page created',
      latencyMs: 900,
      invokedAt: '2026-09-09T12:00:00.000Z',
    });
    const event = BrowserEventSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      eventId: 'evt-1',
      runId: 'run-1',
      sessionId: 'sess-1',
      sequence: 1,
      emittedAt: '2026-09-09T12:00:00.000Z',
      type: 'tool.called',
      payload: { toolCall: call },
    });
    expect(event.type).toBe('tool.called');
  });
});

describe('SitePluginManifestSchema', () => {
  it('matches the real computer-use plugin.json shape', () => {
    const manifest = SitePluginManifestSchema.parse({
      id: 'github',
      name: 'GitHub Plugin',
      version: '0.1.0',
      description: 'Automates GitHub workflows.',
      policy_profile: {
        max_destructive_actions: 3,
        requires_approval: true,
        allowed_domains: ['github.com', '*.github.com', 'api.github.com'],
        blocked_actions: ['delete_repository'],
      },
      cookbooks: ['review-pr', 'triage-issue'],
    });
    expect(manifest.policy_profile.blocked_actions).toContain('delete_repository');
  });
});
