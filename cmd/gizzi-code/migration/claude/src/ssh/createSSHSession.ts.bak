/**
 * SSH Session Creation
 * TEMPORARY SHIM
 */

import type { SSHSessionManager } from './SSHSessionManager.js'

export interface SSHSession {
  id: string
  host: string
  status: 'connected' | 'disconnected'
  createManager(config?: unknown): SSHSessionManager
  getStderrTail(): string
  proc: any
  proxy: any
}

export async function createSSHSession(
  host: string,
  config?: unknown,
): Promise<SSHSession> {
  return {
    id: `ssh-${Date.now()}`,
    host,
    status: 'connected',
    createManager() {
      // TODO: implement - should return SSHSessionManager
      return {} as any
    },
    getStderrTail() {
      return ''
    },
    proc: null,
    proxy: null,
  }
}

export default createSSHSession
