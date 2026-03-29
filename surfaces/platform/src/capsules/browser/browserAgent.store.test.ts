import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBrowserAgentStore } from './browserAgent.store';

// ─── Mock fetch ───────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Minimal EventSource mock ────────────────────────────────

class MockEventSource {
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  static instances: MockEventSource[] = [];

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  emit(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  close() {}
}

vi.stubGlobal('EventSource', MockEventSource);

// ─── Helpers ──────────────────────────────────────────────────

function resetStore() {
  useBrowserAgentStore.setState({
    status: 'Idle',
    mode: 'Human',
    endpoint: null,
    currentRunId: null,
    currentAction: null,
    goal: '',
    requiresApproval: false,
    approvalActionSummary: undefined,
    approvalRiskTier: undefined,
    receipts: [],
    connectedEndpoints: [],
    aciSessionId: null,
    screenshot: null,
    pageAgentSessionId: null,
    pageAgentStatus: 'idle',
    pageAgentActivity: null,
    pageAgentHistory: [],
    pageAgentSessions: [],
    aciModel: 'anthropic/claude-sonnet-4.6',
    lastEventMessage: null,
    currentAdapterId: null,
    currentLayer: null,
    fallbackCount: 0,
  });
}

describe('browserAgent.store', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    mockFetch.mockReset();
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runGoal POSTs to /api/aci/run and sets Running status', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ sessionId: 'ses-1', adapterId: 'anthropic.claude-sonnet-4-6' }),
    });

    useBrowserAgentStore.getState().runGoal('Open example.com');

    expect(useBrowserAgentStore.getState().status).toBe('Running');
    expect(useBrowserAgentStore.getState().goal).toBe('Open example.com');

    await new Promise((r) => setTimeout(r, 0)); // flush promise

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/aci/run',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"goal":"Open example.com"'),
      }),
    );
    // model string (not provider-locked adapter name) is sent
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toMatch(/\//); // must be 'provider/model' format, not 'anthropic'|'openai'

    expect(useBrowserAgentStore.getState().aciSessionId).toBe('ses-1');
    expect(useBrowserAgentStore.getState().currentAdapterId).toBe('anthropic.claude-sonnet-4-6');
  });

  it('SSE state event updates status and lastEventMessage', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ sessionId: 'ses-2', adapterId: 'anthropic.x' }),
    });

    useBrowserAgentStore.getState().runGoal('Do something');
    await new Promise((r) => setTimeout(r, 0));

    const es = MockEventSource.instances[0];
    es.emit({
      type: 'state',
      data: { status: 'Running', lastMessage: 'Clicking login', adapterId: 'anthropic.x', stepIndex: 1 },
      ts: Date.now(),
    });

    expect(useBrowserAgentStore.getState().status).toBe('Running');
    expect(useBrowserAgentStore.getState().lastEventMessage).toBe('Clicking login');
  });

  it('SSE screenshot event sets store.screenshot', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ sessionId: 'ses-3', adapterId: 'anthropic.x' }),
    });

    useBrowserAgentStore.getState().runGoal('Capture screen');
    await new Promise((r) => setTimeout(r, 0));

    const es = MockEventSource.instances[0];
    es.emit({ type: 'screenshot', data: { screenshot: 'base64datahere' }, ts: Date.now() });

    expect(useBrowserAgentStore.getState().screenshot).toBe('base64datahere');
  });

  it('SSE WaitingApproval state derives requiresApproval and approvalActionSummary', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ sessionId: 'ses-4', adapterId: 'anthropic.x' }),
    });

    useBrowserAgentStore.getState().runGoal('Submit form');
    await new Promise((r) => setTimeout(r, 0));

    const es = MockEventSource.instances[0];
    es.emit({
      type: 'state',
      data: {
        status: 'WaitingApproval',
        currentAction: { type: 'click', label: 'Click submit', risk: 3 },
        stepIndex: 2,
      },
      ts: Date.now(),
    });

    const state = useBrowserAgentStore.getState();
    expect(state.requiresApproval).toBe(true);
    expect(state.approvalActionSummary).toBe('Click submit');
    expect(state.approvalRiskTier).toBe(3);
  });

  it('approveAction POSTs to /api/aci/approve/[id]', async () => {
    useBrowserAgentStore.setState({ aciSessionId: 'ses-approve', requiresApproval: true });
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    useBrowserAgentStore.getState().approveAction();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/aci/approve/ses-approve',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(useBrowserAgentStore.getState().requiresApproval).toBe(false);
  });

  it('denyAction POSTs to /api/aci/approve/[id]?deny=true and sets Blocked', async () => {
    useBrowserAgentStore.setState({ aciSessionId: 'ses-deny', requiresApproval: true });
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    useBrowserAgentStore.getState().denyAction();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/aci/approve/ses-deny?deny=true',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(useBrowserAgentStore.getState().status).toBe('Blocked');
    expect(useBrowserAgentStore.getState().requiresApproval).toBe(false);
  });

  it('stopExecution POSTs to /api/aci/stop/[id] and sets Done', async () => {
    useBrowserAgentStore.setState({ aciSessionId: 'ses-stop', status: 'Running' });
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    useBrowserAgentStore.getState().stopExecution();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/aci/stop/ses-stop',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(useBrowserAgentStore.getState().status).toBe('Done');
  });

  it('runPageAgentGoal keeps ACI status idle and uses pageAgentStatus for extension runs', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ sessionId: 'page-1' }),
    });

    useBrowserAgentStore.getState().runPageAgentGoal('Summarize this page', {
      apiKey: 'NA',
      baseURL: 'https://api.example.com/v1',
      model: 'gpt-5.4',
      language: 'en-US',
      maxSteps: 24,
      systemInstruction: 'Stay on the current page unless you need a new tab.',
      experimentalLlmsTxt: true,
    });

    let state = useBrowserAgentStore.getState();
    expect(state.status).toBe('Idle');
    expect(state.pageAgentStatus).toBe('running');
    expect(state.pageAgentActivity).toEqual({ type: 'thinking' });

    await new Promise((r) => setTimeout(r, 0));

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/page-agent/run',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          task: 'Summarize this page',
          config: {
            apiKey: 'NA',
            baseURL: 'https://api.example.com/v1',
            model: 'gpt-5.4',
            language: 'en-US',
            maxSteps: 24,
            systemInstruction: 'Stay on the current page unless you need a new tab.',
            experimentalLlmsTxt: true,
          },
        }),
      }),
    );

    const es = MockEventSource.instances[0];
    es.emit({
      type: 'history',
      payload: {
        events: [{ type: 'observation', content: 'Read the current page.' }],
      },
      timestamp: Date.now(),
    });

    es.emit({
      type: 'status',
      payload: { status: 'running' },
      timestamp: Date.now(),
    });

    state = useBrowserAgentStore.getState();
    expect(state.status).toBe('Idle');
    expect(state.pageAgentStatus).toBe('running');
    expect(state.pageAgentHistory).toEqual([{ type: 'observation', content: 'Read the current page.' }]);

    es.emit({
      type: 'done',
      payload: { success: true, data: 'Finished summary' },
      timestamp: Date.now(),
    });

    state = useBrowserAgentStore.getState();
    expect(state.status).toBe('Idle');
    expect(state.pageAgentStatus).toBe('completed');
    expect(state.pageAgentActivity).toBeNull();
    expect(state.pageAgentSessions).toHaveLength(1);
    expect(state.pageAgentSessions[0]?.task).toBe('Summarize this page');
    expect(state.pageAgentSessions[0]?.history).toEqual([
      { type: 'observation', content: 'Read the current page.' },
    ]);
  });
});
