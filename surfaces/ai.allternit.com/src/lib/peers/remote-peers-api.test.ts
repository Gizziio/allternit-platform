/**
 * Tests for the remote peers API client (BOT_TEAMMATES_SPEC Phase 3).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addRemotePeer,
  dmRemotePeer,
  getPeerRoster,
  getPeerRun,
  listRemotePeers,
  removeRemotePeer,
  runRemotePeer,
  stopPeerRun,
} from './remote-peers-api';
import { GATEWAY_BASE_URL } from '@/lib/agents/api-config';

describe('remote-peers-api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchOnce(body: unknown, ok = true, status = 200) {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
    return spy;
  }

  it('lists remote peers from /api/peers/remote', async () => {
    const spy = mockFetchOnce({
      peers: [
        { name: 'bob', url: 'http://10.0.0.2:8013', keyRef: 'K', addedAt: 't', reachable: true, lastAttemptAt: null },
      ],
    });
    const peers = await listRemotePeers();
    expect(spy).toHaveBeenCalledWith(
      `${GATEWAY_BASE_URL}/api/peers/remote`,
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }),
    );
    expect(peers).toHaveLength(1);
    expect(peers[0].name).toBe('bob');
    expect(peers[0].reachable).toBe(true);
  });

  it('registers a peer, sending the key only on the wire (never reading it back)', async () => {
    const spy = mockFetchOnce({ name: 'bob', url: 'http://10.0.0.2:8013', keyRef: 'ALLTERNIT_PEER_BOB_KEY', addedAt: 't' }, true, 201);
    await addRemotePeer({ name: 'bob', url: 'http://10.0.0.2:8013/', key: 'secret-value' });
    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    const sent = JSON.parse(String(init.body));
    expect(sent.key).toBe('secret-value');
    expect(sent.url).toBe('http://10.0.0.2:8013/');
  });

  it('removes a peer with DELETE and encodes the name', async () => {
    const spy = mockFetchOnce({ removed: true });
    await removeRemotePeer('bob node');
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${GATEWAY_BASE_URL}/api/peers/remote/bob%20node`);
    expect(init.method).toBe('DELETE');
  });

  it('fetches the union roster', async () => {
    mockFetchOnce({
      roster: [
        { name: 'gizmo', kind: 'peer', source: 'bob', url: 'http://10.0.0.2:8013', sourceReachable: false, lastSeenAt: 't' },
      ],
    });
    const roster = await getPeerRoster();
    expect(roster[0].sourceReachable).toBe(false);
    expect(roster[0].source).toBe('bob');
  });

  it('sends dm with idempotency key and remote local-peer target', async () => {
    const spy = mockFetchOnce({ run_id: 'run_1', status: 'done', reply: 'pong' });
    const result = await dmRemotePeer('bob', { message: 'ping', to: 'gizmo', idempotencyKey: 'k-1' });
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${GATEWAY_BASE_URL}/api/peers/remote/bob/dm`);
    expect(JSON.parse(String(init.body))).toEqual({ message: 'ping', to: 'gizmo', idempotencyKey: 'k-1' });
    expect(result.reply).toBe('pong');
  });

  it('sends run and maps status/stop endpoints', async () => {
    const runSpy = mockFetchOnce({ run_id: 'run_9', status: 'running' }, true, 202);
    const started = await runRemotePeer('bob', { message: 'do the thing' });
    expect(started.run_id).toBe('run_9');
    expect((runSpy.mock.calls[0][1] as RequestInit).method).toBe('POST');

    mockFetchOnce({ run_id: 'run_9', status: 'running', inbound: false, peer: 'bob', created_at: 't', expires_at: 't', updated_at: 't' });
    const status = await getPeerRun('run_9');
    expect(status.status).toBe('running');

    const stopSpy = mockFetchOnce({ run_id: 'run_9', status: 'stopped' });
    await stopPeerRun('run_9');
    expect((stopSpy.mock.calls[0][1] as RequestInit).method).toBe('POST');
    expect(stopSpy.mock.calls[0][0]).toBe(`${GATEWAY_BASE_URL}/api/peers/runs/run_9/stop`);
  });

  it('surfaces typed failure reasons from error bodies', async () => {
    mockFetchOnce({ error: 'peer unreachable', reason: 'runtime_offline' }, false, 502);
    await expect(dmRemotePeer('bob', { message: 'ping' })).rejects.toThrow('peer unreachable');
  });
});
