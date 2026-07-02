/**
 * Node Terminal Service
 * 
 * Manages WebSocket connections to node PTYs.
 * Handles terminal sessions, data streaming, and resize events.
 * Supports session persistence with reconnection and heartbeat.
 */

import {
  getRuntimeGatewayBaseUrl,
  getRuntimeGatewayWsBaseUrl,
} from '@/lib/runtime-backend-client';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('Terminal');

const TERMINAL_SESSIONS_STORAGE_KEY = 'allternit_terminal_sessions';
const TERMINAL_SNAPSHOTS_STORAGE_KEY = 'allternit_terminal_snapshots';

export interface VolumeMount {
  source: string;
  target: string;
  readOnly: boolean;
}

interface SandboxConfig {
  image: string;
  cpus?: number;
  memory_mb?: number;
  volumes: VolumeMount[];
  read_only_root?: boolean;
  drop_capabilities?: boolean;
  no_host_network?: boolean;
}

export interface TerminalSession {
  id: string;
  nodeId: string;
  shell: string;
  cols: number;
  rows: number;
  connected: boolean;
  createdAt: Date;
  /** Last activity timestamp for timeout tracking */
  lastActivity: Date;
  /** Whether this is a reconnected session */
  isReconnected: boolean;
  /** Optional sandbox configuration for containerized terminal */
  sandbox?: SandboxConfig;
}

interface SessionStatusResponse {
  exists: boolean;
  session_id: string;
  node_id?: string;
  connection_state?: string;
  last_activity?: string;
  can_reconnect: boolean;
}

export interface TimeoutWarning {
  type: 'timeout_warning';
  remaining_seconds: number;
  message: string;
}

export interface TerminalSnapshotFrame {
  type: 'snapshot';
  snapshot: string;
  cols: number;
  rows: number;
  updated_at?: string;
}

interface TerminalSnapshotState {
  snapshot: string;
  cols: number;
  rows: number;
  updatedAt: string;
}

export type TerminalDataHandler = (data: string) => void;
export type TerminalStatusHandler = (connected: boolean) => void;
type TerminalTimeoutWarningHandler = (warning: TimeoutWarning) => void;
type TerminalSnapshotHandler = (frame: TerminalSnapshotFrame) => void;

// File operations types
interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
  permissions?: number;
  mime_type?: string;
}

export interface FileListResponse {
  path: string;
  entries: FileEntry[];
}

export interface FileTransferProgress {
  operationId: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

type FileTransferHandler = (progress: FileTransferProgress) => void;

interface ReconnectionAttempt {
  attempt: number;
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

class NodeTerminalService {
  private sockets: Map<string, WebSocket> = new Map();
  private dataHandlers: Map<string, TerminalDataHandler> = new Map();
  private statusHandlers: Map<string, TerminalStatusHandler> = new Map();
  private timeoutWarningHandlers: Map<string, TerminalTimeoutWarningHandler> = new Map();
  private snapshotHandlers: Map<string, TerminalSnapshotHandler> = new Map();
  private sessions: Map<string, TerminalSession> = new Map();
  private reconnectionAttempts: Map<string, ReconnectionAttempt> = new Map();
  private keepaliveIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  private async buildGatewayUrl(path: string): Promise<string> {
    return `${await getRuntimeGatewayBaseUrl()}${path}`;
  }

  private async buildGatewayWsUrl(path: string): Promise<string> {
    return `${await getRuntimeGatewayWsBaseUrl()}${path}`;
  }

