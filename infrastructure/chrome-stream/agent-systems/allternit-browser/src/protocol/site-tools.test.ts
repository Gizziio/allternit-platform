import { describe, expect, it, vi } from 'vitest';
import {
  BrowserEventSchema,
  BrowserObservationSchema,
  COMPUTER_USE_PROTOCOL_VERSION,
  type ActionIntent,
  type BrowserProvider,
} from '@allternit/computer-use-protocol';
import { BrowserRunController } from './run-controller.js';
import { loadGitHubSiteTools } from '../browser/site-tools/adapters/github.js';
import { SiteToolRegistry } from '../browser/site-tools/registry.js';

function mockProvider(url: string): BrowserProvider {
  return {
    capabilities: {
      provider: 'local-playwright',
      capabilities: ['navigate', 'observe.accessibility'],
      local: true,
      attachedToUserSession: false,
      supportsPrivateNetwork: true,
      supportsPersistentProfile: true,
    },
    observe: vi.fn(async (sessionId: string) => BrowserObservationSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      observationId: 'obs-1',
      sessionId,
      url,
      title: 'Page',
      capturedAt: '2026-09-09T12:00:00.000Z',
      format: 'accessibility',
      text: 'snapshot',
      refs: [],
      artifacts: [],
      truncated: false,
      redactions: [],
    })),
    execute: vi.fn(async (action: ActionIntent) => ([BrowserEventSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      eventId: 'provider-event-1',
      runId: action.runId,
      sessionId: action.sessionId,
      sequence: 1,
      emittedAt: '2026-09-09T12:00:00.000Z',
      type: 'action.state_changed',
      payload: { actionId: action.actionId, state: 'committed' },
    })])),
    close: vi.fn(),
  };
}

function buildController(url: string) {
  const registry = new SiteToolRegistry();
  registry.registerAll(loadGitHubSiteTools());
  const controller = new BrowserRunController({
    providers: [mockProvider(url)],
    sourceSurface: 'platform-web',
    siteTools: registry,
    resolveToolContext: () => ({ cdpUrl: 'http://127.0.0.1:1', targetId: 'about:blank', dryRun: true }),
    now: () => new Date('2026-09-09T12:00:00.000Z'),
  });
  return controller;
}

