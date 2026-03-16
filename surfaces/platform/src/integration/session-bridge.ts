/**
 * Session Bridge - Syncs OpenClaw sessions to ChatStore Agent Mode
 * 
 * This module provides real-time bidirectional synchronization between
 * OpenClaw native sessions and the Chat UI, enabling Agent Mode threads
 * to be backed by OpenClaw session infrastructure.
 */

import { useChatStore, type ChatThread, type ChatThreadMode } from '../views/chat/ChatStore';
import { sessionApi, type Session, type Message } from '../views/openclaw/session-api';

/**
 * Session change event types from backend SSE
 */
type SessionChangeEvent =
  | { type: 'created'; session: Session }
  | { type: 'updated'; session_id: string; changes: SessionChanges }
  | { type: 'deleted'; session_id: string }
  | { type: 'message_added'; session_id: string; message: SessionMessage }
  | { type: 'status_changed'; session_id: string; active: boolean };

/**
 * Session changes structure
 */
interface SessionChanges {
  name?: string | null;
  description?: string | null;
  active?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Session message structure from sync events
 */
interface SessionMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

/**
 * Bridge configuration options
 */
interface SessionBridgeConfig {
  apiBaseUrl: string;
  reconnectIntervalMs: number;
  maxReconnectAttempts: number;
  enableDebugLogs: boolean;
  enabled: boolean;
  unavailableLogThrottleMs: number;
}

const isSessionBridgeEnabled = (): boolean => {
  const envValue = typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as any).VITE_ENABLE_SESSION_BRIDGE
    : undefined;

  return envValue !== 'false';
};

const isSessionBridgeDebugEnabled = (): boolean => {
  const envValue = typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as any).VITE_SESSION_BRIDGE_DEBUG
    : undefined;

  return envValue === 'true';
};

/**
 * Resolve the API base URL from environment or window injection
 * Priority: window.__A2R_API_URL__ > VITE_A2R_GATEWAY_URL > default
 */
const resolveApiBaseUrl = (): string => {
  // Check for window injection (for Electron/runtime injection)
  const injectedUrl = typeof window !== 'undefined'
    ? (window as unknown as { __A2R_API_URL__?: string }).__A2R_API_URL__
    : undefined;

  // Check for Vite environment variable
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as any).VITE_A2R_GATEWAY_URL
    : undefined;

  // Default fallback - use the standard gateway port
  const defaultUrl = 'http://127.0.0.1:3000';

  const candidate = injectedUrl || envUrl || defaultUrl;
  // Normalize URL (remove trailing slash)
  return candidate.replace(/\/+$/, '');
};

/**
 * Default bridge configuration
 */
const DEFAULT_CONFIG: SessionBridgeConfig = {
  apiBaseUrl: resolveApiBaseUrl(),
  reconnectIntervalMs: 3000,
  maxReconnectAttempts: 10,
  enableDebugLogs: false,
  enabled: isSessionBridgeEnabled(),
  unavailableLogThrottleMs: 60000,
};

/**
 * Session Bridge - Manages bidirectional sync between OpenClaw and ChatStore
 */
export class SessionSyncClient {
  private eventSource: EventSource | null = null;
  private sessionToThreadMap = new Map<string, string>(); // session_id -> thread_id
  private threadToSessionMap = new Map<string, string>(); // thread_id -> session_id
  private syncedSessionIds = new Set<string>(); // Track sessions already synced to prevent duplicates
  private hasCompletedInitialSync = false; // Track if initial sync completed
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnected = false;
  private lastUnavailableLogAt = 0;
  private config: SessionBridgeConfig;
  private onConnectionChangeCallbacks: ((connected: boolean) => void)[] = [];

