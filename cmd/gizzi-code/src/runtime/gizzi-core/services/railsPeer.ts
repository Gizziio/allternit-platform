// @ts-nocheck
/**
 * Rails peer registration + inbox poller for gizzi-code.
 *
 * When a session starts, it registers itself as a local Rails peer so other
 * agents on this machine can discover and message it. Instead of a UDS push
 * listener (which is brittle across Bun/Node versions and blocks the TUI queue
 * timing), we poll the allternit-api inbox endpoint for pending envelopes and
 * inject them into the command queue as task notifications.
 */

import { feature } from 'bun:bundle'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { logForDiagnosticsNoPII } from 'src/shared/utils/diagLogs.js'
import { getCwd } from 'src/shared/utils/cwd.js'
import { errorMessage } from 'src/shared/utils/errors.js'
import { generateRequestId } from 'src/shared/utils/agentId.js'
import { enqueuePendingNotification } from 'src/shared/utils/messageQueueManager.js'
import { isEnvTruthy } from 'src/shared/utils/envUtils.js'
import type { QueuedCommand } from 'src/shared/types/textInputTypes.js'
import { Log } from 'src/shared/util/log.js'
import {
  getAllternitApiConfig,
  registerApiPeer,
  pollApiPeerInbox,
  type ApiPeerRegisterResponse,
} from '../../services/api/allternitApi.js'

let registeredPeer: ApiPeerRegisterResponse | null = null
let pollIntervalId: ReturnType<typeof setInterval> | null = null
let seenMessageIds = new Set<number>()

export type RailsInboxMessageHandler = (command: QueuedCommand) => void

function formatIncomingMessage(envelope: {
  from?: string
  body?: string
}): string {
  const from = envelope.from ?? 'unknown'
  const body = envelope.body ?? ''
  return `<cross-session-message from="${from}">\n${body}\n</cross-session-message>`
}

export async function registerRailsPeer(
  sessionId: string,
): Promise<ApiPeerRegisterResponse | null> {
  // Gate is evaluated at runtime so the bundler cannot tree-shake the module.
  if (!feature('UDS_INBOX') && !isEnvTruthy(process.env.GIZZI_ENABLE_RAILS_PEER)) {
    return null
  }
  try {
    const config = getAllternitApiConfig()
    const cwd = getCwd()
    // Sanitize session id into a peer name: keep alphanumerics, dashes, underscores.
    const name = `gizzi-${sessionId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64)}`
    const peer = await registerApiPeer(config, {
      name,
      vendor: 'gizzi',
      cwd,
    })
    registeredPeer = peer
    process.env.ALLTERNIT_RAILS_PEER_NAME = peer.name
    process.env.ALLTERNIT_RAILS_INBOX = peer.inbox_socket
    // The Rails registry marks peers dead if the inbox socket path does not
    // exist. HTTP-polling peers do not bind a real UDS server, so create a
    // placeholder file to keep the peer status active.
    try {
      mkdirSync(dirname(peer.inbox_socket), { recursive: true })
      writeFileSync(peer.inbox_socket, '')
    } catch (error) {
      logForDiagnosticsNoPII('info', 'rails_inbox_placeholder_failed', {
        error: errorMessage(error),
      })
    }
    logForDiagnosticsNoPII('info', 'rails_peer_registered', {
      peer_name: peer.name,
      inbox_socket: peer.inbox_socket,
    })
    return peer
  } catch (error) {
    logForDiagnosticsNoPII('info', 'rails_peer_registration_failed', {
      error: errorMessage(error),
    })
    return null
  }
}

export function getRegisteredRailsPeer(): ApiPeerRegisterResponse | null {
  return registeredPeer
}

export function startRailsInboxListener(
  onMessage?: RailsInboxMessageHandler,
): void {
  if (!registeredPeer) return

  const peerName = registeredPeer.name
  const config = getAllternitApiConfig()

  function dispatch(envelope: { from?: string; body?: string; message_id?: number }): void {
    Log.Default.info('rails_inbox_envelope_received', {
      from: envelope.from,
      message_id: envelope.message_id,
      body_preview: String(envelope.body ?? '').slice(0, 80),
    })
    const command: QueuedCommand = {
      value: formatIncomingMessage(envelope),
      mode: 'task-notification',
      priority: 'later',
      uuid: generateRequestId('rails-inbox', String(envelope.message_id ?? 'unknown')),
      skipSlashCommands: true,
      isMeta: false,
      origin: { kind: 'rails_peer', peerName: String(envelope.from ?? 'unknown') },
    }
    if (onMessage) {
      onMessage(command)
    } else {
      enqueuePendingNotification(command)
    }
  }

  async function pollOnce(): Promise<void> {
    try {
      const inbox = await pollApiPeerInbox(config, peerName, 20)
      for (const msg of inbox.messages) {
        if (seenMessageIds.has(msg.id)) continue
        seenMessageIds.add(msg.id)
        const body =
          typeof msg.payload === 'object' && msg.payload !== null
            ? String((msg.payload as Record<string, unknown>).body ?? '')
            : ''
        const from =
          typeof msg.payload === 'object' && msg.payload !== null
            ? String((msg.payload as Record<string, unknown>).from ?? msg.from)
            : msg.from
        dispatch({ from, body, message_id: msg.id })
      }
    } catch (error) {
      logForDiagnosticsNoPII('info', 'rails_inbox_poll_error', {
        error: errorMessage(error),
      })
    }
  }

  // Poll immediately, then every 2 seconds.
  pollOnce().catch(() => {})
  pollIntervalId = setInterval(() => {
    pollOnce().catch(() => {})
  }, 2_000)

  // Best-effort heartbeat while the session runs.
  const heartbeatInterval = setInterval(() => {
    if (!registeredPeer) {
      clearInterval(heartbeatInterval)
      return
    }
    heartbeatRailsPeer(registeredPeer.name).catch(() => {})
  }, 30_000)

  // Stop polling and heartbeat when the process exits.
  process.once('exit', () => {
    clearInterval(heartbeatInterval)
    stopRailsInboxListener()
  })

  logForDiagnosticsNoPII('info', 'rails_inbox_polling_started', { peer_name: peerName })
}

export function stopRailsInboxListener(): void {
  if (pollIntervalId) {
    clearInterval(pollIntervalId)
    pollIntervalId = null
  }
}

async function heartbeatRailsPeer(name: string): Promise<void> {
  try {
    const config = getAllternitApiConfig()
    const res = await fetch(
      `${config.baseUrl}/api/rails/peers/${encodeURIComponent(name)}/heartbeat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-allternit-user-id': config.userId,
          ...(config.token
            ? { Authorization: `Bearer ${config.token}` }
            : { 'x-allternit-desktop-access-token': 'gizzi-local-token' }),
        },
      },
    )
    if (!res.ok) {
      throw new Error(`heartbeat failed: ${res.status}`)
    }
  } catch (error) {
    logForDiagnosticsNoPII('info', 'rails_peer_heartbeat_failed', {
      error: errorMessage(error),
    })
  }
}
