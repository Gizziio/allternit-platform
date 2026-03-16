/**
 * VM Transport Layer - Core Interfaces
 * 
 * Defines the unified transport interface for host↔VM communication
 * supporting both Linux VSOCK and macOS VZVirtioSocket.
 * 
 * @module transport
 */

import { EventEmitter } from "events";

/**
 * Supported platforms for VM transport
 */
export type Platform = "darwin" | "linux" | "win32";

/**
 * VM connection interface for reading/writing data
 * Abstracts the underlying socket implementation
 */
export interface VMConnection {
  /** Unique connection identifier */
  readonly id: string;

  /** Remote VM identifier (CID for VSOCK, VM ID for VirtioSocket) */
  readonly remoteId: string;

  /** Remote port number */
  readonly remotePort: number;

  /** Local port number */
  readonly localPort: number;

  /** Connection state */
  readonly isConnected: boolean;

  /** Connection creation timestamp */
  readonly createdAt: Date;

  /**
   * Read data from the connection
   * @returns Promise resolving to Buffer, or null if connection closed
   * @throws {VMTransportError} On read errors
   */
  read(): Promise<Buffer | null>;

  /**
   * Write data to the connection
   * @param data - Buffer to write
   * @throws {VMTransportError} On write errors or if not connected
   */
  write(data: Buffer): Promise<void>;

  /**
   * Close the connection gracefully
   */
  close(): Promise<void>;

  /**
   * Force close the connection without waiting
   */
  destroy(): void;

  /**
   * Register callback for connection close event
   * @param callback - Function to call when connection closes
   */
  onClose(callback: () => void): void;

  /**
   * Register callback for connection error event
   * @param callback - Function to call on errors
   */
  onError(callback: (error: VMTransportError) => void): void;

  /**
   * Register callback for data available event
   * @param callback - Function to call when data is available
   */
  onData(callback: (data: Buffer) => void): void;

  /**
   * Remove a registered callback
   * @param event - Event name
   * @param callback - Callback to remove
   */
  off(event: "close" | "error" | "data", callback: (...args: any[]) => void): void;
}

/**
 * Transport interface for VM communication
 * Implemented by platform-specific providers
 */
export interface VMTransport {
  /** Transport type identifier */
  readonly type: "vsock" | "virtio";

  /** Current transport state */
  readonly isListening: boolean;

  /**
   * Connect to a VM on the specified port
   * @param vmId - VM identifier (CID string for Linux, VM ID for macOS)
   * @param port - Port number to connect to
   * @returns Promise resolving to VMConnection
   * @throws {VMTransportError} On connection failure
   */
  connect(vmId: string, port: number): Promise<VMConnection>;

  /**
   * Listen for incoming VM connections
   * @param port - Port number to listen on
   * @param handler - Callback for new connections
   * @throws {VMTransportError} On bind failure
   */
  listen(port: number, handler: (conn: VMConnection) => void): Promise<void>;

  /**
   * Stop listening and close all connections
   */
  close(): Promise<void>;

  /**
   * Get list of active connections
   */
  getConnections(): VMConnection[];
}

/**
 * Transport configuration options
 */
export interface VMTransportOptions {
  /** Platform to use (auto-detected if not specified) */
  platform?: Platform;

  /** Default read buffer size in bytes */
  bufferSize?: number;

  /** Connection timeout in milliseconds */
  connectTimeout?: number;

  /** Read timeout in milliseconds */
  readTimeout?: number;

  /** Write timeout in milliseconds */
  writeTimeout?: number;

  /** Enable keepalive probes */
  keepalive?: boolean;

  /** Keepalive interval in milliseconds */
  keepaliveInterval?: number;

  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;

  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;

  /** Enable message framing (4-byte length prefix) */
  framed?: boolean;
}

/**
 * VSOCK-specific address structure
 * Matches Linux kernel sockaddr_vm
 */
export interface VSockAddress {
  /** Address family (always AF_VSOCK = 40) */
  family: number;

  /** Reserved field */
  reserved: number;

  /** Port number */
  port: number;

  /** Context ID (CID) */
  cid: number;
}

/**
 * Special CID values for VSOCK
 */
export const VSOCK_CID = {
  /** Any available CID */
  ANY: 0xffffffff,

  /** Host CID */
  HOST: 2,

  /** Hypervisor CID */
  HYPERVISOR: 0,
} as const;

/**
 * VSOCK socket type
 */
export const VSOCK_TYPE = {
  /** Stream socket (TCP-like) */
  STREAM: 1,

  /** Datagram socket (UDP-like) */
  DGRAM: 2,
} as const;

/**
 * Error codes for VM transport operations
 */
export enum VMTransportErrorCode {
  CONNECTION_REFUSED = "ECONNREFUSED",
  CONNECTION_TIMEOUT = "ETIMEDOUT",
  CONNECTION_CLOSED = "ECONNRESET",
  BUFFER_OVERFLOW = "EOVERFLOW",
  INVALID_ADDRESS = "EADDRNOTAVAIL",
  ADDRESS_IN_USE = "EADDRINUSE",
  PROTOCOL_ERROR = "EPROTO",
  NOT_CONNECTED = "ENOTCONN",
  ALREADY_CONNECTED = "EISCONN",
  PLATFORM_UNSUPPORTED = "EPLATFORM",
  INTERNAL_ERROR = "EINTERNAL",
}

