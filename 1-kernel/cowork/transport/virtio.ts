/**
 * macOS VZVirtioSocket Transport Implementation
 * 
 * Implements VMTransport interface using Apple's Virtualization.framework
 * VZVirtioSocketListener and VZVirtioSocketConnection for host↔VM communication.
 * 
 * @module virtio
 */

import * as net from "net";
import { EventEmitter } from "events";
import {
  VMTransport,
  VMConnection,
  VMTransportOptions,
  VMTransportError,
  VMTransportErrorCode,
  MessageFramer,
  BaseVMConnection,
  generateConnectionId,
} from "./transport";

/**
 * VZVirtioSocket connection state
 */
enum VirtioConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  CLOSING = "closing",
  CLOSED = "closed",
  ERROR = "error",
}

/**
 * VirtioSocket address information
 */
interface VirtioSocketAddress {
  /** VM identifier */
  vmId: string;

  /** Port number */
  port: number;

  /** Socket file path (for Unix domain socket fallback) */
  socketPath?: string;
}

/**
 * Native VZVirtioSocket types (when available)
 * These are placeholders for the actual Objective-C class bindings
 */
interface VZVirtioSocketListenerNative {
  init(): VZVirtioSocketListenerNative;
  setPort(port: number): void;
  setDelegate(delegate: VZVirtioSocketListenerDelegate): void;
  start(): boolean;
  stop(): void;
}

interface VZVirtioSocketListenerDelegate {
  listenerDidReceiveConnection?(
    listener: VZVirtioSocketListenerNative,
    connection: VZVirtioSocketConnectionNative
  ): void;
}

interface VZVirtioSocketConnectionNative {
  readonly inputStream: NodeJS.ReadableStream;
  readonly outputStream: NodeJS.WritableStream;
  close(): void;
}

/**
 * Check if running on macOS with Virtualization.framework support
 */
function isMacOSWithVirtualization(): boolean {
  return process.platform === "darwin" && process.arch === "arm64";
}

/**
 * Get Virtualization.framework path
 */
function getVirtualizationFrameworkPath(): string {
  return "/System/Library/Frameworks/Virtualization.framework";
}

/**
 * Parse VM identifier string
 * Supports formats: "vm-xxx", "uuid", or port number as string
 */
function parseVmId(vmId: string): { id: string; port?: number } {
  // Check if it's a port number
  const portNum = parseInt(vmId, 10);
  if (!isNaN(portNum) && portNum > 0) {
    return { id: `vm-${vmId}`, port: portNum };
  }

  return { id: vmId };
}

/**
 * Generate Unix domain socket path for VM communication
 * Used as fallback when native VZVirtioSocket is not available
 */
function getSocketPath(vmId: string, port: number): string {
  const sanitizedVmId = vmId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `/var/run/vzvirtio-${sanitizedVmId}-${port}.sock`;
}

/**
 * Generate shared memory socket path for high-performance communication
 */
function getSharedMemoryPath(vmId: string): string {
  const sanitizedVmId = vmId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `/var/run/vzvirtio-${sanitizedVmId}.shm`;
}

/**
 * VirtioSocket connection implementation
 */
export class VirtioSocketConnection extends BaseVMConnection implements VMConnection {
  readonly id: string;
  readonly remoteId: string;
  readonly remotePort: number;
  readonly localPort: number;

  private state: VirtioConnectionState = VirtioConnectionState.CONNECTING;
  private options: VMTransportOptions;
  private socket: net.Socket | null = null;
  private nativeConnection: VZVirtioSocketConnectionNative | null = null;
  private readBuffer: Buffer = Buffer.alloc(0);
  private pendingReads: Array<{
    resolve: (data: Buffer | null) => void;
    reject: (error: Error) => void;
  }> = [];
  private writeQueue: Buffer[] = [];
  private isWriting = false;

