/**
 * allternit Super-Agent OS - Allternit Rails WebSocket Bridge
 * 
 * Real-time WebSocket connection to the Allternit Agent System Rails.
 * Replaces HTTP polling with live updates for:
 * - DAG state changes
 * - Bus messages
 * - Ledger events
 * - Runner status
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface RailsWebSocketConfig {
  /** WebSocket endpoint URL */
  url: string;
  /** Workspace ID */
  workspaceId: string;
  /** Reconnect attempts */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay in ms */
  reconnectDelay?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export type RailsMessageType = 
  | 'dag.update'
  | 'dag.node.update'
  | 'bus.message'
  | 'bus.message.delivered'
  | 'ledger.event'
  | 'runner.status'
  | 'wih.update'
  | 'ping'
  | 'pong'
  | 'error'
  | 'connected'
  | 'disconnected';

export interface RailsMessage {
  type: RailsMessageType;
  timestamp: string;
  payload: unknown;
}

export interface DagUpdatePayload {
  dag_id: string;
  nodes?: Record<string, {
    id: string;
    status: 'NEW' | 'READY' | 'RUNNING' | 'DONE' | 'FAILED';
    [key: string]: unknown;
  }>;
  status?: 'planning' | 'active' | 'paused' | 'completed' | 'failed';
}

export interface BusMessagePayload {
  id: number;
  correlation_id: string;
  to: string;
  from: string;
  kind: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'failed';
  created_at: string;
}

export interface LedgerEventPayload {
  event_id: string;
  ts: string;
  type: string;
  actor: { type: string; id: string };
  scope?: { dag_id?: string; wih_id?: string };
  payload: Record<string, unknown>;
}

export type RailsMessageHandler = (message: RailsMessage) => void;
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// ============================================================================
// WebSocket Bridge Class
// ============================================================================

export class AllternitRailsWebSocketBridge {
  private ws: WebSocket | null = null;
  private config: Required<RailsWebSocketConfig>;
  private messageHandlers: Set<RailsMessageHandler> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private messageQueue: RailsMessage[] = [];
  private lastPingTime = 0;

