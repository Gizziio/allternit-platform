// @ts-nocheck
/**
 * UDS messaging server backed by the Rails peer registry.
 *
 * - Binds a local Unix socket inbox.
 * - Registers this gizzi-code session as a Rails peer.
 * - Queues inbound PeerMessage JSON lines and notifies via setOnEnqueue().
 */

import { createServer } from 'net'
import { mkdir, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

const RAILS_BASE = process.env.GIZZI_RAILS_URL ?? 'http://127.0.0.1:8013/api/rails'

let boundSocketPath: string | undefined
let enqueueCallback: (() => void) | undefined
const inbox: Array<{ from_peer: string; kind: string; payload: unknown }> = []

/** Return the currently bound UDS socket path, if any. */
export function getUdsMessagingSocketPath(): string | undefined {
  return boundSocketPath
}

/** Default socket path derived from the session id. */
export function getDefaultUdsSocketPath(): string {
  const sessionId =
    process.env.GIZZI_SESSION_ID ??
    process.env.CLAUDE_CODE_SESSION_ID ??
    String(process.pid)
  return join(tmpdir(), `gizzi-${sessionId}.sock`)
}

/** Register a callback fired when an inbound peer message arrives. */
export function setOnEnqueue(cb: () => void): void {
  enqueueCallback = cb
}

/** Pop the oldest queued inbound message, if any. */
export function receiveUDSMessage(): { from_peer: string; kind: string; payload: unknown } | null {
  return inbox.shift() ?? null
}

/** Outbound messages are handled by udsClient.ts via Rails peer_send. */
export function sendUDSMessage(_message: unknown): void {
  // no-op: send path goes through Rails to enable discovery and policy.
}

/**
 * Bind a UDS inbox socket and register this session with Rails.
 * Fail-open on registration errors: the local inbox still works.
 */
export async function startUdsMessaging(
  socketPath: string,
  _options?: { isExplicit?: boolean },
): Promise<void> {
  if (process.platform === 'win32') {
    throw new Error('UDS messaging is not supported on Windows')
  }

  boundSocketPath = socketPath
  process.env.GIZZI_MESSAGING_SOCKET = socketPath
  process.env.CLAUDE_CODE_MESSAGING_SOCKET = socketPath

  await mkdir(dirname(socketPath), { recursive: true }).catch(() => {})
  try {
    await unlink(socketPath)
  } catch {
    // ENOENT is expected; anything else will surface on listen.
  }

  const server = createServer(connection => {
    let buffer = ''
    connection.setEncoding('utf8')
    connection.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        queueInboundLine(line)
      }
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(socketPath, () => {
      server.off('error', reject)
      resolve()
    })
  })

  await registerPeer(socketPath).catch(error => {
    // Fail-open: local inbox still works even if Rails is down.
    const message = error instanceof Error ? error.message : String(error)
    // eslint-disable-next-line no-console
    console.warn(`[udsMessaging] peer registration failed: ${message}`)
  })
}

function queueInboundLine(line: string): void {
  try {
    const msg = JSON.parse(line) as {
      from_peer?: string
      kind?: string
      payload?: unknown
    }
    inbox.push({
      from_peer: msg.from_peer ?? 'unknown',
      kind: msg.kind ?? 'text',
      payload: msg.payload ?? line,
    })
  } catch {
    inbox.push({ from_peer: 'unknown', kind: 'raw', payload: line })
  }
  enqueueCallback?.()
}

async function registerPeer(socketPath: string): Promise<void> {
  const sessionId =
    process.env.GIZZI_SESSION_ID ??
    process.env.CLAUDE_CODE_SESSION_ID ??
    `gizzi-${process.pid}`
  const displayName =
    process.env.GIZZI_AGENT_NAME ??
    process.env.CLAUDE_CODE_AGENT_NAME ??
    `gizzi-${process.pid}`

  const response = await fetch(`${RAILS_BASE}/v1/peers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      peer_id: sessionId,
      session_id: sessionId,
      display_name: displayName,
      address: { type: 'uds', socket_path: socketPath },
      cwd: process.cwd(),
      vendor: 'allternit',
      kind: 'gizzi',
    }),
    signal: AbortSignal.timeout(5_000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`,
    )
  }
}