  constructor(
    options: VMTransportOptions,
    remoteId: string,
    remotePort: number,
    localPort: number,
    socket?: net.Socket,
    nativeConn?: VZVirtioSocketConnectionNative
  ) {
    super();
    this.id = generateConnectionId();
    this.options = options;
    this.remoteId = remoteId;
    this.remotePort = remotePort;
    this.localPort = localPort;

    if (socket) {
      this.socket = socket;
      this.state = VirtioConnectionState.CONNECTED;
      this.setupSocketHandlers();
    } else if (nativeConn) {
      this.nativeConnection = nativeConn;
      this.state = VirtioConnectionState.CONNECTED;
      this.setupNativeHandlers();
    }
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on("data", (data: Buffer) => {
      this.handleIncomingData(data);
    });

    this.socket.on("close", (hadError: boolean) => {
      this.state = VirtioConnectionState.CLOSED;
      this.pendingReads.forEach((p) => p.resolve(null));
      this.pendingReads = [];
      this.emitClose();
    });

    this.socket.on("error", (err: Error) => {
      this.state = VirtioConnectionState.ERROR;
      const error = new VMTransportError(
        `VirtioSocket error: ${err.message}`,
        VMTransportErrorCode.INTERNAL_ERROR,
        err
      );
      this.emitError(error);
      this.pendingReads.forEach((p) => p.reject(error));
      this.pendingReads = [];
    });

    this.socket.on("end", () => {
      if (this.state !== VirtioConnectionState.CLOSED) {
        this.state = VirtioConnectionState.CLOSING;
      }
    });

    this.socket.on("timeout", () => {
      const error = new VMTransportError(
        "Socket timeout",
        VMTransportErrorCode.CONNECTION_TIMEOUT
      );
      this.emitError(error);
    });

    if (this.options.readTimeout) {
      this.socket.setTimeout(this.options.readTimeout);
    }

    if (this.options.keepalive) {
      this.socket.setKeepAlive(true, this.options.keepaliveInterval || 30000);
    }
  }

  private setupNativeHandlers(): void {
    // Native VZVirtioSocketConnection handling
    // This would integrate with Objective-C runtime when native bindings available
    if (!this.nativeConnection) return;

    // Set up stream handling
    const inputStream = this.nativeConnection.inputStream;
    const outputStream = this.nativeConnection.outputStream;

    if (inputStream) {
      inputStream.on("data", (data: Buffer) => {
        this.handleIncomingData(data);
      });

      inputStream.on("end", () => {
        this.close();
      });

      inputStream.on("error", (err: Error) => {
        this.emitError(
          new VMTransportError(
            `Input stream error: ${err.message}`,
            VMTransportErrorCode.INTERNAL_ERROR,
            err
          )
        );
      });
    }
  }

  private handleIncomingData(data: Buffer): void {
    if (this.options.framed) {
      this.readBuffer = Buffer.concat([this.readBuffer, data]);
      this.processFramedData();
    } else {
      this.emitData(data);
      if (this.pendingReads.length > 0) {
        const pending = this.pendingReads.shift()!;
        pending.resolve(data);
      }
    }
  }

  private processFramedData(): void {
    try {
      const { messages, remaining } = MessageFramer.unframe(this.readBuffer);
      this.readBuffer = remaining;

      for (const message of messages) {
        this.emitData(message);
        if (this.pendingReads.length > 0) {
          const pending = this.pendingReads.shift()!;
          pending.resolve(message);
        }
      }
    } catch (err) {
      const error =
        err instanceof VMTransportError
          ? err
          : new VMTransportError(
              `Framing error: ${err}`,
              VMTransportErrorCode.PROTOCOL_ERROR
            );
      this.emitError(error);
    }
  }

  get isConnected(): boolean {
    return this.state === VirtioConnectionState.CONNECTED;
  }

