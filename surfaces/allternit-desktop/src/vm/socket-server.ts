/**
 * Unix Socket Server for CLI Communication
 * 
 * Bridges between CLI (Unix socket) and a2r-vm-executor (VSOCK).
 * Translates protocols and handles multiple concurrent CLI connections.
 * 
 * Protocol Flow:
 * ```
 * CLI Process                    Socket Server                  a2r-vm-executor
 *    │                                │                               │
 *    ├── Connect to Unix socket ─────►│                               │
 *    │                                │                               │
 *    ├── Send ProtocolMessage ───────►│                               │
 *    │                                │── Forward via VSOCK ─────────►│
 *    │                                │                               │
 *    │◄───────────────────────────────│◄── Return result ─────────────│
 *    │                                │                               │
 * ```
 */

import * as net from 'net';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

// Protocol message types (matching a2r-guest-agent-protocol)
interface ProtocolMessage {
  type: string;
  id: string;
  payload?: unknown;
}

interface SocketClient {
  id: string;
  socket: net.Socket;
  authenticated: boolean;
  pendingRequests: Map<string, {
    resolve: (value: ProtocolMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>;
}

interface SocketServerConfig {
  socketPath: string;
  vsockCid: number;
  vsockPort: number;
  maxClients: number;
  requestTimeoutMs: number;
}

/**
 * Unix Socket Server
 * 
 * Listens for CLI connections and forwards commands to the VM executor.
 */
export class SocketServer extends EventEmitter {
  private config: SocketServerConfig;
  private server?: net.Server;
  private clients: Map<string, SocketClient> = new Map();
  private vsockConnection?: net.Socket;
  private isRunning = false;

  constructor(config: Partial<SocketServerConfig> = {}) {
    super();
    
    this.config = {
      socketPath: '/var/run/a2r/desktop-vm.sock',
      vsockCid: 3,
      vsockPort: 8080,
      maxClients: 50,
      requestTimeoutMs: 30000,
      ...config,
    };
  }

  /**
   * Start the socket server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.emit('log', 'Socket server already running');
      return;
    }

    this.emit('log', `Starting socket server on ${this.config.socketPath}`);

    // Ensure socket directory exists
    await this.ensureSocketDirectory();

    // Remove old socket file
    await this.cleanupSocketFile();

    // Create server
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.config.socketPath, () => {
        this.isRunning = true;
        this.emit('started', this.config.socketPath);
        this.emit('log', `Socket server listening on ${this.config.socketPath}`);
        resolve();
      });

      this.server!.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
    });

    // Set proper permissions on socket file
    await this.setSocketPermissions();
  }

  /**
   * Stop the socket server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.emit('log', 'Stopping socket server...');

    // Close all client connections
    for (const client of this.clients.values()) {
      this.closeClient(client, 'Server shutting down');
    }
    this.clients.clear();

    // Close VSOCK connection
    this.vsockConnection?.end();
    this.vsockConnection = undefined;

    // Close server
    await new Promise<void>((resolve) => {
      this.server?.close(() => {
        resolve();
      });
    });

    // Clean up socket file
    await this.cleanupSocketFile();

    this.isRunning = false;
    this.emit('stopped');
    this.emit('log', 'Socket server stopped');
  }

  /**
   * Check if server is running
   */
  isListening(): boolean {
    return this.isRunning;
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get list of connected client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Disconnect a specific client
   */
  disconnectClient(clientId: string, reason?: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    this.closeClient(client, reason || 'Disconnected by server');
    this.clients.delete(clientId);
    return true;
  }

  // === Private Methods ===

  private async ensureSocketDirectory(): Promise<void> {
    const dir = this.config.socketPath.substring(0, this.config.socketPath.lastIndexOf('/'));
    
    try {
      await fs.mkdir(dir, { recursive: true, mode: 0o755 });
    } catch (error) {
      // If we can't create in /var/run, fall back to home directory
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        const homeDir = process.env.HOME || '/tmp';
        const fallbackPath = `${homeDir}/.a2r/desktop-vm.sock`;
        
        this.emit('log', `Falling back to ${fallbackPath}`);
        this.config.socketPath = fallbackPath;
        
        await fs.mkdir(`${homeDir}/.a2r`, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  private async cleanupSocketFile(): Promise<void> {
    try {
      await fs.unlink(this.config.socketPath);
    } catch {
      // Ignore if doesn't exist
    }
  }

  private async setSocketPermissions(): Promise<void> {
    try {
      await fs.chmod(this.config.socketPath, 0o666);
    } catch (error) {
      this.emit('log', `Warning: Could not set socket permissions: ${error}`);
    }
  }

  private handleConnection(socket: net.Socket): void {
    // Check max clients
    if (this.clients.size >= this.config.maxClients) {
      this.emit('log', 'Max clients reached, rejecting connection');
      socket.end(JSON.stringify({
        type: 'error',
        error: 'Server at capacity',
        code: 'SERVER_FULL',
      }) + '\n');
      return;
    }

    const clientId = `cli-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.emit('log', `CLI client connected: ${clientId}`);

    const client: SocketClient = {
      id: clientId,
      socket,
      authenticated: false,
      pendingRequests: new Map(),
    };

    this.clients.set(clientId, client);
    this.emit('clientConnected', clientId);

    // Set up socket handlers
    socket.on('data', (data) => {
      this.handleClientData(client, data);
    });

    socket.on('close', () => {
      this.handleClientDisconnect(client);
    });

    socket.on('error', (error) => {
      this.emit('error', { clientId, error });
    });

    // Send handshake
    this.sendToClient(client, {
      type: 'handshake',
      id: '0',
      payload: {
        version: '1.1.0',
        protocol: 'a2r-guest-agent-protocol',
      },
    });
  }

  private handleClientData(client: SocketClient, data: Buffer): void {
    try {
      // Parse messages (handle multiple messages in one buffer)
      const messages = this.parseMessages(data.toString());
      
      for (const message of messages) {
        this.handleMessage(client, message);
      }
    } catch (error) {
      this.sendToClient(client, {
        type: 'error',
        id: '0',
        payload: {
          error: 'Invalid message format',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private parseMessages(data: string): ProtocolMessage[] {
    const messages: ProtocolMessage[] = [];
    const lines = data.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      try {
        const msg = JSON.parse(trimmed);
        messages.push(msg);
      } catch {
        // Skip invalid lines
      }
    }
    
    return messages;
  }

  private async handleMessage(client: SocketClient, message: ProtocolMessage): Promise<void> {
    this.emit('message', { clientId: client.id, message });

    switch (message.type) {
      case 'handshake':
        // Client confirming handshake
        client.authenticated = true;
        this.sendToClient(client, {
          type: 'ready',
          id: message.id,
        });
        break;

      case 'command':
        // Execute command in VM
        if (!client.authenticated) {
          this.sendError(client, message.id, 'Not authenticated');
          return;
        }
        await this.handleCommand(client, message);
        break;

      case 'ping':
        // Health check
        this.sendToClient(client, {
          type: 'pong',
          id: message.id,
          payload: { timestamp: Date.now() },
        });
        break;

      case 'createSession':
        // Create new session in VM
        if (!client.authenticated) {
          this.sendError(client, message.id, 'Not authenticated');
          return;
        }
        await this.handleCreateSession(client, message);
        break;

      case 'destroySession':
        // Destroy session
        if (!client.authenticated) {
          this.sendError(client, message.id, 'Not authenticated');
          return;
        }
        await this.handleDestroySession(client, message);
        break;

      default:
        this.sendError(client, message.id, `Unknown message type: ${message.type}`);
    }
  }

  private async handleCommand(client: SocketClient, message: ProtocolMessage): Promise<void> {
    try {
      // Forward to VM executor via VSOCK
      const result = await this.forwardToVm(message);
      
      this.sendToClient(client, {
        type: 'commandResult',
        id: message.id,
        payload: result,
      });
    } catch (error) {
      this.sendError(client, message.id, 
        error instanceof Error ? error.message : 'Command failed');
    }
  }

  private async handleCreateSession(client: SocketClient, message: ProtocolMessage): Promise<void> {
    try {
      const result = await this.forwardToVm(message);
      
      this.sendToClient(client, {
        type: 'sessionCreated',
        id: message.id,
        payload: result,
      });
    } catch (error) {
      this.sendError(client, message.id, 
        error instanceof Error ? error.message : 'Failed to create session');
    }
  }

  private async handleDestroySession(client: SocketClient, message: ProtocolMessage): Promise<void> {
    try {
      await this.forwardToVm(message);
      
      this.sendToClient(client, {
        type: 'sessionDestroyed',
        id: message.id,
      });
    } catch (error) {
      this.sendError(client, message.id, 
        error instanceof Error ? error.message : 'Failed to destroy session');
    }
  }

  private async forwardToVm(message: ProtocolMessage): Promise<unknown> {
    // TODO: Implement actual VSOCK forwarding
    // This would connect to the VSOCK socket and forward the message
    
    // For now, return a placeholder
    return {
      stdout: '',
      stderr: '',
      exitCode: 0,
    };
  }

  private sendToClient(client: SocketClient, message: ProtocolMessage): void {
    try {
      client.socket.write(JSON.stringify(message) + '\n');
    } catch (error) {
      this.emit('error', { clientId: client.id, error });
    }
  }

  private sendError(client: SocketClient, id: string, error: string): void {
    this.sendToClient(client, {
      type: 'error',
      id,
      payload: { error },
    });
  }

  private handleClientDisconnect(client: SocketClient): void {
    this.emit('log', `CLI client disconnected: ${client.id}`);

    // Reject all pending requests
    for (const [requestId, pending] of client.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    client.pendingRequests.clear();

    this.clients.delete(client.id);
    this.emit('clientDisconnected', client.id);
  }

  private closeClient(client: SocketClient, reason: string): void {
    // Send disconnect message
    try {
      client.socket.write(JSON.stringify({
        type: 'disconnect',
        payload: { reason },
      }) + '\n');
    } catch {
      // Ignore write errors during close
    }

    // End socket
    client.socket.end();

    // Reject pending requests
    for (const [requestId, pending] of client.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    client.pendingRequests.clear();
  }
}

// Export types
export type { ProtocolMessage, SocketClient, SocketServerConfig };
