/**
 * Transport interface
 * TEMPORARY SHIM
 */

export interface TransportOptions {
  url: string
  timeout?: number
  reconnect?: boolean
}

export interface TransportMessage {
  type: string
  payload: unknown
  id?: string
}

export interface Transport {
  options: TransportOptions
  connected: boolean
  
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(message: TransportMessage): Promise<void>
  isConnected(): boolean
  
  // Additional methods expected by codebase
  setOnData(callback: (data: unknown) => void): void
  setOnClose(callback: () => void): void
  write(data: unknown): Promise<void>
  close(): Promise<void> | void
}

// Keep the abstract class for implementations that want to extend it
export abstract class TransportBase implements Transport {
  options: TransportOptions
  connected: boolean

  constructor(options: TransportOptions) {
    this.options = options
    this.connected = false
  }

  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract send(message: TransportMessage): Promise<void>

  isConnected(): boolean {
    return this.connected
  }

  // Additional methods expected by codebase
  abstract setOnData(callback: (data: unknown) => void): void
  abstract setOnClose(callback: () => void): void
  abstract write(data: unknown): Promise<void>
  abstract close(): Promise<void> | void
}

export default Transport
