/**
 * Tests for useApprovalGatePoller:
 * - accepts both the legacy { approvals: [...] } and newer { pending: [...] }
 *   response shapes, plus empty/missing payloads;
 * - dedups by actionId within a poll and prunes seen ids that vanish, so a
 *   returning approval is re-injected;
 * - only polls while a cowork session is active/streaming/blocked.
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useApprovalGatePoller } from './useApprovalGatePoller';

// Keep in sync with POLL_INTERVAL_MS in useApprovalGatePoller.ts.
const POLL_INTERVAL_MS = 5_000;

const h = vi.hoisted(() => {
  const requests: Record<string, unknown> = {};
  return {
    requests,
    sessions: [] as Array<Record<string, unknown>>,
    streamingBySession: {} as Record<string, { isStreaming?: boolean }>,
    addPermissionRequest: vi.fn((req: { requestId: string }) => {
      requests[req.requestId] = req;
    }),
  };
});

vi.mock('@/views/cowork/CoworkSessionStore', () => ({
  useCoworkSessionStore: (selector: (s: unknown) => unknown) =>
    selector({ sessions: h.sessions, streamingBySession: h.streamingBySession }),
}));

vi.mock('@/lib/agents/permission-store', () => ({
  usePermissionStore: {
    getState: () => ({ addPermissionRequest: h.addPermissionRequest }),
  },
}));

function pendingApproval(id: string) {
  return {
    actionId: id,
    sessionId: 'ses_1',
    riskLevel: 'high',
    summary: `Approve ${id}?`,
    details: { actionType: 'bash', target: 'rm -rf tmp', consequence: 'deletes tmp files' },
    requestedAt: '2026-09-13T00:00:00.000Z',
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function activeSession(overrides: Record<string, unknown> = {}) {
  h.sessions = [{ id: 'ses_1', isActive: false, metadata: {}, ...overrides }];
}

describe('useApprovalGatePoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.sessions = [];
    h.streamingBySession = {};
    for (const key of Object.keys(h.requests)) delete h.requests[key];
    h.addPermissionRequest.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('injects pending approvals from the { pending } shape', async () => {
    activeSession({ metadata: { executionStatus: 'running' } });
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ pending: [pendingApproval('a1')] })));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApprovalGatePoller(true));
    await vi.advanceTimersByTimeAsync(0);

    expect(Object.keys(h.requests)).toEqual(['a1']);
    expect(h.requests['a1']).toMatchObject({
      requestId: 'a1',
      sessionId: 'ses_1',
      permission: 'bash',
      patterns: ['rm -rf tmp'],
      metadata: expect.objectContaining({ source: 'approval-gate', riskLevel: 'high' }),
    });
  });

  it('accepts the legacy { approvals } shape and maps it the same way', async () => {
    activeSession({ isActive: true });
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ approvals: [pendingApproval('b1')] })));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApprovalGatePoller(true));
    await vi.advanceTimersByTimeAsync(0);

    expect(Object.keys(h.requests)).toEqual(['b1']);
  });

  it('tolerates empty and missing payload shapes', async () => {
    activeSession({ metadata: { executionStatus: 'blocked' } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ pending: null }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApprovalGatePoller(true));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(h.requests).toEqual({});
  });

  it('polls on the interval and dedups approvals it has already injected', async () => {
    activeSession({ metadata: { executionStatus: 'pending' } });
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ pending: [pendingApproval('a1')] })));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApprovalGatePoller(true));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.addPermissionRequest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Same actionId still pending — must not be injected twice.
    expect(h.addPermissionRequest).toHaveBeenCalledTimes(1);
  });

  it('prunes seen ids that disappear so a returning approval is re-injected', async () => {
    activeSession({ isActive: true });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ pending: [pendingApproval('a1')] }))
      .mockResolvedValueOnce(jsonResponse({ pending: [] }))
      .mockResolvedValueOnce(jsonResponse({ pending: [pendingApproval('a1')] }));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApprovalGatePoller(true));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.addPermissionRequest).toHaveBeenCalledTimes(1);

    // a1 vanished: pruned from seenIds, nothing new injected.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(h.addPermissionRequest).toHaveBeenCalledTimes(1);

    // a1 returned: pruned id means re-injection.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(h.addPermissionRequest).toHaveBeenCalledTimes(2);
  });

  it('does not poll when no cowork session is active', async () => {
    h.sessions = [];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApprovalGatePoller(true));
    await vi.advanceTimersByTimeAsync(3 * POLL_INTERVAL_MS);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.requests).toEqual({});
  });

  it('an idle session with no streaming/gate status does not poll', async () => {
    activeSession({ isActive: false, metadata: { executionStatus: 'completed' } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApprovalGatePoller(true));
    await vi.advanceTimersByTimeAsync(3 * POLL_INTERVAL_MS);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not poll when the poller is explicitly deactivated', async () => {
    activeSession({ isActive: true });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useApprovalGatePoller(false));
    await vi.advanceTimersByTimeAsync(3 * POLL_INTERVAL_MS);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