describe('BrowserRunController site tool integration', () => {
  it('surfaces matching tool descriptors first for a github.com origin', async () => {
    const controller = buildController('https://github.com/acme/app/pull/1');
    const { run } = controller.startRun({
      accountId: 'acct-1',
      conversationId: 'conv-1',
      objective: 'Review the PR',
      provider: 'local-playwright',
      startedBy: 'platform-web',
      sessionId: 'session-1',
      runId: 'run-1',
    });
    await controller.observe(run.runId);
    const plan = controller.availableTools(run.runId);
    expect(plan.order).toEqual(['site-tool', 'dom-refs', 'vision']);
    expect(plan.tools.map((descriptor) => descriptor.name)).toEqual(
      expect.arrayContaining(['github.review_pr', 'github.triage_issue']),
    );
  });

  it('falls back to dom-refs → vision on non-matching origins', async () => {
    const controller = buildController('https://example.com/');
    const { run } = controller.startRun({
      accountId: 'acct-1',
      conversationId: 'conv-1',
      objective: 'Browse',
      provider: 'local-playwright',
      startedBy: 'platform-web',
      sessionId: 'session-1',
      runId: 'run-1',
    });
    await controller.observe(run.runId);
    expect(controller.availableTools(run.runId).order).toEqual(['dom-refs', 'vision']);
  });

  it('logs a SiteToolCall as a tool.called event and a tool_call trajectory step', async () => {
    const controller = buildController('https://github.com/acme/app/pull/1');
    const { run, lease } = controller.startRun({
      accountId: 'acct-1',
      conversationId: 'conv-1',
      objective: 'Review the PR',
      provider: 'local-playwright',
      startedBy: 'platform-web',
      sessionId: 'session-1',
      runId: 'run-1',
    });
    await controller.observe(run.runId);
    const result = await controller.executeTool({
      lease,
      toolName: 'github.review_pr',
      args: { prUrl: 'https://github.com/acme/app/pull/1', reviewText: 'LGTM' },
    });
    expect(result.toolCall.toolName).toBe('github.review_pr');
    expect(result.toolCall.error).toBeUndefined();
    expect(result.toolCall.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.events.map((event) => event.type)).toEqual(['tool.called']);

    const events = controller.eventsAfter(run.runId);
    const toolEvent = events.find((event) => event.type === 'tool.called');
    expect(toolEvent?.payload.toolCall).toMatchObject({
      toolName: 'github.review_pr',
      runId: run.runId,
      sessionId: run.sessionId,
    });

    const trajectory = controller.toTrajectory(run.runId);
    const toolStep = trajectory.steps.find((step) => step.kind === 'tool_call');
    expect(toolStep).toBeDefined();
    expect(toolStep && toolStep.status).toBe('committed');
    if (toolStep && toolStep.kind === 'tool_call') {
      expect(toolStep.toolCall.resultSummary).toContain('dry-run');
    }
  });

  it('records failed tool invocations as failed steps with the error attached', async () => {
    const controller = buildController('https://github.com/acme/app/pull/1');
    const { run, lease } = controller.startRun({
      accountId: 'acct-1',
      conversationId: 'conv-1',
      objective: 'Do something blocked',
      provider: 'local-playwright',
      startedBy: 'platform-web',
      sessionId: 'session-1',
      runId: 'run-1',
    });
    await controller.observe(run.runId);
    const result = await controller.executeTool({
      lease,
      toolName: 'github.review_pr',
      args: { requestedAction: 'delete_repository' },
    });
    expect(result.toolCall.error).toContain('delete_repository');
    const trajectory = controller.toTrajectory(run.runId);
    const toolStep = trajectory.steps.find((step) => step.kind === 'tool_call');
    expect(toolStep?.status).toBe('failed');
  });

  it('rejects tools whose origin does not match the active tab', async () => {
    const controller = buildController('https://example.com/');
    const { run, lease } = controller.startRun({
      accountId: 'acct-1',
      conversationId: 'conv-1',
      objective: 'Review a PR from the wrong tab',
      provider: 'local-playwright',
      startedBy: 'platform-web',
      sessionId: 'session-1',
      runId: 'run-1',
    });
    await controller.observe(run.runId);
    await expect(controller.executeTool({
      lease,
      toolName: 'github.review_pr',
      args: { prUrl: 'https://github.com/acme/app/pull/1', reviewText: 'LGTM' },
    })).rejects.toThrow(/not allowed for origin/);
  });

  it('interleaves action and tool_call steps in invocation order', async () => {
    const controller = buildController('https://github.com/acme/app/pull/1');
    const { run, lease } = controller.startRun({
      accountId: 'acct-1',
      conversationId: 'conv-1',
      objective: 'Navigate then review',
      provider: 'local-playwright',
      startedBy: 'platform-web',
      sessionId: 'session-1',
      runId: 'run-1',
    });
    await controller.execute({
      lease,
      action: {
        schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
        actionId: 'action-1',
        runId: run.runId,
        sessionId: run.sessionId,
        kind: 'navigate',
        reason: 'Open the PR',
        input: { url: 'https://github.com/acme/app/pull/1' },
      },
    });
    await controller.executeTool({
      lease,
      toolName: 'github.review_pr',
      args: { prUrl: 'https://github.com/acme/app/pull/1', reviewText: 'LGTM' },
    });
    const trajectory = controller.toTrajectory(run.runId);
    expect(trajectory.steps.map((step) => step.kind)).toEqual(['action', 'tool_call']);
  });
});
