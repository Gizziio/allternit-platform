// Terminal service - manages terminal sessions via HTTP API + SSE
// Routes local node requests to HTTP API, remote nodes to WebSocket gateway

export interface TerminalSessionInfo {
  id: string;
  nodeId: string;
  connected: boolean;
  lastActivity: Date;
}

type DataHandler = (data: string) => void;
type StatusHandler = (connected: boolean) => void;

interface ReconnectionState {
  attempt: number;
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

class NodeTerminalService {
  private sessions = new Map<string, TerminalSessionInfo>();
  private sockets = new Map<string, EventSource | WebSocket>();
  private dataHandlers = new Map<string, Set<DataHandler>>();
  private statusHandlers = new Map<string, Set<StatusHandler>>();
  private reconnectionAttempts = new Map<string, ReconnectionState>();
  private reconnectionTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Create a new terminal session
  async createSession(nodeId: string): Promise<TerminalSessionInfo> {
    if (nodeId === 'local') {
      return this.createLocalSession();
    } else {
      return this.createRemoteSession(nodeId);
    }
  }

  // Create session for local node (via HTTP API)
  private async createLocalSession(): Promise<TerminalSessionInfo> {
    try {
      const response = await fetch('http://localhost:3013/api/terminal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols: 80, rows: 24 }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create terminal: ${response.statusText}`);
      }

      const { sessionId } = await response.json();
      
      const session: TerminalSessionInfo = {
        id: sessionId,
        nodeId: 'local',
        connected: false,
        lastActivity: new Date(),
      };

      this.sessions.set(sessionId, session);
      this.dataHandlers.set(sessionId, new Set());
      this.statusHandlers.set(sessionId, new Set());

      // Connect to SSE stream
      await this.connectLocalTerminal(sessionId);

      return session;
    } catch (error) {
      console.error('[TerminalService] Failed to create local session:', error);
      throw error;
    }
  }

  // Create session for remote node (via WebSocket gateway)
  private async createRemoteSession(nodeId: string): Promise<TerminalSessionInfo> {
    const sessionId = `remote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: TerminalSessionInfo = {
      id: sessionId,
      nodeId,
      connected: false,
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.dataHandlers.set(sessionId, new Set());
    this.statusHandlers.set(sessionId, new Set());

    // Connect to WebSocket gateway
    await this.connectRemoteTerminal(sessionId, nodeId);

    return session;
  }

  // Connect to local terminal via SSE
  private async connectLocalTerminal(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `http://localhost:3013/api/terminal/${sessionId}/stream`
      );

