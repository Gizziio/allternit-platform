import { describe, expect, it, vi } from 'vitest';
import {
  BrowserEventSchema,
  BrowserObservationSchema,
  COMPUTER_USE_PROTOCOL_VERSION,
  type ActionIntent,
  type BrowserProvider,
} from '@allternit/computer-use-protocol';
import { BrowserRunController } from './run-controller.js';

const provider: BrowserProvider = {
  capabilities: {
    provider: 'local-playwright',
    capabilities: ['navigate', 'interact.pointer', 'observe.accessibility'],
    local: true,
    attachedToUserSession: false,
    supportsPrivateNetwork: true,
    supportsPersistentProfile: true,
  },
  observe: vi.fn(async (sessionId: string) => BrowserObservationSchema.parse({
    schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
    observationId: 'obs-1',
    sessionId,
    url: 'https://example.com/',
    title: 'Example',
    capturedAt: '2026-07-10T20:00:00.000Z',
    format: 'accessibility',
    text: 'Example page',
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
    emittedAt: '2026-07-10T20:00:00.000Z',
    type: 'action.state_changed',
    payload: { actionId: action.actionId, state: 'committed' },
  })])),
  close: vi.fn(),
};

describe('BrowserRunController', () => {
  it('starts a run, executes through a provider, and records a unified event stream', async () => {
    const controller = new BrowserRunController({
      providers: [provider],
      sourceSurface: 'platform-web',
      now: () => new Date('2026-07-10T20:00:00.000Z'),
    });
    const { run, lease } = controller.startRun({
      accountId: 'acct-1',
      conversationId: 'conv-1',
      objective: 'Open example',
      provider: 'local-playwright',
      startedBy: 'platform-web',
      sessionId: 'session-1',
      runId: 'run-1',
    });
    const result = await controller.execute({
      lease,
      action: {
        schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
        actionId: 'action-1',
        runId: run.runId,
        sessionId: run.sessionId,
        kind: 'navigate',
        reason: 'Open the page',
        input: { url: 'https://example.com/' },
      },
    });
    expect(result.run.lastSequence).toBe(4);
    expect(result.receipt?.outcome).toBe('committed');
    expect(controller.eventsAfter(run.runId).map((event) => event.type)).toEqual([
      'run.started',
      'action.state_changed',
      'action.state_changed',
      'receipt.issued',
    ]);
  });

  it('pauses for approval when policy requires it', async () => {
    const controller = new BrowserRunController({
      providers: [provider],
      policy: () => ({
        decision: 'require_approval',
        policyId: 'approval-for-side-effects',
        reason: 'Needs human review',
        risk: 'high',
      }),
      now: () => new Date('2026-07-10T20:00:00.000Z'),
    });
    const { run, lease } = controller.startRun({
      accountId: 'acct-1',
      conversationId: 'conv-1',
      objective: 'Submit a form',
      provider: 'local-playwright',
      startedBy: 'desktop',
      sessionId: 'session-approval',
      runId: 'run-approval',
    });
    const result = await controller.execute({
      lease,
      action: {
        schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
        actionId: 'action-approval',
        runId: run.runId,
        sessionId: run.sessionId,
        kind: 'click',
        reason: 'Submit the order',
        targetRef: 'e1',
        input: {},
      },
    });
    expect(result.run.state).toBe('approval_pending');
    expect(result.approval?.risk).toBe('high');
    expect(provider.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects expired leases before invoking the provider', async () => {
    const controller = new BrowserRunController({
      providers: [provider],
      now: () => new Date('2026-07-10T20:00:00.000Z'),
    });
    const { run, lease } = controller.startRun({
      accountId: 'acct-1',
      conversationId: 'conv-1',
      objective: 'Open example',
      provider: 'local-playwright',
      startedBy: 'gizzi',
      sessionId: 'session-expired',
      runId: 'run-expired',
    });
    await expect(controller.execute({
      lease: { ...lease, expiresAt: '2026-07-10T19:59:59.000Z' },
      action: {
        schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
        actionId: 'action-expired',
        runId: run.runId,
        sessionId: run.sessionId,
        kind: 'navigate',
        reason: 'Open the page',
        input: { url: 'https://example.com/' },
      },
    })).rejects.toThrow('has expired');
  });
});