  async read(): Promise<Buffer | null> {
    if (this.state === VirtioConnectionState.CLOSED) {
      return null;
    }

    if (this.state === VirtioConnectionState.ERROR) {
      throw new VMTransportError(
        "Connection in error state",
        VMTransportErrorCode.INTERNAL_ERROR
      );
    }

    // Check buffered data first
    if (this.options.framed && this.readBuffer.length >= 4) {
      try {
        const { messages, remaining } = MessageFramer.unframe(this.readBuffer);
        if (messages.length > 0) {
          this.readBuffer = remaining;
          this.emitData(messages[0]);
          return messages[0];
        }
      } catch {
        // Continue to pending read
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = this.options.readTimeout;
      let timeoutId: NodeJS.Timeout | undefined;

      if (timeout) {
        timeoutId = setTimeout(() => {
          const idx = this.pendingReads.findIndex((p) => p.resolve === resolve);
          if (idx >= 0) {
            this.pendingReads.splice(idx, 1);
          }
          reject(
            new VMTransportError(
              "Read timeout",
              VMTransportErrorCode.CONNECTION_TIMEOUT
            )
          );
        }, timeout);
      }

      this.pendingReads.push({
        resolve: (data) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(data);
        },
        reject: (err) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(err);
        },
      });
    });
  }

  async write(data: Buffer): Promise<void> {
    if (this.state !== VirtioConnectionState.CONNECTED) {
      throw new VMTransportError(
        "Cannot write to non-connected socket",
        VMTransportErrorCode.NOT_CONNECTED
      );
    }

    const toWrite = this.options.framed ? MessageFramer.frame(data) : data;

    if (this.nativeConnection) {
      // Write to native stream
      return this.writeToNative(toWrite);
    } else if (this.socket) {
      return this.writeToSocket(toWrite);
    } else {
      throw new VMTransportError(
        "No valid transport channel",
        VMTransportErrorCode.NOT_CONNECTED
      );
    }
  }

  private async writeToSocket(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(
          new VMTransportError(
            "Socket destroyed",
            VMTransportErrorCode.NOT_CONNECTED
          )
        );
        return;
      }

      this.socket.write(data, (err) => {
        if (err) {
          reject(
            new VMTransportError(
              `Write failed: ${err.message}`,
              VMTransportErrorCode.INTERNAL_ERROR,
              err
            )
          );
        } else {
          resolve();
        }
      });
    });
  }

  private async writeToNative(data: Buffer): Promise<void> {
    // Implementation for native VZVirtioSocketConnection output stream
    return new Promise((resolve, reject) => {
      if (!this.nativeConnection) {
        reject(
          new VMTransportError(
            "Native connection not available",
            VMTransportErrorCode.NOT_CONNECTED
          )
        );
        return;
      }

      // Would write to outputStream when native bindings available
      // For now, queue the data
      this.writeQueue.push(data);
      this.processWriteQueue();
      resolve();
    });
  }

  private processWriteQueue(): void {
    if (this.isWriting || this.writeQueue.length === 0) return;

    this.isWriting = true;
    const data = this.writeQueue.shift()!;

    // Process native write
    // This would integrate with actual native stream
    setImmediate(() => {
      this.isWriting = false;
      this.processWriteQueue();
    });
  }

  async close(): Promise<void> {
    if (this.state === VirtioConnectionState.CLOSED) return;

    this.state = VirtioConnectionState.CLOSING;

    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.end(() => {
          this.socket?.destroy();
          this.state = VirtioConnectionState.CLOSED;
          this.emitClose();
          resolve();
        });
      } else if (this.nativeConnection) {
        this.nativeConnection.close();
        this.state = VirtioConnectionState.CLOSED;
        this.emitClose();
        resolve();
      } else {
        this.state = VirtioConnectionState.CLOSED;
        this.emitClose();
        resolve();
      }
    });
  }

  destroy(): void {
    this.state = VirtioConnectionState.CLOSED;

    if (this.socket) {
      this.socket.destroy();
    }

    if (this.nativeConnection) {
      this.nativeConnection.close();
    }

    this.pendingReads.forEach((p) => p.resolve(null));
    this.pendingReads = [];
    this.writeQueue = [];

    this.emitClose();
  }
}

/**
 * VZVirtioSocket transport implementation
 */
export class VirtioSocketTransport implements VMTransport {
  readonly type = "virtio" as const;
  isListening = false;

  private options: VMTransportOptions;
  private server: net.Server | null = null;
  private connections: Map<string, VirtioSocketConnection> = new Map();
  private nativeListener: VZVirtioSocketListenerNative | null = null;
  private listeningPort?: number;
  private useNative: boolean;

  constructor(options: VMTransportOptions = {}) {
    this.options = {
      bufferSize: 64 * 1024,
      connectTimeout: 30000,
      readTimeout: 30000,
      writeTimeout: 30000,
      keepalive: true,
      keepaliveInterval: 30000,
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      framed: true,
      ...options,
    };

    // Determine if we can use native Virtualization.framework
    this.useNative = this.detectNativeSupport();
  }

  private detectNativeSupport(): boolean {
    if (!isMacOSWithVirtualization()) {
      return false;
    }

    try {
      const fs = require("fs");
      fs.accessSync(getVirtualizationFrameworkPath());

      // Check if we have native bindings available
      // This would check for a native addon module
      return false; // Set to true when native addon is implemented
    } catch {
      return false;
    }
  }

  /**
   * Check if using native Virtualization.framework
   */
  isUsingNativeFramework(): boolean {
    return this.useNative;
  }

  async connect(vmId: string, port: number): Promise<VMConnection> {
    const { id: parsedId, port: parsedPort } = parseVmId(vmId);
    const targetPort = parsedPort || port;
    const targetId = parsedId;

    if (this.useNative) {
      return this.connectNative(targetId, targetPort);
    } else {
      return this.connectSocket(targetId, targetPort);
    }
  }

  private async connectNative(vmId: string, port: number): Promise<VMConnection> {
    // Native VZVirtioSocketConnection implementation
    // This would use Objective-C runtime to create connection
    throw new VMTransportError(
      "Native Virtualization.framework support not yet implemented",
      VMTransportErrorCode.PLATFORM_UNSUPPORTED
    );
  }