  constructor() {
    // Restore sessions from localStorage on initialization
    this.restoreSessionsFromStorage();
    
    // Set up beforeunload handler to save sessions
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.saveSessionsToStorage();
      });
    }
  }

  /**
   * Save active sessions to localStorage for page refresh recovery
   */
  private saveSessionsToStorage(): void {
    try {
      const sessionsData = Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        nodeId: session.nodeId,
        shell: session.shell,
        cols: session.cols,
        rows: session.rows,
        createdAt: session.createdAt.toISOString(),
        lastActivity: session.lastActivity.toISOString(),
      }));
      
      localStorage.setItem(TERMINAL_SESSIONS_STORAGE_KEY, JSON.stringify(sessionsData));
    } catch (e) {
      logger.warn({ err: e }, 'Failed to save sessions to localStorage');
    }
  }

  /**
   * Restore sessions from localStorage
   */
  private restoreSessionsFromStorage(): void {
    try {
      const stored = localStorage.getItem(TERMINAL_SESSIONS_STORAGE_KEY);
      if (stored) {
        const sessionsData = JSON.parse(stored);
        
        // Clear storage after reading
        localStorage.removeItem(TERMINAL_SESSIONS_STORAGE_KEY);
        
        // Note: We don't auto-reconnect here, the component will handle that
        // We just store the data temporarily for the component to use
        this._pendingRestoredSessions = sessionsData;
      }
    } catch (e) {
      logger.warn({ err: e }, 'Failed to restore sessions from localStorage');
    }
  }

  private _pendingRestoredSessions: any[] = [];

  private readSnapshotsFromStorage(): Record<string, TerminalSnapshotState> {
    if (typeof window === 'undefined') {
      return {};
    }
    try {
      const stored = localStorage.getItem(TERMINAL_SNAPSHOTS_STORAGE_KEY);
      if (!stored) {
        return {};
      }
      return JSON.parse(stored) as Record<string, TerminalSnapshotState>;
    } catch (e) {
      logger.warn({ err: e }, 'Failed to read snapshots from localStorage');
      return {};
    }
  }

  private writeSnapshotsToStorage(snapshots: Record<string, TerminalSnapshotState>): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (Object.keys(snapshots).length === 0) {
        localStorage.removeItem(TERMINAL_SNAPSHOTS_STORAGE_KEY);
        return;
      }
      localStorage.setItem(TERMINAL_SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
    } catch (e) {
      logger.warn({ err: e }, 'Failed to write snapshots to localStorage');
    }
  }

  /**
   * Get pending restored sessions (call this on component mount)
   */
  getPendingRestoredSessions(): Array<{ id: string; nodeId: string; shell: string; cols: number; rows: number }> {
    const sessions = this._pendingRestoredSessions;
    this._pendingRestoredSessions = [];
    return sessions;
  }

  saveSnapshot(sessionId: string, snapshot: string, cols: number, rows: number): void {
    if (!this.sessions.has(sessionId)) {
      return;
    }
    if (!snapshot.trim()) {
      return;
    }
    const snapshots = this.readSnapshotsFromStorage();
    snapshots[sessionId] = {
      snapshot,
      cols,
      rows,
      updatedAt: new Date().toISOString(),
    };
    this.writeSnapshotsToStorage(snapshots);
  }

  getSnapshot(sessionId: string): TerminalSnapshotState | null {
    const snapshots = this.readSnapshotsFromStorage();
    return snapshots[sessionId] ?? null;
  }

  clearSnapshot(sessionId: string): void {
    const snapshots = this.readSnapshotsFromStorage();
    if (!(sessionId in snapshots)) {
      return;
    }
    delete snapshots[sessionId];
    this.writeSnapshotsToStorage(snapshots);
  }

  /**
   * Check if a session can be reconnected
   */
  async checkSessionStatus(sessionId: string): Promise<SessionStatusResponse | null> {
    try {
      const response = await fetch(await this.buildGatewayUrl(`/api/v1/terminal/sessions/${sessionId}/status`), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error({ err: error }, 'Failed to check session status');
      return null;
    }
  }

  /**
   * Try to reconnect to an existing session
   */
  async reconnectSession(
    sessionId: string,
    nodeId?: string
  ): Promise<TerminalSession | null> {
    try {
      // First check if session is still valid on server
      const status = await this.checkSessionStatus(sessionId);
      
      if (!status || !status.exists || !status.can_reconnect) {
        logger.debug('Session cannot be reconnected: ' + String(status));
        return null;
      }

      const actualNodeId = nodeId || status.node_id!;
      
      // Try to create session with reconnect flag
      const response = await fetch(await this.buildGatewayUrl(`/api/v1/nodes/${actualNodeId}/terminal`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shell: '/bin/bash',
          cols: 80,
          rows: 24,
          reconnect_session_id: sessionId,
        }),
      });

      if (!response.ok) {
        logger.error({ status: response.statusText }, 'Failed to reconnect session');
        return null;
      }

      const data = await response.json();
      
      if (!data.reconnected) {
        logger.debug('Server created new session instead of reconnecting');
        return null;
      }

      const session: TerminalSession = {
        id: data.sessionId,
        nodeId: data.nodeId,
        shell: data.shell,
        cols: data.cols,
        rows: data.rows,
        connected: false,
        createdAt: new Date(),
        lastActivity: new Date(),
        isReconnected: true,
      };

      this.sessions.set(sessionId, session);
      
      // Connect WebSocket for this session
      await this.connectWebSocket(sessionId);

      logger.debug('Successfully reconnected to session: ' + String(sessionId));
      return session;
    } catch (error) {
      logger.error({ err: error }, 'Error reconnecting session');
      return null;
    }
  }

  /**
   * Create a new terminal session on a node
   * Tries to reconnect to existing session first if sessionId is provided
   */
  async createSession(
    nodeId: string,
    options: {
      shell?: string;
      cols?: number;
      rows?: number;
      env?: Record<string, string>;
      workingDir?: string;
      reconnectSessionId?: string;
      sandbox?: SandboxConfig;
    } = {}
  ): Promise<TerminalSession | null> {
    const {
      shell = '/bin/bash',
      cols = 80,
      rows = 24,
      env = {},
      workingDir,
      reconnectSessionId,
      sandbox,
    } = options;

    // Try to reconnect if sessionId provided
    if (reconnectSessionId) {
      const reconnected = await this.reconnectSession(reconnectSessionId, nodeId);
      if (reconnected) {
        return reconnected;
      }
      logger.debug('Reconnect failed, creating new session');
    }

    try {
      // First, request the control plane to create a terminal session on the node
      const requestBody: Record<string, unknown> = { shell, cols, rows, env, working_dir: workingDir };
      if (sandbox) {
        requestBody.sandbox = sandbox;
      }
      
      const response = await fetch(await this.buildGatewayUrl(`/api/v1/nodes/${nodeId}/terminal`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        logger.error({ status: response.statusText }, 'Failed to create terminal session');
        return null;
      }

      const { sessionId } = await response.json();

      const session: TerminalSession = {
        id: sessionId,
        nodeId,
        shell,
        cols,
        rows,
        connected: false,
        createdAt: new Date(),
        lastActivity: new Date(),
        isReconnected: false,
        sandbox,
      };

      this.sessions.set(sessionId, session);
      
      // Connect WebSocket for this session
      await this.connectWebSocket(sessionId);

      return session;
    } catch (error) {
      logger.error({ err: error }, 'Error creating terminal session');
      return null;
    }
  }

  /**
   * Connect WebSocket for a terminal session
   */
  private async connectWebSocket(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const wsUrl = await this.buildGatewayWsUrl(`/ws/terminal/${sessionId}`);

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      this.sockets.set(sessionId, socket);

      socket.onopen = () => {
        logger.debug(`Connected to session ${sessionId}`);
        session.connected = true;
        session.lastActivity = new Date();
        this.statusHandlers.get(sessionId)?.(true);
        
        // Reset reconnection attempts on successful connection
        this.reconnectionAttempts.delete(sessionId);
        
        // Start keepalive interval
        this.startKeepalive(sessionId);
        
        resolve();
      };

      socket.onmessage = async (event) => {
        const handler = this.dataHandlers.get(sessionId);
        if (handler) {
          let data: string;
          if (event.data instanceof Blob) {
            data = await event.data.text();
          } else {
            data = event.data;
          }
          
          // Check for timeout warning messages
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'timeout_warning') {
              const warningHandler = this.timeoutWarningHandlers.get(sessionId);
              if (warningHandler) {
                warningHandler(parsed as TimeoutWarning);
              }
              return;
            }
            if (parsed.type === 'snapshot') {
              const snapshotHandler = this.snapshotHandlers.get(sessionId);
              if (snapshotHandler) {
                snapshotHandler(parsed as TerminalSnapshotFrame);
              }
              return;
            }
          } catch {
            // Not JSON, treat as regular terminal data
          }
          
          handler(data);
        }
      };

      socket.onclose = (event) => {
        logger.debug(`Disconnected from session ${sessionId} (${event.code} ${event.reason})`);
        session.connected = false;
        this.statusHandlers.get(sessionId)?.(false);
        this.sockets.delete(sessionId);
        this.stopKeepalive(sessionId);
        
        // Attempt reconnection if not intentionally closed
        if (!event.wasClean) {
          this.attemptReconnection(sessionId);
        }
      };

      socket.onerror = (error) => {
        logger.error({ err: error }, `WebSocket error for session ${sessionId}`);
        session.connected = false;
        this.statusHandlers.get(sessionId)?.(false);
        reject(error);
      };
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private async attemptReconnection(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Get or initialize reconnection attempt state
    let attemptState = this.reconnectionAttempts.get(sessionId);
    if (!attemptState) {
      attemptState = {
        attempt: 0,
        maxAttempts: 5,
        baseDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds
      };
      this.reconnectionAttempts.set(sessionId, attemptState);
    }

    if (attemptState.attempt >= attemptState.maxAttempts) {
      logger.debug(`Max reconnection attempts reached for session ${sessionId}`);
      this.statusHandlers.get(sessionId)?.(false);
      return;
    }

    attemptState.attempt++;
    
    // Calculate exponential backoff delay
    const delay = Math.min(
      attemptState.baseDelay * Math.pow(2, attemptState.attempt - 1),
      attemptState.maxDelay
    );

    logger.debug(`Reconnection attempt ${attemptState.attempt}/${attemptState.maxAttempts} for session ${sessionId} in ${delay}ms`);

    // Wait before attempting reconnection
    await new Promise(resolve => setTimeout(resolve, delay));

    // Check if session is already connected (maybe another reconnection succeeded)
    if (this.sockets.has(sessionId)) {
      logger.debug(`Session ${sessionId} already reconnected`);
      return;
    }

    try {
      // Try to reconnect
      const reconnected = await this.reconnectSession(sessionId, session.nodeId);
      
      if (reconnected) {
        logger.debug(`Successfully reconnected session ${sessionId}`);
      } else {
        // Schedule next attempt
        this.attemptReconnection(sessionId);
      }
    } catch (error) {
      logger.error({ err: error }, `Reconnection attempt failed for session ${sessionId}`);
      this.attemptReconnection(sessionId);
    }
  }

  /**
   * Start keepalive interval to prevent session timeout
   */
  private startKeepalive(sessionId: string): void {
    // Send keepalive every 2 minutes
    const interval = setInterval(() => {
      const socket = this.sockets.get(sessionId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        // Send keepalive command
        socket.send(JSON.stringify({ type: 'keepalive' }));
        
        // Update local activity timestamp
        const session = this.sessions.get(sessionId);
        if (session) {
          session.lastActivity = new Date();
        }
      }
    }, 2 * 60 * 1000); // 2 minutes

    this.keepaliveIntervals.set(sessionId, interval);
  }

  /**
   * Stop keepalive interval
   */
  private stopKeepalive(sessionId: string): void {
    const interval = this.keepaliveIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.keepaliveIntervals.delete(sessionId);
    }
  }

  /**
   * Send data to terminal (user input)
   */
  sendData(sessionId: string, data: string): void {
    const socket = this.sockets.get(sessionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(data);
      
      // Update activity timestamp
      const session = this.sessions.get(sessionId);
      if (session) {
        session.lastActivity = new Date();
      }
    } else {
      logger.warn(`Cannot send data, socket not open for session ${sessionId}`);
    }
  }

  /**
   * Resize terminal
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const socket = this.sockets.get(sessionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'resize', cols, rows }));
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      session.cols = cols;
      session.rows = rows;
    }
  }

  /**
   * Send keepalive to extend session
   */
  sendKeepalive(sessionId: string): void {
    const socket = this.sockets.get(sessionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'keepalive' }));
      
      const session = this.sessions.get(sessionId);
      if (session) {
        session.lastActivity = new Date();
      }
      
      logger.debug(`Keepalive sent for session ${sessionId}`);
    }
  }

  sendSnapshot(sessionId: string, snapshot: string, cols: number, rows: number): void {
    const socket = this.sockets.get(sessionId);
    this.saveSnapshot(sessionId, snapshot, cols, rows);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'snapshot',
        snapshot,
        cols,
        rows,
      }));
    }
  }

  /**
   * Register data handler for a session
   */
  onData(sessionId: string, handler: TerminalDataHandler): void {
    this.dataHandlers.set(sessionId, handler);
  }

  /**
   * Register status handler for a session
   */
  onStatusChange(sessionId: string, handler: TerminalStatusHandler): void {
    this.statusHandlers.set(sessionId, handler);
  }

  /**
   * Register timeout warning handler for a session
   */
  onTimeoutWarning(sessionId: string, handler: TerminalTimeoutWarningHandler): void {
    this.timeoutWarningHandlers.set(sessionId, handler);
  }

  onSnapshot(sessionId: string, handler: TerminalSnapshotHandler): void {
    this.snapshotHandlers.set(sessionId, handler);
  }

  /**
   * Close a terminal session
   */
  closeSession(sessionId: string): void {
    // Stop keepalive
    this.stopKeepalive(sessionId);
    
    const socket = this.sockets.get(sessionId);
    if (socket) {
      // Send close code 1000 (normal closure) to indicate intentional close
      socket.close(1000, 'User closed terminal');
      this.sockets.delete(sessionId);
    }

    this.dataHandlers.delete(sessionId);
    this.statusHandlers.delete(sessionId);
    this.timeoutWarningHandlers.delete(sessionId);
    this.snapshotHandlers.delete(sessionId);
    this.sessions.delete(sessionId);
    this.reconnectionAttempts.delete(sessionId);
    this.clearSnapshot(sessionId);

    // Notify API to close session on node
    this.buildGatewayUrl(`/api/v1/terminal/${sessionId}`)
      .then((url) =>
        fetch(url, {
          method: 'DELETE',
        }),
      )
      .catch((err: unknown) => logger.error({ err }, 'Async error'));
    
    // Save updated sessions to storage
    this.saveSessionsToStorage();
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Check if session is connected
   */
  isConnected(sessionId: string): boolean {
    const socket = this.sockets.get(sessionId);
    return socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Check if currently attempting to reconnect
   */
  isReconnecting(sessionId: string): boolean {
    const attempt = this.reconnectionAttempts.get(sessionId);
    return attempt !== undefined && attempt.attempt > 0;
  }

  /**
   * Get reconnection attempt count
   */
  getReconnectionAttempt(sessionId: string): number {
    return this.reconnectionAttempts.get(sessionId)?.attempt || 0;
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  /**
   * List files in a directory
   */
  async listFiles(sessionId: string, path: string): Promise<FileListResponse | null> {
    try {
      const response = await fetch(
        await this.buildGatewayUrl(`/api/v1/terminal/${sessionId}/files/list?path=${encodeURIComponent(path)}`),
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        logger.error({ status: response.statusText }, 'Failed to list files');
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error({ err: error }, 'Error listing files');
      return null;
    }
  }

  /**
   * Upload a file to the node
   */
  async uploadFile(
    sessionId: string, 
    path: string, 
    data: Uint8Array,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Use XMLHttpRequest for upload progress
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const progress = (e.loaded / e.total) * 100;
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true });
          } else {
            let error = 'Upload failed';
            try {
              const response = JSON.parse(xhr.responseText);
              error = response.error || error;
            } catch {
              // Ignore parse error
            }
            resolve({ success: false, error });
          }
        });

        xhr.addEventListener('error', () => {
          resolve({ success: false, error: 'Upload failed' });
        });

        this.buildGatewayUrl(`/api/v1/terminal/${sessionId}/files/upload?path=${encodeURIComponent(path)}`)
          .then((url) => {
            xhr.open('POST', url);
            xhr.send(new Blob([data as BlobPart]));
          })
          .catch(() => {
            resolve({ success: false, error: 'Upload failed' });
          });
      });
    } catch (error) {
      logger.error({ err: error }, 'Error uploading file');
      return { success: false, error: 'Upload failed' };
    }
  }

  /**
   * Download a file from the node
   */
  async downloadFile(sessionId: string, path: string, filename?: string): Promise<boolean> {
    try {
      const response = await fetch(
        await this.buildGatewayUrl(`/api/v1/terminal/${sessionId}/files/download?path=${encodeURIComponent(path)}`)
      );

      if (!response.ok) {
        logger.error({ status: response.statusText }, 'Failed to download file');
        return false;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || path.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      logger.error({ err: error }, 'Error downloading file');
      return false;
    }
  }

  /**
   * Delete a file or directory
   */
  async deleteFile(sessionId: string, path: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        await this.buildGatewayUrl(`/api/v1/terminal/${sessionId}/files?path=${encodeURIComponent(path)}`),
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Delete failed' };
      }

      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Error deleting file');
      return { success: false, error: 'Delete failed' };
    }
  }

  /**
   * Create a directory
   */
  async createDirectory(sessionId: string, path: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        await this.buildGatewayUrl(`/api/v1/terminal/${sessionId}/files/mkdir?path=${encodeURIComponent(path)}`),
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Failed to create directory' };
      }

      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Error creating directory');
      return { success: false, error: 'Failed to create directory' };
    }
  }

  /**
   * Get file/directory info
   */
  async statFile(sessionId: string, path: string): Promise<FileEntry | null> {
    try {
      const response = await fetch(
        await this.buildGatewayUrl(`/api/v1/terminal/${sessionId}/files/stat?path=${encodeURIComponent(path)}`)
      );

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error({ err: error }, 'Error getting file info');
      return null;
    }
  }
}

// Singleton instance
export const nodeTerminalService = new NodeTerminalService();