  constructor(config: RailsWebSocketConfig) {
    this.config = {
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      debug: false,
      ...config,
    };
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[RailsWebSocket]', ...args);
    }
  }

  // -------------------------------------------------------------------------
  // Connection Management
  // -------------------------------------------------------------------------

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log('Already connected');
      return;
    }

    this.connectionState = 'connecting';
    this.log('Connecting to', this.config.url);

    try {
      this.ws = new WebSocket(`${this.config.url}?workspace=${this.config.workspaceId}`);

      this.ws.onopen = () => {
        this.log('Connected');
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.startPingInterval();
        this.flushMessageQueue();
        this.emit({
          type: 'connected',
          timestamp: new Date().toISOString(),
          payload: { workspaceId: this.config.workspaceId },
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: RailsMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          this.log('Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        this.log('Disconnected');
        this.connectionState = 'disconnected';
        this.stopPingInterval();
        this.emit({
          type: 'disconnected',
          timestamp: new Date().toISOString(),
          payload: {},
        });
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        this.log('Error:', error);
        this.connectionState = 'error';
        this.emit({
          type: 'error',
          timestamp: new Date().toISOString(),
          payload: { error: 'WebSocket error' },
        });
      };
    } catch (err) {
      this.log('Failed to create WebSocket:', err);
      this.connectionState = 'error';
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    this.log('Disconnecting');
    this.stopPingInterval();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.ws?.close();
    this.ws = null;
    this.connectionState = 'disconnected';
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // -------------------------------------------------------------------------
  // Ping/Pong
  // -------------------------------------------------------------------------

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        this.send({ type: 'ping', payload: {} });
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // -------------------------------------------------------------------------
  // Message Handling
  // -------------------------------------------------------------------------

  private handleMessage(message: RailsMessage): void {
    this.log('Received:', message.type);

    // Handle pong
    if (message.type === 'pong') {
      const latency = Date.now() - this.lastPingTime;
      this.log('Latency:', latency, 'ms');
      return;
    }

    this.emit(message);
  }

  private emit(message: RailsMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (err) {
        console.error('[RailsWebSocket] Handler error:', err);
      }
    });
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) this.send(message);
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  subscribe(handler: RailsMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  send(message: Omit<RailsMessage, 'timestamp'>): void {
    const fullMessage: RailsMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      this.messageQueue.push(fullMessage);
    }
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  // -------------------------------------------------------------------------
  // Specific Message Types
  // -------------------------------------------------------------------------

  sendBusMessage(to: string, kind: string, payload: Record<string, unknown>): void {
    this.send({
      type: 'bus.message',
      payload: { to, from: 'ui', kind, payload },
    });
  }

  requestDagUpdate(dagId: string): void {
    this.send({
      type: 'dag.update',
      payload: { dag_id: dagId, request: true },
    });
  }

  requestLedgerEvents(since?: string): void {
    this.send({
      type: 'ledger.event',
      payload: { since, request: true },
    });
  }
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseRailsWebSocketOptions {
  url?: string;
  workspaceId: string;
  autoConnect?: boolean;
  debug?: boolean;
  onMessage?: RailsMessageHandler;
}

export interface UseRailsWebSocketReturn {
  bridge: AllternitRailsWebSocketBridge;
  connectionState: ConnectionState;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (message: Omit<RailsMessage, 'timestamp'>) => void;
  dagState: Record<string, DagUpdatePayload>;
  messages: BusMessagePayload[];
  events: LedgerEventPayload[];
}

export function useRailsWebSocket(options: UseRailsWebSocketOptions): UseRailsWebSocketReturn {
  const { 
    url = 'ws://127.0.0.1:3021/ws', 
    workspaceId, 
    autoConnect = true,
    debug = false,
    onMessage 
  } = options;

  const bridgeRef = useRef(new AllternitRailsWebSocketBridge({ 
    url, 
    workspaceId, 
    debug 
  }));
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [dagState, setDagState] = useState<Record<string, DagUpdatePayload>>({});
  const [messages, setMessages] = useState<BusMessagePayload[]>([]);
  const [events, setEvents] = useState<LedgerEventPayload[]>([]);

  // Subscribe to messages
  useEffect(() => {
    const unsubscribe = bridgeRef.current.subscribe((msg) => {
      // Update connection state
      if (msg.type === 'connected') {
        setConnectionState('connected');
      } else if (msg.type === 'disconnected') {
        setConnectionState('disconnected');
      } else if (msg.type === 'error') {
        setConnectionState('error');
      }

      // Update data based on message type
      switch (msg.type) {
        case 'dag.update':
        case 'dag.node.update':
          setDagState(prev => ({
            ...prev,
            [(msg.payload as DagUpdatePayload).dag_id]: msg.payload as DagUpdatePayload,
          }));
          break;
        
        case 'bus.message':
          setMessages(prev => [...prev, msg.payload as BusMessagePayload]);
          break;
        
        case 'ledger.event':
          setEvents(prev => [...prev, msg.payload as LedgerEventPayload]);
          break;
      }

      // Call custom handler
      onMessage?.(msg);
    });

    return unsubscribe;
  }, [onMessage]);

  // Auto-connect
  useEffect(() => {
    if (autoConnect) {
      bridgeRef.current.connect();
    }
    return () => bridgeRef.current.disconnect();
  }, [autoConnect, url, workspaceId]);

  const connect = useCallback(() => bridgeRef.current.connect(), []);
  const disconnect = useCallback(() => bridgeRef.current.disconnect(), []);
  const send = useCallback((message: Omit<RailsMessage, 'timestamp'>) => {
    bridgeRef.current.send(message);
  }, []);

  return {
    bridge: bridgeRef.current,
    connectionState,
    isConnected: connectionState === 'connected',
    connect,
    disconnect,
    send,
    dagState,
    messages,
    events,
  };
}

// ============================================================================
// Singleton Export
// ============================================================================

export const railsWebSocketBridge = new AllternitRailsWebSocketBridge({
  url: 'ws://127.0.0.1:3021/ws',
  workspaceId: 'default',
});

export default AllternitRailsWebSocketBridge;
