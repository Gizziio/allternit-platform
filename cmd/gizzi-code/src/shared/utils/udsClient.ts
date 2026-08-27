// @ts-nocheck
/**
 * UDS client for local peer-to-peer messaging.
 *
 * Sends newline-delimited JSON envelopes to a Rails peer inbox socket.
 * Messages never leave the machine.
 */

import { createConnection } from 'net'
import { generateRequestId } from './agentId.js'

export interface UDSClient {
  connected: boolean
}

export function createUDSClient(): UDSClient {
  return { connected: false }
}

export function sendMessage(_client: UDSClient, _message: any): void {
  // Legacy stub signature; real sends go through sendToUdsSocket.
}

export type PeerEnvelope = {
  message_id: string
  reply_to?: string
  from: string
  to: string
  body: string
  sent_at: string
}

export async function sendToUdsSocket(
  socketPath: string,
  body: string,
  options?: { from?: string; to?: string; timeoutMs?: number },
): Promise<void> {
  const envelope: PeerEnvelope = {
    message_id: generateRequestId('uds', socketPath),
    from: options?.from ?? 'gizzi',
    to: options?.to ?? 'peer',
    body,
    sent_at: new Date().toISOString(),
  }

  const line = JSON.stringify(envelope)
  const timeoutMs = options?.timeoutMs ?? 5000

  return new Promise((resolve, reject) => {
    const client = createConnection(socketPath)
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      client.destroy()
      reject(new Error(`UDS send timed out after ${timeoutMs}ms: ${socketPath}`))
    }, timeoutMs)

    client.on('connect', () => {
      client.write(line, 'utf-8', (writeErr) => {
        if (writeErr) {
          clearTimeout(timer)
          if (settled) return
          settled = true
          client.destroy()
          reject(writeErr)
          return
        }
        client.write('\n', 'utf-8', (endErr) => {
          clearTimeout(timer)
          if (settled) return
          settled = true
          client.end()
          if (endErr) {
            reject(endErr)
          } else {
            resolve()
          }
        })
      })
    })

    client.on('error', (err) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      client.destroy()
      reject(err)
    })
  })
}
