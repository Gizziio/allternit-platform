// @ts-nocheck
/**
 * UDS client for Rails peer messaging.
 *
 * Sending no longer connects directly to a peer socket. Instead it posts to
 * Rails /v1/peers/send, which resolves the target via the peer registry,
 * enqueues the message on the Bus, and delivers it over UDS/bridge.
 */

const RAILS_BASE = process.env.GIZZI_RAILS_URL ?? 'http://127.0.0.1:8013/api/rails'

export interface UDSClient {
  connected: boolean
}

export function createUDSClient(): UDSClient {
  return { connected: true }
}

export function sendMessage(_client: UDSClient, _message: unknown): void {
  // Legacy outbound path; use sendToUdsSocket for real sends.
}

type PeerAddress =
  | { type: 'uds'; socket_path?: string }
  | { type: 'bridge'; endpoint?: string }
  | { type: string }

type Peer = {
  peer_id: string
  address: PeerAddress
}

/**
 * Send a plain-text message to a peer.
 *
 * @param target Either a Rails peer_id or a UDS socket path (starting with `/`).
 * @param message Plain-text message content.
 */
export async function sendToUdsSocket(target: string, message: string): Promise<void> {
  let toPeer = target
  if (target.startsWith('/')) {
    const peer = await findPeerBySocketPath(target)
    if (peer) {
      toPeer = peer.peer_id
    }
  }

  const fromPeer =
    process.env.GIZZI_SESSION_ID ??
    process.env.CLAUDE_CODE_SESSION_ID ??
    `gizzi-${process.pid}`

  const response = await fetch(`${RAILS_BASE}/v1/peers/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_peer: fromPeer,
      to_peer: toPeer,
      kind: 'text',
      payload: { text: message },
    }),
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `Rails peer send failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`,
    )
  }
}

async function findPeerBySocketPath(
  socketPath: string,
): Promise<{ peer_id: string } | null> {
  try {
    const response = await fetch(`${RAILS_BASE}/v1/peers`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) {
      return null
    }
    const data = (await response.json()) as { peers?: Peer[] }
    return (
      (data.peers ?? []).find(
        peer =>
          peer.address?.type === 'uds' &&
          'socket_path' in peer.address &&
          peer.address.socket_path === socketPath,
      ) ?? null
    )
  } catch {
    return null
  }
}
