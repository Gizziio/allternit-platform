/**
 * Remote Peers API — client for the cross-machine bot peer fabric
 * (BOT_TEAMMATES_SPEC Phase 3, AD-1).
 *
 * Talks to `remote_peers_router` on allternit-api (`cmd/allternit-api/src/remote_peers.rs`),
 * mounted at `/api/peers/*`. Remote peers are other machines running the
 * Allternit API; each is registered with a URL and a `keyRef` naming an env
 * var on the API host (keys never leave the daemon; the `key` field is
 * accepted once at registration so the daemon can write it into its
 * gitignored `peers.env`).
 */

import { GATEWAY_BASE_URL, apiRequestWithError } from '@/lib/agents/api-config';

// ============================================================================
// Types (mirroring the Rust serde shapes)
// ============================================================================

export interface RemotePeer {
  name: string;
  url: string;
  /** Env var on the API host holding this peer's shared key. */
  keyRef: string;
  addedAt: string;
  /** Liveness as of the last roster poll/attempt. */
  reachable: boolean;
  lastAttemptAt?: string | null;
}

export type RosterRowKind = 'local-peer' | 'remote-peer' | 'peer';

export interface RosterRow {
  name: string;
  kind: RosterRowKind;
  /** Where the row came from: 'local' or the remote peer's name. */
  source: string;
  url?: string | null;
  /** Ghost-row flag: false when the source failed its last poll. */
  sourceReachable: boolean;
  lastSeenAt: string;
}

export type PeerRunStatus =
  | 'queued'
  | 'running'
  | 'stopping'
  | 'done'
  | 'failed'
  | 'stopped'
  | 'expired';

export interface PeerRunView {
  run_id: string;
  op: 'dm' | 'run';
  inbound: boolean;
  peer: string;
  status: PeerRunStatus;
  result?: string | null;
  reason?: string | null;
  created_at: string;
  expires_at: string;
  updated_at: string;
}

// ============================================================================
// Registry
// ============================================================================

export async function listRemotePeers(): Promise<RemotePeer[]> {
  const data = await apiRequestWithError<{ peers: RemotePeer[] }>(
    `${GATEWAY_BASE_URL}/api/peers/remote`,
  );
  return data.peers ?? [];
}

export interface AddRemotePeerInput {
  name: string;
  url: string;
  /** Existing env var name on the API host. */
  keyRef?: string;
  /**
   * Optional key value — the daemon persists it into its gitignored
   * `peers.env` under `keyRef` (generated as `ALLTERNIT_PEER_<NAME>_KEY`
   * when omitted). Never echoed back by the API.
   */
  key?: string;
}

export async function addRemotePeer(input: AddRemotePeerInput): Promise<RemotePeer> {
  return apiRequestWithError<RemotePeer>(`${GATEWAY_BASE_URL}/api/peers/remote`, {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      url: input.url,
      keyRef: input.keyRef,
      key: input.key,
    }),
  });
}

export async function removeRemotePeer(name: string): Promise<void> {
  await apiRequestWithError<{ removed: boolean }>(
    `${GATEWAY_BASE_URL}/api/peers/remote/${encodeURIComponent(name)}`,
    { method: 'DELETE' },
  );
}

// ============================================================================
// Union roster
// ============================================================================

export async function getPeerRoster(): Promise<RosterRow[]> {
  const data = await apiRequestWithError<{ roster: RosterRow[] }>(
    `${GATEWAY_BASE_URL}/api/peers/roster`,
  );
  return data.roster ?? [];
}

// ============================================================================
// Ops (dm / run / status / stop)
// ============================================================================

export interface PeerOpInput {
  message: string;
  /** Local rails peer on the REMOTE node that receives the envelope. */
  to?: string;
  /** Hermes-style replay: a repeat key returns the original result. */
  idempotencyKey?: string;
}

/** Synchronous: holds until the remote turn finishes (or 900s TTL). */
export async function dmRemotePeer(
  name: string,
  input: PeerOpInput,
): Promise<{ run_id: string; status: string; reply?: string | null; reason?: string | null }> {
  return apiRequestWithError(`${GATEWAY_BASE_URL}/api/peers/remote/${encodeURIComponent(name)}/dm`, {
    method: 'POST',
    body: JSON.stringify({
      message: input.message,
      to: input.to,
      idempotencyKey: input.idempotencyKey,
    }),
  });
}

/** Asynchronous: returns a run id immediately. */
export async function runRemotePeer(
  name: string,
  input: PeerOpInput,
): Promise<{ run_id: string; status: string }> {
  return apiRequestWithError(`${GATEWAY_BASE_URL}/api/peers/remote/${encodeURIComponent(name)}/run`, {
    method: 'POST',
    body: JSON.stringify({
      message: input.message,
      to: input.to,
      idempotencyKey: input.idempotencyKey,
    }),
  });
}

export async function getPeerRun(runId: string): Promise<PeerRunView> {
  return apiRequestWithError<PeerRunView>(
    `${GATEWAY_BASE_URL}/api/peers/runs/${encodeURIComponent(runId)}`,
  );
}

export async function stopPeerRun(runId: string): Promise<PeerRunView> {
  return apiRequestWithError<PeerRunView>(
    `${GATEWAY_BASE_URL}/api/peers/runs/${encodeURIComponent(runId)}/stop`,
    { method: 'POST' },
  );
}