/**
 * VM Transport error class
 */
export class VMTransportError extends Error {
  constructor(
    message: string,
    public readonly code: VMTransportErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "VMTransportError";
    Object.setPrototypeOf(this, VMTransportError.prototype);
  }

  /**
   * Check if error is retryable
   */
  get isRetryable(): boolean {
    return [
      VMTransportErrorCode.CONNECTION_TIMEOUT,
      VMTransportErrorCode.CONNECTION_CLOSED,
      VMTransportErrorCode.NOT_CONNECTED,
    ].includes(this.code);
  }
}

/**
 * Message framing utilities
 * Implements length-prefixed message protocol
 */
export class MessageFramer {
  private static readonly HEADER_SIZE = 4;
  private static readonly MAX_MESSAGE_SIZE = 64 * 1024 * 1024; // 64MB

  /**
   * Frame a message with 4-byte length prefix (little-endian)
   * @param data - Raw message data
   * @returns Framed message buffer
   */
  static frame(data: Buffer): Buffer {
    if (data.length > this.MAX_MESSAGE_SIZE) {
      throw new VMTransportError(
        `Message too large: ${data.length} bytes (max ${this.MAX_MESSAGE_SIZE})`,
        VMTransportErrorCode.BUFFER_OVERFLOW
      );
    }

    const framed = Buffer.allocUnsafe(this.HEADER_SIZE + data.length);
    framed.writeUInt32LE(data.length, 0);
    data.copy(framed, this.HEADER_SIZE);
    return framed;
  }

  /**
   * Parse framed messages from buffer
   * @param buffer - Accumulated data buffer
   * @returns Array of complete messages and remaining buffer
   */
  static unframe(buffer: Buffer): { messages: Buffer[]; remaining: Buffer } {
    const messages: Buffer[] = [];
    let offset = 0;

    while (offset + this.HEADER_SIZE <= buffer.length) {
      const length = buffer.readUInt32LE(offset);

      if (length > this.MAX_MESSAGE_SIZE) {
        throw new VMTransportError(
          `Invalid message length: ${length}`,
          VMTransportErrorCode.PROTOCOL_ERROR
        );
      }

      if (offset + this.HEADER_SIZE + length > buffer.length) {
        // Incomplete message
        break;
      }

      const message = Buffer.alloc(length);
      buffer.copy(message, 0, offset + this.HEADER_SIZE, offset + this.HEADER_SIZE + length);
      messages.push(message);

      offset += this.HEADER_SIZE + length;
    }

    const remaining = offset < buffer.length ? buffer.subarray(offset) : Buffer.alloc(0);
    return { messages, remaining };
  }
}

/**
 * Base connection class with common functionality
 */
export abstract class BaseVMConnection extends EventEmitter implements VMConnection {
  abstract readonly id: string;
  abstract readonly remoteId: string;
  abstract readonly remotePort: number;
  abstract readonly localPort: number;
  abstract readonly isConnected: boolean;
  readonly createdAt: Date = new Date();

  protected _closed = false;
  protected _errorHandlers: Array<(error: VMTransportError) => void> = [];
  protected _closeHandlers: Array<() => void> = [];
  protected _dataHandlers: Array<(data: Buffer) => void> = [];

  abstract read(): Promise<Buffer | null>;
  abstract write(data: Buffer): Promise<void>;
  abstract close(): Promise<void>;
  abstract destroy(): void;

  onClose(callback: () => void): void {
    this._closeHandlers.push(callback);
  }

  onError(callback: (error: VMTransportError) => void): void {
    this._errorHandlers.push(callback);
  }

  onData(callback: (data: Buffer) => void): void {
    this._dataHandlers.push(callback);
  }

  off(event: "close" | "error" | "data", callback: (...args: any[]) => void): void {
    switch (event) {
      case "close":
        this._closeHandlers = this._closeHandlers.filter((h) => h !== callback);
        break;
      case "error":
        this._errorHandlers = this._errorHandlers.filter((h) => h !== callback);
        break;
      case "data":
        this._dataHandlers = this._dataHandlers.filter((h) => h !== callback);
        break;
    }
  }

  protected emitClose(): void {
    this._closed = true;
    this._closeHandlers.forEach((h) => {
      try {
        h();
      } catch (err) {
        // Ignore handler errors
      }
    });
    this.emit("close");
  }

  protected emitError(error: VMTransportError): void {
    this._errorHandlers.forEach((h) => {
      try {
        h(error);
      } catch (err) {
        // Ignore handler errors
      }
    });
    this.emit("error", error);
  }

  protected emitData(data: Buffer): void {
    this._dataHandlers.forEach((h) => {
      try {
        h(data);
      } catch (err) {
        // Ignore handler errors
      }
    });
    this.emit("data", data);
  }
}

/**
 * Generate unique connection ID
 */
export function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
