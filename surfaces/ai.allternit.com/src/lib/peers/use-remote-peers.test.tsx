/**
 * Tests for useRemotePeers (BOT_TEAMMATES_SPEC Phase 3): list/add/remove,
 * reachability derivation, and ghost-row awareness.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRemotePeers } from './use-remote-peers';
import * as api from './remote-peers-api';
import type { RemotePeer, RosterRow } from './remote-peers-api';

vi.mock('./remote-peers-api', async (importOriginal) => {
  const original = await importOriginal<typeof api>();
  return {
    ...original,
    listRemotePeers: vi.fn(),
    getPeerRoster: vi.fn(),
    addRemotePeer: vi.fn(),
    removeRemotePeer: vi.fn(),
  };
});

const listMock = vi.mocked(api.listRemotePeers);
const rosterMock = vi.mocked(api.getPeerRoster);
const addMock = vi.mocked(api.addRemotePeer);
const removeMock = vi.mocked(api.removeRemotePeer);

const PEER: RemotePeer = {
  name: 'bob',
  url: 'http://10.0.0.2:8013',
  keyRef: 'ALLTERNIT_PEER_BOB_KEY',
  addedAt: '2026-09-07T00:00:00Z',
  reachable: true,
  lastAttemptAt: null,
};

function rosterRow(overrides: Partial<RosterRow>): RosterRow {
  return {
    name: 'gizmo',
    kind: 'peer',
    source: 'bob',
    url: 'http://10.0.0.2:8013',
    sourceReachable: true,
    lastSeenAt: '2026-09-07T00:00:00Z',
    ...overrides,
  };
}

describe('useRemotePeers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([PEER]);
    rosterMock.mockResolvedValue([rosterRow({})]);
  });

  it('loads peers and roster on mount', async () => {
    const { result } = renderHook(() => useRemotePeers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.peers.map((p) => p.name)).toEqual(['bob']);
    expect(result.current.roster).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('exposes reachability and no ghosts when all sources poll OK', async () => {
    const { result } = renderHook(() => useRemotePeers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reachabilityByPeer['bob']).toBe(true);
    expect(result.current.unreachableSources).toEqual([]);
  });

  it('flags ghost rows when a source fails its poll', async () => {
    rosterMock.mockResolvedValue([
      rosterRow({ name: 'gizmo', source: 'bob', sourceReachable: false }),
      rosterRow({ name: 'remotegizmo', source: 'carol', sourceReachable: true }),
    ]);
    const { result } = renderHook(() => useRemotePeers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unreachableSources).toEqual(['bob']);
    expect(result.current.reachabilityByPeer['gizmo']).toBe(false);
    expect(result.current.reachabilityByPeer['remotegizmo']).toBe(true);
  });

  it('falls back to peer liveness when the roster has no row for a peer', async () => {
    rosterMock.mockResolvedValue([]);
    listMock.mockResolvedValue([{ ...PEER, reachable: false }]);
    const { result } = renderHook(() => useRemotePeers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reachabilityByPeer['bob']).toBe(false);
  });

  it('addPeer posts then refreshes', async () => {
    addMock.mockResolvedValue(PEER);
    const { result } = renderHook(() => useRemotePeers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addPeer({ name: 'carol', url: 'http://10.0.0.3:8013', key: 'k' });
    });
    expect(addMock).toHaveBeenCalledWith({ name: 'carol', url: 'http://10.0.0.3:8013', key: 'k' });
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('removePeer deletes then refreshes', async () => {
    const { result } = renderHook(() => useRemotePeers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.removePeer('bob');
    });
    expect(removeMock).toHaveBeenCalledWith('bob');
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
