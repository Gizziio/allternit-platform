/**
 * SSH Session Manager
 * TEMPORARY SHIM
 */

export interface SSHSessionManager {
  id: string
  proc: any
  proxy: any
  connect(): void
  disconnect(): void
  sendMessage(msg: unknown): void
  sendInterrupt(): void
  respondToPermissionRequest(id: string, decision: unknown): void
  getStderrTail(): string
}

export class SSHSessionManagerImpl implements SSHSessionManager {
  id: string
  proc: any
  proxy: any

  constructor(id: string) {
    this.id = id
    this.proc = null
    this.proxy = null
  }

  connect(): void {
    // TODO: implement
  }

  disconnect(): void {
    // TODO: implement
  }

  sendMessage(_msg: unknown): void {
    // TODO: implement
  }

  sendInterrupt(): void {
    // TODO: implement
  }

  respondToPermissionRequest(_id: string, _decision: unknown): void {
    // TODO: implement
  }

  getStderrTail(): string {
    return ''
  }
}

// Factory function that takes a config and returns a manager
export function createManager(_config: unknown): SSHSessionManager {
  return new SSHSessionManagerImpl('default')
}

export default SSHSessionManagerImpl