      eventSource.onopen = () => {
        console.log(`[TerminalService] Connected to session ${sessionId}`);
        session.connected = true;
        this.statusHandlers.get(sessionId)?.forEach(handler => handler(true));
        this.reconnectionAttempts.delete(sessionId);
        resolve();
      };

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'data') {
            this.dataHandlers.get(sessionId)?.forEach(handler => handler(parsed.data));
          } else if (parsed.type === 'status') {
            session.connected = parsed.connected;
            this.statusHandlers.get(sessionId)?.forEach(handler => handler(parsed.connected));
          }
        } catch {
          // Raw data (not JSON)
          this.dataHandlers.get(sessionId)?.forEach(handler => handler(event.data));
        }
        session.lastActivity = new Date();
      };

      eventSource.onerror = (error) => {
        console.error(`[TerminalService] SSE error for session ${sessionId}:`, error);
        session.connected = false;
        this.statusHandlers.get(sessionId)?.forEach(handler => handler(false));
        eventSource.close();
        
        // Trigger reconnection
        this.attemptReconnection(sessionId);
        reject(error);
      };

      this.sockets.set(sessionId, eventSource);
    });
  }

  // Connect to remote terminal via WebSocket
  private async connectRemoteTerminal(sessionId: string, nodeId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // WebSocket URL for remote gateway
      const wsUrl = `wss://gateway.example.com/nodes/${nodeId}/terminal/${sessionId}`;
      
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.connected = true;
          this.statusHandlers.get(sessionId)?.forEach(handler => handler(true));
        }
        resolve();
      };

      socket.onmessage = (event) => {
        this.dataHandlers.get(sessionId)?.forEach(handler => handler(event.data));
        const session = this.sessions.get(sessionId);
        if (session) session.lastActivity = new Date();
      };

      socket.onclose = () => {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.connected = false;
          this.statusHandlers.get(sessionId)?.forEach(handler => handler(false));
        }
        this.attemptReconnection(sessionId);
      };

      socket.onerror = (error) => {
        console.error(`[TerminalService] WebSocket error for session ${sessionId}:`, error);
        reject(error);
      };

      this.sockets.set(sessionId, socket);
    });
  }

  // Reconnection with exponential backoff
  private async attemptReconnection(sessionId: string): Promise<void> {
    // Clear any existing timer
    const existingTimer = this.reconnectionTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const attemptState = this.reconnectionAttempts.get(sessionId) || {
      attempt: 0,
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
    };

    if (attemptState.attempt >= attemptState.maxAttempts) {
      console.warn(`[TerminalService] Max reconnection attempts reached for session ${sessionId}`);
      return;
    }

    attemptState.attempt++;
    const delay = Math.min(
      attemptState.baseDelay * Math.pow(2, attemptState.attempt - 1),
      attemptState.maxDelay
    );

    console.log(`[TerminalService] Reconnecting session ${sessionId} in ${delay}ms (attempt ${attemptState.attempt})`);

    const timer = setTimeout(async () => {
      try {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        if (session.nodeId === 'local') {
          await this.connectLocalTerminal(sessionId);
        } else {
          await this.connectRemoteTerminal(sessionId, session.nodeId);
        }
      } catch {
        // Reconnection failed, try again
        this.attemptReconnection(sessionId);
      }
    }, delay);

    this.reconnectionTimers.set(sessionId, timer);
    this.reconnectionAttempts.set(sessionId, attemptState);
  }

  // Send data to terminal
  sendData(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.nodeId === 'local') {
      // Send via HTTP POST
      fetch(`http://localhost:3013/api/terminal/${sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      }).catch(err => {
        console.error('[TerminalService] Failed to send data:', err);
      });
    } else {
      // Send via WebSocket
      const socket = this.sockets.get(sessionId);
      if (socket instanceof WebSocket && socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    }

    session.lastActivity = new Date();
  }

  // Resize terminal
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.nodeId === 'local') {
      fetch(`http://localhost:3013/api/terminal/${sessionId}/resize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols, rows }),
      }).catch(err => {
        console.error('[TerminalService] Failed to resize:', err);
      });
    } else {
      // Send resize via WebSocket
      const socket = this.sockets.get(sessionId);
      if (socket instanceof WebSocket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    }
  }

  // Subscribe to data events
  onData(sessionId: string, handler: DataHandler): () => void {
    const handlers = this.dataHandlers.get(sessionId);
    if (handlers) {
      handlers.add(handler);
    }
    return () => {
      handlers?.delete(handler);
    };
  }

  // Subscribe to status events
  onStatusChange(sessionId: string, handler: StatusHandler): () => void {
    const handlers = this.statusHandlers.get(sessionId);
    if (handlers) {
      handlers.add(handler);
    }
    // Call immediately with current status
    const session = this.sessions.get(sessionId);
    if (session) {
      handler(session.connected);
    }
    return () => {
      handlers?.delete(handler);
    };
  }

  // Close session
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear reconnection timer
    const timer = this.reconnectionTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectionTimers.delete(sessionId);
    }

    // Close socket
    const socket = this.sockets.get(sessionId);
    if (socket) {
      if (socket instanceof EventSource) {
        socket.close();
      } else if (socket instanceof WebSocket) {
        socket.close();
      }
      this.sockets.delete(sessionId);
    }

    // Notify server to close PTY (for local sessions)
    if (session.nodeId === 'local') {
      fetch(`http://localhost:3013/api/terminal/${sessionId}/close`, {
        method: 'POST',
      }).catch(() => {});
    }

    // Clean up
    this.sessions.delete(sessionId);
    this.dataHandlers.delete(sessionId);
    this.statusHandlers.delete(sessionId);
    this.reconnectionAttempts.delete(sessionId);
  }

  // Reconnect existing session (used for session persistence)
  async reconnectSession(sessionId: string, nodeId?: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session && nodeId) {
      // Restore session info
      const newSession: TerminalSessionInfo = {
        id: sessionId,
        nodeId,
        connected: false,
        lastActivity: new Date(),
      };
      this.sessions.set(sessionId, newSession);
      this.dataHandlers.set(sessionId, new Set());
      this.statusHandlers.set(sessionId, new Set());
    }

    try {
      if (nodeId === 'local' || session?.nodeId === 'local') {
        await this.connectLocalTerminal(sessionId);
      } else if (nodeId || session?.nodeId) {
        await this.connectRemoteTerminal(sessionId, nodeId || session!.nodeId);
      }
      return true;
    } catch {
      return false;
    }
  }

  // Get session info
  getSession(sessionId: string): TerminalSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  // List all active sessions
  getActiveSessions(): TerminalSessionInfo[] {
    return Array.from(this.sessions.values());
  }
}

// Singleton instance
export const nodeTerminalService = new NodeTerminalService();
