/**
 * Terminal WebSocket - Browser-to-SSH Bridge
 * 
 * Provides a WebSocket interface for browser-based terminal access
 * to SSH connections. Handles PTY sessions, resize events, and
 * bidirectional data flow.
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { sshService } from './SSHService';

// ============================================================================
// Types
// ============================================================================

export interface TerminalSession {
  id: string;
  connectionId: string;
  websocket: WebSocket;
  shell?: any; // SSH2 shell channel
  ptyOptions: PTYOptions;
  createdAt: Date;
  lastActivity: Date;
}

export interface PTYOptions {
  rows: number;
  cols: number;
  term: string;
}

export interface TerminalMessage {
  type: 'input' | 'resize' | 'close' | 'ping';
  data?: string;
  rows?: number;
  cols?: number;
}

export interface TerminalOutput {
  type: 'output' | 'error' | 'exit' | 'pong';
  data?: string;
  exitCode?: number;
}

// ============================================================================
// Terminal WebSocket Handler
// ============================================================================

export class TerminalWebSocket extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHeartbeat();
  }

  // ========================================================================
  // Session Management
  // ========================================================================

  async createSession(
    sessionId: string,
    connectionId: string,
    websocket: WebSocket,
    ptyOptions: PTYOptions
  ): Promise<boolean> {
    try {
      // Get SSH connection
      const ssh = this.getSSHConnection(connectionId);
      if (!ssh) {
        websocket.send(JSON.stringify({
          type: 'error',
          data: 'SSH connection not found. Please connect first.'
        }));
        return false;
      }

      // Request shell/PTY
      const shell = await ssh.requestShell({
        term: ptyOptions.term,
        rows: ptyOptions.rows,
        cols: ptyOptions.cols,
      });

      const session: TerminalSession = {
        id: sessionId,
        connectionId,
        websocket,
        shell,
        ptyOptions,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      this.sessions.set(sessionId, session);
      this.setupShellHandlers(session);
      this.setupWebSocketHandlers(session);

      this.emit('sessionCreated', { sessionId, connectionId });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create terminal session';
      websocket.send(JSON.stringify({
        type: 'error',
        data: errorMessage
      }));
      return false;
    }
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Close shell channel
    if (session.shell) {
      session.shell.close();
    }

    // Close WebSocket if still open
    if (session.websocket.readyState === WebSocket.OPEN) {
      session.websocket.close();
    }

    this.sessions.delete(sessionId);
    this.emit('sessionClosed', { sessionId, connectionId: session.connectionId });
  }

  // ========================================================================
  // Shell Handlers
  // ========================================================================

  private setupShellHandlers(session: TerminalSession): void {
    if (!session.shell) return;

    // Handle shell output
    session.shell.on('data', (data: Buffer) => {
      this.sendToWebSocket(session, {
        type: 'output',
        data: data.toString('utf-8')
      });
    });

    // Handle shell errors
    session.shell.stderr?.on('data', (data: Buffer) => {
      this.sendToWebSocket(session, {
        type: 'error',
        data: data.toString('utf-8')
      });
    });

    // Handle shell close
    session.shell.on('close', (exitCode: number) => {
      this.sendToWebSocket(session, {
        type: 'exit',
        exitCode
      });
      this.closeSession(session.id);
    });
  }

  // ========================================================================
  // WebSocket Handlers
  // ========================================================================

  private setupWebSocketHandlers(session: TerminalSession): void {
    session.websocket.on('message', (rawData: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const data = rawData.toString();
        const message: TerminalMessage = JSON.parse(data);
        session.lastActivity = new Date();

        switch (message.type) {
          case 'input':
            this.handleInput(session, message.data || '');
            break;
          case 'resize':
            this.handleResize(session, message.rows || 24, message.cols || 80);
            break;
          case 'close':
            this.closeSession(session.id);
            break;
          case 'ping':
            this.sendToWebSocket(session, { type: 'pong' });
            break;
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    session.websocket.on('close', () => {
      this.closeSession(session.id);
    });

    session.websocket.on('error', (error) => {
      console.error(`WebSocket error for session ${session.id}:`, error);
      this.closeSession(session.id);
    });
  }

  // ========================================================================
  // Message Handlers
  // ========================================================================

  private handleInput(session: TerminalSession, data: string): void {
    if (session.shell && session.shell.writable) {
      session.shell.write(data);
    }
  }

  private handleResize(session: TerminalSession, rows: number, cols: number): void {
    session.ptyOptions = { ...session.ptyOptions, rows, cols };
    
    if (session.shell && session.shell.setWindow) {
      session.shell.setWindow(rows, cols, 0, 0);
    }
  }

  private sendToWebSocket(session: TerminalSession, message: TerminalOutput): void {
    if (session.websocket.readyState === WebSocket.OPEN) {
      session.websocket.send(JSON.stringify(message));
    }
  }

  // ========================================================================
  // Heartbeat & Cleanup
  // ========================================================================

  private startHeartbeat(): void {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [sessionId, session] of this.sessions) {
        // Check for stale sessions
        if (now - session.lastActivity.getTime() > staleThreshold) {
          console.log(`Closing stale terminal session: ${sessionId}`);
          this.closeSession(sessionId);
          continue;
        }

        // Send ping to keep connection alive
        this.sendToWebSocket(session, { type: 'pong' });
      }
    }, 30000);
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private getSSHConnection(connectionId: string): any {
    // Access the SSH connection from the SSH service
    // This is a simplified version - in production, you'd need proper
    // access to the SSH service's internal connection map
    const ssh = (sshService as any).connections?.get(connectionId);
    return ssh;
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getSessionsByConnection(connectionId: string): TerminalSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.connectionId === connectionId);
  }

  dispose(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const terminalWebSocket = new TerminalWebSocket();

export default TerminalWebSocket;
