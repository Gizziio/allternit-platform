/**
 * useRemotePeers — remote peer registry + union roster state for the
 * cross-machine fabric (BOT_TEAMMATES_SPEC Phase 3).
 *
 * Ghost-row awareness: the hook exposes `unreachableSources` (remote peers
 * whose last roster poll failed) and per-row `sourceReachable`. TEAMMATES
 * row rendering can use these to mute bots from unreachable sources
 * (integration point — the hook provides the capability; the rail row
 * rendering is wired separately).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addRemotePeer,
  getPeerRoster,
  listRemotePeers,
  removeRemotePeer,
  type AddRemotePeerInput,
  type RemotePeer,
  type RosterRow,
} from './remote-peers-api';

/** Client-side refresh cadence; the daemon's own roster poll is 5 min. */
const REFRESH_INTERVAL_MS = 30_000;

export interface RemotePeersState {
  peers: RemotePeer[];
  roster: RosterRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addPeer: (input: AddRemotePeerInput) => Promise<void>;
  removePeer: (name: string) => Promise<void>;
  /** Remote peer name -> reachable, derived from the union roster. */
  reachabilityByPeer: Record<string, boolean>;
  /** Sources (remote peer names) currently unreachable — ghost rows. */
  unreachableSources: string[];
}

export function useRemotePeers(): RemotePeersState {
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [peerList, rosterRows] = await Promise.all([
        listRemotePeers(),
        getPeerRoster(),
      ]);
      if (!mounted.current) return;
      setPeers(peerList);
      setRoster(rosterRows);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const addPeer = useCallback(
    async (input: AddRemotePeerInput) => {
      await addRemotePeer(input);
      await refresh();
    },
    [refresh],
  );

  const removePeer = useCallback(
    async (name: string) => {
      await removeRemotePeer(name);
      await refresh();
    },
    [refresh],
  );

  const { reachabilityByPeer, unreachableSources } = useMemo(() => {
    const map: Record<string, boolean> = {};
    const ghosts = new Set<string>();
    for (const row of roster) {
      // Local rows are always reachable; remote-sourced rows carry the
      // ghost flag from the daemon's last poll.
      if (row.kind === 'peer' && !row.sourceReachable) {
        ghosts.add(row.source);
      }
      if (row.kind === 'remote-peer') {
        map[row.name] = row.sourceReachable;
      } else if (!(row.name in map)) {
        map[row.name] = row.sourceReachable;
      }
    }
    for (const peer of peers) {
      if (!(peer.name in map)) map[peer.name] = peer.reachable;
    }
    return { reachabilityByPeer: map, unreachableSources: Array.from(ghosts) };
  }, [roster, peers]);

  return {
    peers,
    roster,
    loading,
    error,
    refresh,
    addPeer,
    removePeer,
    reachabilityByPeer,
    unreachableSources,
  };
}
