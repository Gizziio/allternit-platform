/**
 * Allternit Computer Use Engine - TypeScript SDK EventStream Tests
 *
 * Verifies the EventStream against the shipped gateway run-events contract
 * (PR #152): GET /v1/computer-use/runs/{id}/events, every event a JSON
 * envelope {event_type, run_id, message, data} on the default SSE message
 * channel, terminal sentinel run.ended, and machine-readable
 * approval.required / approval.resolved events with data.status.
 */

import { AllternitComputerUseClient } from '../src/client';
import { ApprovalHandler, ApprovalPredicates } from '../src/approvals';
import type { EngineEvent } from '../src/types';

// Mock fetch for the approval submission test
global.fetch = jest.fn() as unknown as typeof fetch;
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock EventSource: the gateway sends all events as `data:` lines with no
// named SSE `event:` field, so tests deliver envelopes through the
// 'message' listeners registered via addEventListener (or onmessage).
interface MockEventSourceInstance {
  url: string;
  init?: { headers?: Record<string, string> };
  readyState: number;
  close: () => void;
  emitEnvelope: (envelope: unknown) => void;
  emitError: (error: Error) => void;
}

const mockInstances: MockEventSourceInstance[] = [];

jest.mock('eventsource', () => {
  class MockEventSource {
    url: string;
    init?: { headers?: Record<string, string> };
    onmessage: ((event: { data: string; type: string }) => void) | null = null;
    onerror: ((error: Error) => void) | null = null;
    onopen: (() => void) | null = null;
    readyState = 0;
    private listeners = new Map<string, Array<(event: { data: string; type: string }) => void>>();

    constructor(url: string, init?: { headers?: Record<string, string> }) {
      this.url = url;
      this.init = init;
      mockInstances.push(this as unknown as MockEventSourceInstance);
    }

    addEventListener(type: string, listener: (event: { data: string; type: string }) => void): void {
      const existing = this.listeners.get(type) ?? [];
      existing.push(listener);
      this.listeners.set(type, existing);
    }

    removeEventListener(type: string, listener: (event: { data: string; type: string }) => void): void {
      const existing = this.listeners.get(type) ?? [];
      this.listeners.set(type, existing.filter((l) => l !== listener));
    }

    close(): void {
      this.readyState = 2;
    }

    emitEnvelope(envelope: unknown): void {
      const event = { data: JSON.stringify(envelope), type: 'message' };
      for (const listener of this.listeners.get('message') ?? []) {
        listener(event);
      }
      this.onmessage?.(event);
    }

    emitError(error: Error): void {
      this.onerror?.(error);
    }
  }
  return { EventSource: MockEventSource };
});

/** Feed a sequence of gateway envelopes to the most recent connection. */
function emit(sequence: unknown[]): void {
  const instance = mockInstances[mockInstances.length - 1];
  for (const envelope of sequence) {
    instance.emitEnvelope(envelope);
  }
}

