/**
 * Tests for the unmount checkpoint save: the PATCH must target the server
 * id from metadata.coworkServerId (never the local mode-session id), and
 * must be skipped entirely when the creation sync never landed a server id.
 */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useCoworkCheckpointOnUnmount } from './useCoworkCheckpointOnUnmount';
import type { ModeSession } from '@/lib/agents/mode-session-store';

const h = vi.hoisted(() => ({
  sessions: [] as Array<Pick<ModeSession, 'id' | 'metadata' | 'messages'>>,
}));

vi.mock('./CoworkSessionStore', () => ({
  useCoworkSessionStore: {
    getState: () => ({ sessions: h.sessions }),
  },
}));

function makeSession(
  overrides: Partial<Pick<ModeSession, 'id' | 'metadata' | 'messages'>> = {},
): Pick<ModeSession, 'id' | 'metadata' | 'messages'> {
  return {
    id: 'ses_local_1',
    metadata: { originSurface: 'cowork' },
    messages: [],
    ...overrides,
  };
}

describe('useCoworkCheckpointOnUnmount', () => {
  beforeEach(() => {
    h.sessions = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PATCHes /api/v1/cowork/sessions/:serverId with the checkpoint on unmount', async () => {
    h.sessions = [
      makeSession({
        metadata: { originSurface: 'cowork', coworkServerId: 'srv_99' },
        messages: [
          { id: 'm1', role: 'user', content: 'hello', timestamp: '2026-09-13T00:00:00.000Z' },
          { id: 'm2', role: 'assistant', content: 'done', timestamp: '2026-09-13T00:00:01.000Z' },
        ],
      }),
    ];
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useCoworkCheckpointOnUnmount('ses_local_1'));
    expect(fetchMock).not.toHaveBeenCalled();

    unmount();
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/cowork/sessions/srv_99');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(String(init.body)) as {
      status: string;
      checkpoint: { messageCount: number; lastMessage: string; savedAt: string };
    };
    expect(body.status).toBe('paused');
    expect(body.checkpoint.messageCount).toBe(2);
    expect(body.checkpoint.lastMessage).toBe('done');
    expect(body.checkpoint.savedAt).toBeTruthy();
  });

  it('targets the server id of the session that is active at unmount time', async () => {
    h.sessions = [
      makeSession({ id: 'ses_a', metadata: { originSurface: 'cowork', coworkServerId: 'srv_a' } }),
      makeSession({ id: 'ses_b', metadata: { originSurface: 'cowork', coworkServerId: 'srv_b' } }),
    ];
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    const { rerender, unmount } = renderHook(
      ({ sid }: { sid: string | null }) => useCoworkCheckpointOnUnmount(sid),
      { initialProps: { sid: 'ses_a' as string | null } },
    );
    rerender({ sid: 'ses_b' });

    unmount();
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/v1/cowork/sessions/srv_b');
  });

  it('skips the PATCH when the session has no coworkServerId', () => {
    h.sessions = [makeSession()];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useCoworkCheckpointOnUnmount('ses_local_1'));
    unmount();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the PATCH when no session was ever active', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useCoworkCheckpointOnUnmount(null));
    unmount();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