  private async connectSocket(vmId: string, port: number): Promise<VMConnection> {
    const socketPath = getSocketPath(vmId, port);

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = this.options.connectTimeout || 30000;

      const timeoutId = setTimeout(() => {
        socket.destroy();
        reject(
          new VMTransportError(
            `Connection timeout to ${vmId}:${port}`,
            VMTransportErrorCode.CONNECTION_TIMEOUT
          )
        );
      }, timeout);

      socket.once("connect", () => {
        clearTimeout(timeoutId);

        const conn = new VirtioSocketConnection(
          this.options,
          vmId,
          port,
          0, // Local port will be determined
          socket
        );

        this.connections.set(conn.id, conn);

        conn.onClose(() => {
          this.connections.delete(conn.id);
        });

        resolve(conn);
      });

      socket.once("error", (err) => {
        clearTimeout(timeoutId);

        const code = err.message.includes("ECONNREFUSED")
          ? VMTransportErrorCode.CONNECTION_REFUSED
          : err.message.includes("ENOENT")
          ? VMTransportErrorCode.INVALID_ADDRESS
          : VMTransportErrorCode.INTERNAL_ERROR;

        reject(
          new VMTransportError(
            `Failed to connect to ${vmId}:${port}: ${err.message}`,
            code,
            err
          )
        );
      });

      // Connect via Unix domain socket (fallback)
      socket.connect(socketPath);
    });
  }

  async listen(port: number, handler: (conn: VMConnection) => void): Promise<void> {
    if (this.isListening) {
      throw new VMTransportError(
        "Transport already listening",
        VMTransportErrorCode.ALREADY_CONNECTED
      );
    }

    this.listeningPort = port;

    if (this.useNative) {
      return this.listenNative(port, handler);
    } else {
      return this.listenSocket(port, handler);
    }
  }

  private async listenNative(
    port: number,
    handler: (conn: VMConnection) => void
  ): Promise<void> {
    // Native VZVirtioSocketListener implementation
    throw new VMTransportError(
      "Native Virtualization.framework support not yet implemented",
      VMTransportErrorCode.PLATFORM_UNSUPPORTED
    );
  }

  private async listenSocket(
    port: number,
    handler: (conn: VMConnection) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const socketPath = getSocketPath("host", port);

      // Clean up stale socket
      try {
        const fs = require("fs");
        fs.unlinkSync(socketPath);
      } catch {
        // Ignore cleanup errors
      }

      const server = net.createServer((socket) => {
        // Get VM info from socket credentials (if available)
        const vmId = `vm-${port}-${Date.now()}`;

        const conn = new VirtioSocketConnection(
          this.options,
          vmId,
          port,
          port,
          socket
        );

        this.connections.set(conn.id, conn);

        conn.onClose(() => {
          this.connections.delete(conn.id);
        });

        handler(conn);
      });

      server.on("error", (err) => {
        if ((err as any).code === "EADDRINUSE") {
          reject(
            new VMTransportError(
              `Port ${port} already in use`,
              VMTransportErrorCode.ADDRESS_IN_USE,
              err
            )
          );
        } else {
          reject(
            new VMTransportError(
              `Failed to listen: ${err.message}`,
              VMTransportErrorCode.INTERNAL_ERROR,
              err
            )
          );
        }
      });

      server.listen(socketPath, () => {
        // Set socket permissions
        try {
          const fs = require("fs");
          fs.chmodSync(socketPath, 0o666);
        } catch {
          // Ignore permission errors
        }

        this.server = server;
        this.isListening = true;
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    // Close all connections
    const closePromises = Array.from(this.connections.values()).map((conn) =>
      conn.close().catch(() => {})
    );
    await Promise.all(closePromises);
    this.connections.clear();

    // Stop native listener
    if (this.nativeListener) {
      this.nativeListener.stop();
      this.nativeListener = null;
    }

    // Stop socket server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          // Clean up socket file
          if (this.listeningPort !== undefined) {
            try {
              const fs = require("fs");
              fs.unlinkSync(getSocketPath("host", this.listeningPort));
            } catch {
              // Ignore cleanup errors
            }
          }

          this.server = null;
          this.isListening = false;
          this.listeningPort = undefined;
          resolve();
        });
      });
    }
  }

  getConnections(): VMConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection by VM ID
   */
  getConnectionByVmId(vmId: string): VirtioSocketConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.remoteId === vmId) {
        return conn;
      }
    }
    return undefined;
  }
}

/**
 * Check if VirtioSocket is supported on this system
 */
export function isVirtioSocketSupported(): boolean {
  if (process.platform !== "darwin") {
    return false;
  }

  // Check for Apple Silicon
  if (process.arch !== "arm64") {
    return false;
  }

  // Check for Virtualization.framework
  try {
    const fs = require("fs");
    fs.accessSync(getVirtualizationFrameworkPath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Get VirtioSocket device information
 */
export function getVirtioSocketInfo(): {
  supported: boolean;
  nativeFramework: boolean;
  platform: string;
  arch: string;
} {
  return {
    supported: isVirtioSocketSupported(),
    nativeFramework: isMacOSWithVirtualization(),
    platform: process.platform,
    arch: process.arch,
  };
}

export default VirtioSocketTransport;