  constructor(config: Partial<SessionBridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect to the session sync SSE endpoint
   */
  connect(): void {
    if (!this.config.enabled) {
      this.log('Session bridge disabled, skipping connect()');
      return;
    }

    if (this.eventSource) {
      this.log('Already connected, skipping connect()');
      return;
    }

    const baseUrl = this.config.apiBaseUrl;
    const path = baseUrl.includes('/api/v1') ? '/sessions/sync' : '/api/v1/sessions/sync';
    const url = `${baseUrl}${path}`;
    this.log('Connecting to session sync:', url);

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.log('Session sync connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastUnavailableLogAt = 0;
        this.notifyConnectionChange(true);
        useChatStore.getState().setOpenClawConnected(true);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const change: SessionChangeEvent = JSON.parse(event.data);
          this.log('Received session change:', change.type);
          this.handleSessionChange(change);
        } catch (error) {
          console.error('[SessionBridge] Failed to parse event:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        this.handleConnectionFailure('Session sync connection lost', error);
      };
    } catch (error) {
      this.handleConnectionFailure('Failed to create session sync connection', error);
    }
  }

  /**
   * Disconnect from the session sync endpoint
   */
  disconnect(): void {
    this.log('Disconnecting session sync');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.notifyConnectionChange(false);
    useChatStore.getState().setOpenClawConnected(false);
  }

  /**
   * Check if the bridge is currently connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Register a callback for connection state changes
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.onConnectionChangeCallbacks.push(callback);
    return () => {
      const index = this.onConnectionChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onConnectionChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Create a new Agent thread backed by an OpenClaw session
   */
  async createAgentThread(name: string, description?: string): Promise<string> {
    // Create OpenClaw session
    const sessionResponse = await sessionApi.createSession({ name, description });

    // Fetch full session to get all required fields
    const session = await sessionApi.getSession(sessionResponse.id);

    // Create corresponding Chat thread
    const threadId = await this.createThreadFromSession(session);

    return threadId;
  }

  /**
   * Send a message from Chat UI to OpenClaw session
   */
  async sendMessage(threadId: string, text: string, role: string = 'user'): Promise<void> {
    const sessionId = this.threadToSessionMap.get(threadId);
    if (!sessionId) {
      throw new Error(`No OpenClaw session linked to thread ${threadId}`);
    }

    await sessionApi.sendMessage(sessionId, { text, role });
  }

  /**
   * Get the OpenClaw session ID for a thread
   */
  getSessionIdForThread(threadId: string): string | undefined {
    return this.threadToSessionMap.get(threadId);
  }

  /**
   * Get the Chat thread ID for an OpenClaw session
   */
  getThreadIdForSession(sessionId: string): string | undefined {
    return this.sessionToThreadMap.get(sessionId);
  }

  /**
   * Load all existing OpenClaw sessions and create corresponding threads
   * Only runs once to prevent duplicate thread creation on reconnects
   */
  async syncExistingSessions(): Promise<void> {
    if (!this.config.enabled) {
      this.log('Session bridge disabled, skipping syncExistingSessions()');
      return;
    }

    // Skip if already completed initial sync
    if (this.hasCompletedInitialSync) {
      this.log('Initial sync already completed, skipping');
      return;
    }

    try {
      const response = await sessionApi.listSessions();
      const sessions = response?.sessions || [];
      this.log(`Syncing ${sessions.length} existing sessions`);

      for (const sessionSummary of sessions) {
        // Skip if already synced or already has a thread mapping
        if (this.syncedSessionIds.has(sessionSummary.id) || this.sessionToThreadMap.has(sessionSummary.id)) {
          continue;
        }
        
        // Mark as synced immediately to prevent race conditions
        this.syncedSessionIds.add(sessionSummary.id);
        
        // Fetch full session to get all required fields
        const session = await sessionApi.getSession(sessionSummary.id);
        await this.createThreadFromSession(session);
      }
      
      this.hasCompletedInitialSync = true;
      this.log('Initial sync completed');
    } catch (error) {
      this.logUnavailable('Failed to sync existing sessions', error);
    }
  }

  /**
   * Delete both the thread and linked session
   */
  async deleteThread(threadId: string): Promise<void> {
    const sessionId = this.threadToSessionMap.get(threadId);
    
    if (sessionId) {
      try {
        await sessionApi.deleteSession(sessionId);
      } catch (error) {
        console.warn('[SessionBridge] Failed to delete session:', error);
      }
    }

    useChatStore.getState().deleteThread(threadId);
  }

  /**
   * Delete a session and its linked thread
   */
  async deleteSession(sessionId: string): Promise<void> {
    const threadId = this.sessionToThreadMap.get(sessionId);
    
    try {
      await sessionApi.deleteSession(sessionId);
    } catch (error) {
      console.warn('[SessionBridge] Failed to delete session:', error);
    }

    if (threadId) {
      useChatStore.getState().deleteThread(threadId);
    }
  }

  /**
   * Get all agent sessions (threads backed by OpenClaw)
   */
  getAgentThreads(): ChatThread[] {
    const { threads } = useChatStore.getState();
    return threads.filter(thread => 
      thread.mode === 'agent' || this.threadToSessionMap.has(thread.id)
    );
  }

  /**
   * Convert a regular thread to an agent thread with OpenClaw backing
   */
  async convertToAgentThread(threadId: string): Promise<string> {
    const chatStore = useChatStore.getState();
    const thread = chatStore.threads.find(t => t.id === threadId);
    
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    // Create OpenClaw session for this thread
    const session = await sessionApi.createSession({
      name: thread.title,
      description: `Converted from thread ${threadId}`
    });

    // Link the thread to the session
    this.linkThreadToSession(threadId, session.id);

    // Set thread mode to agent
    chatStore.setThreadMode(threadId, 'agent');

    // Sync existing messages
    for (const message of thread.messages) {
      await sessionApi.sendMessage(session.id, {
        text: message.text,
        role: message.role
      });
    }

    return session.id;
  }

  private handleSessionChange(change: SessionChangeEvent): void {
    switch (change.type) {
      case 'created':
        if (change.session) {
          this.handleSessionCreated(change.session);
        }
        break;

      case 'message_added':
        if (change.session_id && change.message) {
          this.handleMessageAdded(change.session_id, change.message);
        }
        break;

      case 'deleted':
        if (change.session_id) {
          this.handleSessionDeleted(change.session_id);
        }
        break;

      case 'updated':
        if (change.session_id) {
          this.handleSessionUpdated(change.session_id, change.changes);
        }
        break;

      case 'status_changed':
        if (change.session_id) {
          this.handleStatusChanged(change.session_id, change.active);
        }
        break;

      default:
        this.log('Unknown event type:', (change as { type: string }).type);
    }
  }

  private handleSessionCreated(session: Session): void {
    // Check if we already have a thread for this session
    if (this.sessionToThreadMap.has(session.id)) {
      this.log('Session already has thread, skipping:', session.id);
      return;
    }

    this.createThreadFromSession(session);
  }

  private handleMessageAdded(sessionId: string, message: SessionMessage): void {
    const threadId = this.sessionToThreadMap.get(sessionId);
    if (!threadId) {
      this.log('No thread for session, fetching session:', sessionId);
      // Session exists but thread doesn't - fetch and create
      this.fetchAndCreateThread(sessionId);
      return;
    }

    const chatStore = useChatStore.getState();
    const thread = chatStore.threads.find(t => t.id === threadId);
    
    if (!thread) {
      console.warn('[SessionBridge] Thread not found:', threadId);
      return;
    }

    // Check if message already exists (avoid duplicates)
    const existingMessage = thread.messages.find(m => m.id === message.id);
    if (existingMessage) {
      return;
    }

    // Add message to thread
    chatStore.addMessage(threadId, message.role as 'user' | 'assistant', message.content);
    this.log('Added message to thread:', threadId);
  }

  private handleSessionDeleted(sessionId: string): void {
    const threadId = this.sessionToThreadMap.get(sessionId);
    if (threadId) {
      useChatStore.getState().deleteThread(threadId);
      this.unlinkThreadAndSession(threadId, sessionId);
      this.log('Deleted thread for session:', sessionId);
    }
  }

  private handleSessionUpdated(sessionId: string, changes: SessionChanges): void {
    const threadId = this.sessionToThreadMap.get(sessionId);
    if (!threadId) return;

    // Update thread title if session name changed
    if (changes.name !== undefined) {
      useChatStore.getState().renameThread(threadId, changes.name || 'Agent Session');
    }
  }

  private handleStatusChanged(sessionId: string, active: boolean): void {
    // Could update thread UI to show active/inactive status
    this.log('Session status changed:', sessionId, active);
  }

  private async createThreadFromSession(session: Session): Promise<string> {
    const chatStore = useChatStore.getState();

    // Check if already synced or thread already exists for this session
    if (this.syncedSessionIds.has(session.id)) {
      return this.sessionToThreadMap.get(session.id) || `agent-${session.id}`;
    }
    
    const existingThreadId = this.sessionToThreadMap.get(session.id);
    if (existingThreadId) {
      this.syncedSessionIds.add(session.id);
      return existingThreadId;
    }

    // Check for existing agent thread with same name
    const existing = chatStore.threads.find(t =>
      t.mode === 'agent' && t.title === (session.name || 'Agent Session')
    );
    if (existing && existing.id.startsWith('agent-')) {
      // Link existing thread
      this.syncedSessionIds.add(session.id);
      this.linkThreadToSession(existing.id, session.id);
      return existing.id;
    }

    // Create new agent thread
    const threadId = `agent-${session.id}`;
    
    // Add to store without calling kernel API
    chatStore.createThread(session.name || 'Agent Session', undefined, 'agent');
    
    // Now link the thread to the session
    // We need to find the thread we just created (it will have a different ID)
    const { threads } = useChatStore.getState();
    const newThread = threads.find(t => 
      t.title === (session.name || 'Agent Session') && 
      t.mode === 'agent' &&
      !this.threadToSessionMap.has(t.id)
    );

    if (newThread) {
      this.syncedSessionIds.add(session.id);
      this.linkThreadToSession(newThread.id, session.id);
      this.log('Created thread for session:', session.id, '->', newThread.id);
      return newThread.id;
    }

    // Mark as synced even if thread creation failed
    this.syncedSessionIds.add(session.id);
    return threadId;
  }

  private async fetchAndCreateThread(sessionId: string): Promise<void> {
    try {
      const session = await sessionApi.getSession(sessionId);
      await this.createThreadFromSession(session);
    } catch (error) {
      console.error('[SessionBridge] Failed to fetch session:', error);
    }
  }

  private linkThreadToSession(threadId: string, sessionId: string): void {
    this.sessionToThreadMap.set(sessionId, threadId);
    this.threadToSessionMap.set(threadId, sessionId);
    useChatStore.getState().linkThreadToSession(threadId, sessionId);
  }

  private unlinkThreadAndSession(threadId: string, sessionId: string): void {
    this.sessionToThreadMap.delete(sessionId);
    this.threadToSessionMap.delete(threadId);
  }

  private scheduleReconnect(): void {
    if (!this.config.enabled) {
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logUnavailable('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectIntervalMs * Math.min(this.reconnectAttempts, 5);

    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private notifyConnectionChange(connected: boolean): void {
    this.onConnectionChangeCallbacks.forEach(cb => {
      try {
        cb(connected);
      } catch (error) {
        console.error('[SessionBridge] Connection change callback error:', error);
      }
    });
  }

  private log(...args: unknown[]): void {
    if (this.config.enableDebugLogs) {
      console.log('[SessionBridge]', ...args);
    }
  }

  private handleConnectionFailure(reason: string, error?: unknown): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnected = false;
    this.notifyConnectionChange(false);
    useChatStore.getState().setOpenClawConnected(false);
    this.logUnavailable(reason, error);
    this.scheduleReconnect();
  }

  private logUnavailable(reason: string, error?: unknown): void {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();
    if (this.config.enableDebugLogs) {
      console.warn('[SessionBridge]', reason, error);
      return;
    }

    if ((now - this.lastUnavailableLogAt) < this.config.unavailableLogThrottleMs) {
      return;
    }

    console.warn(`[SessionBridge] ${reason}. Session sync unavailable at ${this.config.apiBaseUrl}.`);
    this.lastUnavailableLogAt = now;
  }
}

/**
 * Singleton instance for application-wide use
 */
const sessionBridgeInstance = new SessionSyncClient({
  apiBaseUrl: resolveApiBaseUrl(),
  enableDebugLogs: isSessionBridgeDebugEnabled(),
  enabled: isSessionBridgeEnabled(),
});

// Export as a Proxy to prevent accidental recreation
export const sessionBridge = sessionBridgeInstance;

export default sessionBridge;
