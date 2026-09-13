/**
 * Tests for createCoworkSession's server round-trip:
 * - the create flow POSTs /api/v1/cowork/sessions and stores the server id on
 *   metadata.coworkServerId (which the unmount checkpoint PATCH must target);
 * - when the server never returns an id, no coworkServerId is written.
 *
 * The mode-session store underneath fires real agent-sessions API calls, so
 * fetch is mocked for every backend namespace involved and modules are
 * re-imported per test to get a fresh store singleton.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeFetchMock(serverId: string | null) {
  return vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.includes('/api/v1/agent-sessions') && method === 'POST') {
      // Backend session creation (mode-session-store). The id must look like
      // a backend id ("ses..." prefix) so updateSession keeps syncing.
      return jsonResponse({
        id: 'ses_test_1',
        name: 'Test Session',
        created_at: '2026-09-13T00:00:00.000Z',
        updated_at: '2026-09-13T00:00:00.000Z',
        message_count: 0,
        active: true,
        tags: [],
        metadata: {},
      });
    }

    if (url.includes('/api/v1/agent-sessions/') && method === 'PATCH') {
      // updateSession round-trip: echo the metadata the client sent so the
      // mapped session keeps keys like coworkServerId (as the real backend
      // merges metadata rather than replacing it).
      const sent = JSON.parse(String(init?.body ?? '{}')) as { metadata?: Record<string, unknown> };
      return jsonResponse({
        id: 'ses_test_1',
        name: 'Test Session',
        created_at: '2026-09-13T00:00:00.000Z',
        updated_at: '2026-09-13T00:00:01.000Z',
        message_count: 0,
        active: true,
        tags: [],
        metadata: sent.metadata ?? {},
      });
    }

    if (url.endsWith('/api/v1/cowork/sessions') && method === 'POST') {
      return jsonResponse(serverId ? { session: { id: serverId } } : {});
    }

    if (url.includes('/api/v1/cowork/memory')) {
      // Empty memory result: no memoryContext write, keeps the test focused.
      return jsonResponse({});
    }

    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
}

describe('createCoworkSession server round-trip', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the new session and stores the server id on metadata.coworkServerId', async () => {
    const fetchMock = makeFetchMock('srv_abc123');
    vi.stubGlobal('fetch', fetchMock);

    const { createCoworkSession, useCoworkSessionStore } = await import('./CoworkSessionStore');

    const sessionId = await createCoworkSession({ name: 'Quarterly review' });
    expect(sessionId).toBe('ses_test_1');

    const coworkPost = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/api/v1/cowork/sessions') &&
        (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(coworkPost).toBeDefined();
    const body = JSON.parse(String(coworkPost![1]!.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      title: 'Quarterly review',
      status: 'active',
      mode: 'regular',
    });

    // The fire-and-forget sync must land the server id on the session record.
    await vi.waitFor(() => {
      const session = useCoworkSessionStore
        .getState()
        .sessions.find((s) => s.id === sessionId);
      expect(session?.metadata.coworkServerId).toBe('srv_abc123');
    });
  });

  it('marks agent-mode sessions with mode "agent" on the create POST', async () => {
    const fetchMock = makeFetchMock('srv_agent1');
    vi.stubGlobal('fetch', fetchMock);

    const { createCoworkSession } = await import('./CoworkSessionStore');

    await createCoworkSession({ name: 'Agent run', sessionMode: 'agent' });

    const coworkPost = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/api/v1/cowork/sessions') &&
        (init as RequestInit | undefined)?.method === 'POST',
    );
    const body = JSON.parse(String(coworkPost![1]!.body)) as Record<string, unknown>;
    expect(body.mode).toBe('agent');
  });

  it('leaves metadata.coworkServerId unset when the server returns no id', async () => {
    const fetchMock = makeFetchMock(null);
    vi.stubGlobal('fetch', fetchMock);

    const { createCoworkSession, useCoworkSessionStore } = await import('./CoworkSessionStore');

    const sessionId = await createCoworkSession({ name: 'No server id' });

    // Give the fire-and-forget chain a chance to (incorrectly) write a key.
    await new Promise((r) => setTimeout(r, 10));
    const session = useCoworkSessionStore
      .getState()
      .sessions.find((s) => s.id === sessionId);
    expect(session?.metadata.coworkServerId).toBeUndefined();
  });
});
