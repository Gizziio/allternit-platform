/**
 * VPSChannel.ts
 * 
 * WebSocket channel handler for VPS connection events.
 * Streams connection status, command output, and server statistics.
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { EventServer } from '../EventServer';
import type { 
  ConnectionStatus, 
  VPSConnectionEvent, 
  VPSCommandEvent,
  VPSStatsEvent,
} from '../EventTypes';

// Extend EventEmitter for event handling
export interface VPSChannel extends EventEmitter {}

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface VPSConnectionInfo {
  vpsId: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key';
  status: ConnectionStatus;
  connectedAt?: string;
  disconnectedAt?: string;
  lastError?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface VPSCommandSession {
  commandId: string;
  vpsId: string;
  command: string;
  pid?: number;
  startedAt: string;
  status: 'running' | 'completed' | 'error';
  exitCode?: number;
}

export interface VPSServerStats {
  cpuUsage: number;        // Percentage (0-100)
  memoryUsage: number;     // Percentage (0-100)
  memoryUsed: number;      // In MB
  memoryTotal: number;     // In MB
  diskUsage: number;       // Percentage (0-100)
  diskUsed: number;        // In GB
  diskTotal: number;       // In GB
  uptime: number;          // In seconds
  loadAverage: number[];   // 1, 5, 15 minute averages
  networkRx: number;       // Bytes received
  networkTx: number;       // Bytes transmitted
  processes?: number;      // Number of running processes
}

// ============================================================================
// VPS Channel Class
// ============================================================================

export class VPSChannel extends EventEmitter {
  private readonly eventServer: EventServer;
  private readonly channelPrefix = 'vps:';
  private connections = new Map<string, VPSConnectionInfo>();
  private commandSessions = new Map<string, VPSCommandSession>();
  private activeStreams = new Map<string, Set<WebSocket>>();
  private outputBuffers = new Map<string, string[]>(); // Buffer output per command

  constructor(eventServer: EventServer) {
    super();
    this.eventServer = eventServer;
  }

  // ============================================================================
  // Public API - Connection Management
  // ============================================================================

  /**
   * Register a VPS connection
   */
  async registerConnection(info: Omit<VPSConnectionInfo, 'status' | 'retryCount'>): Promise<void> {
    const connection: VPSConnectionInfo = {
      ...info,
      status: 'disconnected',
      retryCount: 0,
    };

    this.connections.set(info.vpsId, connection);

    // Emit initial status
    await this.emitConnectionStatus(info.vpsId, 'disconnected');
  }

  /**
   * Emit connection status update
   */
  async emitConnectionStatus(vpsId: string, status: ConnectionStatus, message?: string): Promise<void> {
    const connection = this.connections.get(vpsId);
    if (!connection) {
      throw new Error(`VPS ${vpsId} not registered`);
    }

    // Update connection state
    const previousStatus = connection.status;
    connection.status = status;

    if (status === 'connected') {
      connection.connectedAt = new Date().toISOString();
      connection.retryCount = 0;
      connection.lastError = undefined;
    } else if (status === 'disconnected' || status === 'error') {
      connection.disconnectedAt = new Date().toISOString();
    } else if (status === 'reconnecting') {
      connection.retryCount++;
    }

    // Create event
    const event: VPSConnectionEvent = {
      type: 'vps',
      vpsId,
      eventType: 'connection',
      connectionStatus: status,
      message: message || this.getStatusMessage(status, connection),
      timestamp: new Date().toISOString(),
    };

    await this.publish(vpsId, event);

    // If disconnected unexpectedly, attempt reconnection logic
    if (previousStatus === 'connected' && (status === 'disconnected' || status === 'error')) {
      this.emit('connectionLost', { vpsId, connection });
    }
  }

  /**
   * Emit connection error
   */
  async emitConnectionError(vpsId: string, error: string, willRetry = false): Promise<void> {
    const connection = this.connections.get(vpsId);
    if (connection) {
      connection.lastError = error;
    }

    const message = willRetry 
      ? `Connection error: ${error}. Retrying...` 
      : `Connection error: ${error}`;

    await this.emitConnectionStatus(vpsId, 'error', message);
  }

  // ============================================================================
  // Public API - Command Output
  // ============================================================================

  /**
   * Start a new command session
   */
  async startCommandSession(vpsId: string, command: string): Promise<string> {
    const connection = this.connections.get(vpsId);
    if (!connection) {
      throw new Error(`VPS ${vpsId} not registered`);
    }

    if (connection.status !== 'connected') {
      throw new Error(`VPS ${vpsId} is not connected`);
    }

    const commandId = this.generateCommandId();
    const session: VPSCommandSession = {
      commandId,
      vpsId,
      command,
      startedAt: new Date().toISOString(),
      status: 'running',
    };

    this.commandSessions.set(commandId, session);
    this.outputBuffers.set(commandId, []);

    // Notify that command started
    const event: VPSCommandEvent = {
      type: 'vps',
      vpsId,
      eventType: 'command',
      commandId,
      output: '',
      isComplete: false,
      timestamp: new Date().toISOString(),
    };

    await this.publish(vpsId, event);

    return commandId;
  }

  /**
   * Emit command output (streaming)
   */
  async emitCommandOutput(vpsId: string, output: string, commandId?: string): Promise<void> {
    // If no commandId provided, use the most recent running session for this VPS
    if (!commandId) {
      commandId = this.findActiveCommandId(vpsId);
    }

    if (!commandId) {
      // No active session, just emit as general output
      const event: VPSCommandEvent = {
        type: 'vps',
        vpsId,
        eventType: 'command',
        commandId: 'unknown',
        output,
        isComplete: false,
        timestamp: new Date().toISOString(),
      };
      await this.publish(vpsId, event);
      return;
    }

    const session = this.commandSessions.get(commandId);
    if (!session || session.status !== 'running') {
      return;
    }

    // Buffer the output
    const buffer = this.outputBuffers.get(commandId);
    if (buffer) {
      buffer.push(output);
      
      // Keep buffer size manageable
      if (buffer.length > 1000) {
        buffer.splice(0, buffer.length - 500);
      }
    }

    // Emit the output
    const event: VPSCommandEvent = {
      type: 'vps',
      vpsId,
      eventType: 'command',
      commandId,
      output,
      isComplete: false,
      timestamp: new Date().toISOString(),
    };

    await this.publish(vpsId, event);
  }

  /**
   * Emit command error output
   */
  async emitCommandError(vpsId: string, error: string, commandId?: string): Promise<void> {
    if (!commandId) {
      commandId = this.findActiveCommandId(vpsId);
    }

    const event: VPSCommandEvent = {
      type: 'vps',
      vpsId,
      eventType: 'command',
      commandId: commandId || 'unknown',
      output: error,
      isError: true,
      isComplete: false,
      timestamp: new Date().toISOString(),
    };

    await this.publish(vpsId, event);
  }

  /**
   * Mark command as completed
   */
  async completeCommand(vpsId: string, commandId: string, exitCode = 0): Promise<void> {
    const session = this.commandSessions.get(commandId);
    if (!session) {
      return;
    }

    session.status = exitCode === 0 ? 'completed' : 'error';
    session.exitCode = exitCode;

    const event: VPSCommandEvent = {
      type: 'vps',
      vpsId,
      eventType: 'command',
      commandId,
      output: '',
      isComplete: true,
      exitCode,
      timestamp: new Date().toISOString(),
    };

    await this.publish(vpsId, event);

    // Clean up after a delay
    setTimeout(() => {
      this.commandSessions.delete(commandId);
      this.outputBuffers.delete(commandId);
    }, 60000); // Keep for 1 minute
  }

  /**
   * Stream command output to a WebSocket
   */
  async streamCommandOutput(vpsId: string, commandId: string, socket: WebSocket): Promise<void> {
    const session = this.commandSessions.get(commandId);
    if (!session) {
      throw new Error(`Command session ${commandId} not found`);
    }

    // Track this socket
    const streamKey = `cmd:${commandId}`;
    if (!this.activeStreams.has(streamKey)) {
      this.activeStreams.set(streamKey, new Set());
    }
    this.activeStreams.get(streamKey)!.add(socket);

    // Send buffered output first
    const buffer = this.outputBuffers.get(commandId);
    if (buffer && buffer.length > 0) {
      const event: VPSCommandEvent = {
        type: 'vps',
        vpsId,
        eventType: 'command',
        commandId,
        output: buffer.join(''),
        isComplete: session.status !== 'running',
        exitCode: session.exitCode,
        timestamp: new Date().toISOString(),
      };
      this.sendToSocket(socket, event);
    }

    // Clean up on socket close
    socket.on('close', () => {
      this.removeStream(streamKey, socket);
    });

    socket.on('error', () => {
      this.removeStream(streamKey, socket);
    });
  }

  // ============================================================================
  // Public API - Statistics
  // ============================================================================

  /**
   * Emit server statistics update
   */
  async emitStats(vpsId: string, stats: VPSServerStats): Promise<void> {
    const event: VPSStatsEvent = {
      type: 'vps',
      vpsId,
      eventType: 'stats',
      stats: {
        cpuUsage: stats.cpuUsage,
        memoryUsage: stats.memoryUsage,
        diskUsage: stats.diskUsage,
        uptime: stats.uptime,
        loadAverage: stats.loadAverage,
      },
      timestamp: new Date().toISOString(),
    };

    await this.publish(vpsId, event);
  }

  /**
   * Start streaming stats for a VPS
   */
  async streamStats(vpsId: string, socket: WebSocket, _interval = 5000): Promise<() => void> {
    // Track this socket
    const streamKey = `stats:${vpsId}`;
    if (!this.activeStreams.has(streamKey)) {
      this.activeStreams.set(streamKey, new Set());
    }
    this.activeStreams.get(streamKey)!.add(socket);

    // Clean up on socket close
    const cleanup = (): void => {
      this.removeStream(streamKey, socket);
    };

    socket.on('close', cleanup);
    socket.on('error', cleanup);

    // Return cleanup function
    return cleanup;
  }

  // ============================================================================
  // Public API - Connection Streaming
  // ============================================================================

  /**
   * Stream VPS connection events to a WebSocket
   */
  async streamConnectionEvents(vpsId: string, socket: WebSocket): Promise<void> {
    // Track this socket
    if (!this.activeStreams.has(vpsId)) {
      this.activeStreams.set(vpsId, new Set());
    }
    this.activeStreams.get(vpsId)!.add(socket);

    // Send current connection status
    const connection = this.connections.get(vpsId);
    if (connection) {
      const event: VPSConnectionEvent = {
        type: 'vps',
        vpsId,
        eventType: 'connection',
        connectionStatus: connection.status,
        message: this.getStatusMessage(connection.status, connection),
        timestamp: new Date().toISOString(),
      };
      this.sendToSocket(socket, event);
    }

    // Clean up on socket close
    socket.on('close', () => {
      this.removeStream(vpsId, socket);
    });

    socket.on('error', () => {
      this.removeStream(vpsId, socket);
    });
  }

  // ============================================================================
  // Public API - Query Methods
  // ============================================================================

  /**
   * Get connection info
   */
  getConnectionInfo(vpsId: string): VPSConnectionInfo | undefined {
    return this.connections.get(vpsId);
  }

  /**
   * Get command session
   */
  getCommandSession(commandId: string): VPSCommandSession | undefined {
    return this.commandSessions.get(commandId);
  }

  /**
   * Get active commands for a VPS
   */
  getActiveCommands(vpsId: string): VPSCommandSession[] {
    return Array.from(this.commandSessions.values()).filter(
      s => s.vpsId === vpsId && s.status === 'running'
    );
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): VPSConnectionInfo[] {
    return Array.from(this.connections.values()).filter(
      c => c.status === 'connected' || c.status === 'connecting'
    );
  }

  /**
   * Check if VPS is registered
   */
  hasConnection(vpsId: string): boolean {
    return this.connections.has(vpsId);
  }

  /**
   * Unregister a VPS connection
   */
  async unregisterConnection(vpsId: string): Promise<void> {
    const connection = this.connections.get(vpsId);
    if (connection) {
      // Emit disconnected status
      await this.emitConnectionStatus(vpsId, 'disconnected', 'Connection unregistered');
    }

    this.connections.delete(vpsId);
    this.activeStreams.delete(vpsId);
    
    // Clean up any active command sessions
    for (const [commandId, session] of this.commandSessions) {
      if (session.vpsId === vpsId) {
        this.commandSessions.delete(commandId);
        this.outputBuffers.delete(commandId);
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Publish an event to the VPS channel
   */
  private async publish(vpsId: string, event: VPSConnectionEvent | VPSCommandEvent | VPSStatsEvent): Promise<void> {
    const channelName = this.getChannelName(vpsId);
    await this.eventServer.publish(channelName, event);

    // Also publish to the general VPS channel
    await this.eventServer.publish('vps', event);
  }

  /**
   * Send an event to a specific socket
   */
  private sendToSocket(socket: WebSocket, event: VPSConnectionEvent | VPSCommandEvent | VPSStatsEvent): void {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(event));
      } catch (error) {
        // Socket error will be handled by close/error handlers
      }
    }
  }

  /**
   * Remove a stream from tracking
   */
  private removeStream(key: string, socket: WebSocket): void {
    const streams = this.activeStreams.get(key);
    if (streams) {
      streams.delete(socket);
      if (streams.size === 0) {
        this.activeStreams.delete(key);
      }
    }
  }

  /**
   * Find active command ID for a VPS
   */
  private findActiveCommandId(vpsId: string): string | undefined {
    for (const [commandId, session] of this.commandSessions) {
      if (session.vpsId === vpsId && session.status === 'running') {
        return commandId;
      }
    }
    return undefined;
  }

  /**
   * Generate a unique command ID
   */
  private generateCommandId(): string {
    return `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get status message
   */
  private getStatusMessage(status: ConnectionStatus, connection: VPSConnectionInfo): string {
    switch (status) {
      case 'connected':
        return `Connected to ${connection.host}:${connection.port}`;
      case 'disconnected':
        return `Disconnected from ${connection.host}:${connection.port}`;
      case 'connecting':
        return `Connecting to ${connection.host}:${connection.port}...`;
      case 'reconnecting':
        return `Reconnecting to ${connection.host}:${connection.port} (attempt ${connection.retryCount})...`;
      case 'error':
        return connection.lastError || `Connection error for ${connection.host}:${connection.port}`;
      default:
        return `Unknown status for ${connection.host}:${connection.port}`;
    }
  }

  /**
   * Get the channel name for a VPS
   */
  private getChannelName(vpsId: string): string {
    return `${this.channelPrefix}${vpsId}`;
  }

}