describe('EventStream — gateway run-events contract', () => {
  let client: AllternitComputerUseClient;

  beforeEach(() => {
    mockInstances.length = 0;
    mockedFetch.mockReset();
    client = new AllternitComputerUseClient({ endpoint: 'http://localhost:8080' });
  });

  it('connects to /v1/computer-use/runs/{id}/events (not /stream/{id})', () => {
    client.subscribeToRun('run-1', jest.fn());

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0].url).toBe(
      'http://localhost:8080/v1/computer-use/runs/run-1/events'
    );
  });

  it('parses the gateway envelope {event_type, run_id, message, data}', () => {
    const events: EngineEvent[] = [];
    client.subscribeToRun('run-1', (event) => {
      events.push(event);
    });

    emit([
      {
        event_type: 'action.started',
        run_id: 'run-1',
        message: 'click (#0)',
        data: { index: 0, action_id: 'act-0', kind: 'click' },
      },
    ]);

    expect(events).toEqual([
      {
        run_id: 'run-1',
        event_type: 'action.started',
        message: 'click (#0)',
        data: { index: 0, action_id: 'act-0', kind: 'click' },
      },
    ]);
  });

  it('ignores non-JSON / non-envelope payloads without calling back', () => {
    const callback = jest.fn();
    client.subscribeToRun('run-1', callback);

    // the parser logs rejected payloads; silence that for this negative case
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const instance = mockInstances[0];
    instance.emitEnvelope('not json');
    instance.emitEnvelope({ no_event_type: true });
    errorSpy.mockRestore();

    expect(callback).not.toHaveBeenCalled();
  });

  it('waitForApproval resolves on approval.required with data.status awaiting_approval', async () => {
    const promise = client.waitForApproval('run-1');

    emit([
      {
        event_type: 'approval.required',
        run_id: 'run-1',
        message: 'approval.required',
        data: {
          status: 'awaiting_approval',
          kind: 'planning_loop',
          step: 3,
          risk_level: 'high',
          timeout_seconds: 120,
          run_id: 'run-1',
        },
      },
    ]);

    const event = await promise;
    expect(event.event_type).toBe('approval.required');
    expect((event.data as { status: string }).status).toBe('awaiting_approval');
    expect((event.data as { kind: string }).kind).toBe('planning_loop');
  });

  it('waitForApproval rejects when the run ends without approval', async () => {
    const promise = client.waitForApproval('run-1');

    emit([
      {
        event_type: 'run.ended',
        run_id: 'run-1',
        message: 'completed',
        data: { run_id: 'run-1', status: 'completed' },
      },
    ]);

    await expect(promise).rejects.toThrow(
      'Run run-1 ended without requiring approval'
    );
  });

  it('waitForRun resolves on the run.ended sentinel and auto-closes', async () => {
    const promise = client.waitForRun('run-1');

    emit([
      {
        event_type: 'action.completed',
        run_id: 'run-1',
        message: 'click (#0): ok',
        data: { index: 0, action_id: 'act-0', kind: 'click', status: 'ok', error: null },
      },
      {
        event_type: 'run.ended',
        run_id: 'run-1',
        message: 'completed',
        data: { run_id: 'run-1', status: 'completed', result: { succeeded: 1 } },
      },
    ]);

    const event = await promise;
    expect(event.event_type).toBe('run.ended');
    expect(mockInstances[0].readyState).toBe(2);
  });

  it('approval.resolved events parse with run status and decision', () => {
    const events: EngineEvent[] = [];
    client.subscribeToRun('run-1', (event) => {
      events.push(event);
    });

    emit([
      {
        event_type: 'approval.resolved',
        run_id: 'run-1',
        message: 'approval.resolved',
        data: {
          status: 'running',
          kind: 'planning_loop',
          approved: true,
          timed_out: false,
          run_id: 'run-1',
        },
      },
    ]);

    expect(events[0].event_type).toBe('approval.resolved');
    expect(events[0].data).toEqual({
      status: 'running',
      kind: 'planning_loop',
      approved: true,
      timed_out: false,
      run_id: 'run-1',
    });
  });

  it('watchRun auto-approves via POST /runs/{id}/approve on approval.required', async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ run_id: 'run-1', decision: 'approve', acknowledged: true }),
    } as Response);

    const handler = new ApprovalHandler(client);
    handler.watchRun('run-1', ApprovalPredicates.always());

    expect(mockInstances).toHaveLength(1);

    emit([
      {
        event_type: 'approval.required',
        run_id: 'run-1',
        message: 'approval.required',
        data: { status: 'awaiting_approval', kind: 'replay.deviation', run_id: 'run-1' },
      },
    ]);

    // flush the async handleEvent → submitDecision → client.approve chain
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockedFetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/computer-use/runs/run-1/approve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ decision: 'approve' }),
      })
    );

    handler.unwatchRun('run-1');
  });
});
