/**
 * allternit Super-Agent OS - Workspace Service
 * 
 * Integration with the Allternit Rails workspace service (port 3021):
 * - DAG state management
 * - Bus message queue
 * - Ledger event tracking
 * - WIH (Work in Hand) coordination
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceConfig {
  baseUrl: string;
  workspaceId: string;
  apiVersion?: string;
}

// DAG Types
export interface DagNode {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  dependencies: string[];
  outputs?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  executionTime?: number;
}

export interface DagState {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  nodes: DagNode[];
  edges: { from: string; to: string }[];
  progress: number;
  createdAt: string;
  updatedAt: string;
}

// Bus Message Types
export interface BusMessage {
  id: string;
  type: string;
  payload: unknown;
  sender: string;
  recipient?: string;
  timestamp: string;
  delivered: boolean;
  deliveredAt?: string;
}

// Ledger Event Types
export interface LedgerEvent {
  id: string;
  type: 'task.created' | 'task.updated' | 'task.completed' | 'agent.action' | 'system.event';
  entityId: string;
  entityType: string;
  action: string;
  data: unknown;
  timestamp: string;
  agentId?: string;
}

// WIH (Work in Hand) Types
export interface WihWorkItem {
  id: string;
  type: string;
  status: 'queued' | 'active' | 'completed' | 'failed';
  priority: number;
  data: unknown;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  assignedTo?: string;
}

// ============================================================================
// Workspace Service Client
// ============================================================================

class WorkspaceService {
  private config: WorkspaceConfig;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private isConnected = false;

  constructor(config: WorkspaceConfig) {
    this.config = {
      apiVersion: 'v1',
      ...config,
    };
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const wsUrl = this.config.baseUrl.replace(/^http/, 'ws') + '/ws';
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('[WorkspaceService] Connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Subscribe to workspace
      this.send({
        type: 'subscribe',
        workspaceId: this.config.workspaceId,
      });
      
      this.emit('connection', { status: 'connected' });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[WorkspaceService] Failed to parse message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('[WorkspaceService] Disconnected');
      this.isConnected = false;
      this.emit('connection', { status: 'disconnected' });
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[WorkspaceService] WebSocket error:', error);
      this.emit('connection', { status: 'error', error });
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WorkspaceService] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[WorkspaceService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => this.connect(), delay);
  }

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  private handleMessage(message: { type: string; payload: unknown }): void {
    switch (message.type) {
      case 'dag.update':
        this.emit('dag', message.payload);
        break;
      case 'dag.node.update':
        this.emit('dag.node', message.payload);
        break;
      case 'bus.message':
        this.emit('bus.message', message.payload);
        break;
      case 'bus.message.delivered':
        this.emit('bus.delivered', message.payload);
        break;
      case 'ledger.event':
        this.emit('ledger', message.payload);
        break;
      case 'wih.update':
        this.emit('wih', message.payload);
        break;
      case 'pong':
        // Heartbeat response
        break;
      default:
        this.emit(message.type, message.payload);
    }
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[WorkspaceService] Error in ${event} listener:`, error);
      }
    });
  }

  // ============================================================================
  // DAG Operations
  // ============================================================================

  async getDags(): Promise<DagState[]> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/dags`
    );
    if (!response.ok) throw new Error('Failed to fetch DAGs');
    return response.json();
  }

  async getDag(dagId: string): Promise<DagState> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/dags/${dagId}`
    );
    if (!response.ok) throw new Error('Failed to fetch DAG');
    return response.json();
  }

  async createDag(name: string, nodes: Omit<DagNode, 'id'>[]): Promise<DagState> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/dags`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nodes }),
      }
    );
    if (!response.ok) throw new Error('Failed to create DAG');
    return response.json();
  }

  async updateDagNode(dagId: string, nodeId: string, updates: Partial<DagNode>): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/dags/${dagId}/nodes/${nodeId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }
    );
    if (!response.ok) throw new Error('Failed to update DAG node');
  }

  async runDag(dagId: string): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/dags/${dagId}/run`,
      { method: 'POST' }
    );
    if (!response.ok) throw new Error('Failed to run DAG');
  }

  async pauseDag(dagId: string): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/dags/${dagId}/pause`,
      { method: 'POST' }
    );
    if (!response.ok) throw new Error('Failed to pause DAG');
  }

  async cancelDag(dagId: string): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/dags/${dagId}/cancel`,
      { method: 'POST' }
    );
    if (!response.ok) throw new Error('Failed to cancel DAG');
  }

  // ============================================================================
  // Bus Operations
  // ============================================================================

  async sendBusMessage(message: Omit<BusMessage, 'id' | 'timestamp' | 'delivered'>): Promise<BusMessage> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/bus`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      }
    );
    if (!response.ok) throw new Error('Failed to send bus message');
    return response.json();
  }

  async getBusMessages(limit = 100): Promise<BusMessage[]> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/bus?limit=${limit}`
    );
    if (!response.ok) throw new Error('Failed to fetch bus messages');
    return response.json();
  }

  subscribeToBusMessageType(messageType: string): void {
    this.send({
      type: 'subscribe.bus',
      messageType,
    });
  }

  // ============================================================================
  // Ledger Operations
  // ============================================================================

  async getLedgerEvents(limit = 100, offset = 0): Promise<LedgerEvent[]> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/ledger?limit=${limit}&offset=${offset}`
    );
    if (!response.ok) throw new Error('Failed to fetch ledger events');
    return response.json();
  }

  async appendLedgerEvent(event: Omit<LedgerEvent, 'id' | 'timestamp'>): Promise<LedgerEvent> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/ledger`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }
    );
    if (!response.ok) throw new Error('Failed to append ledger event');
    return response.json();
  }

  // ============================================================================
  // WIH Operations
  // ============================================================================

  async getWihQueue(): Promise<WihWorkItem[]> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/wih`
    );
    if (!response.ok) throw new Error('Failed to fetch WIH queue');
    return response.json();
  }

  async submitWihWork(type: string, data: unknown, priority = 0): Promise<WihWorkItem> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/workspaces/${this.config.workspaceId}/wih`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data, priority }),
      }
    );
    if (!response.ok) throw new Error('Failed to submit WIH work');
    return response.json();
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(
      `${this.config.baseUrl}/api/${this.config.apiVersion}/health`
    );
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get isConnectedState(): boolean {
    return this.isConnected;
  }
}

// ============================================================================
// React Hook
// ============================================================================

export function useWorkspaceService(config: WorkspaceConfig) {
  const serviceRef = useRef<WorkspaceService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [dags, setDags] = useState<DagState[]>([]);
  const [messages, setMessages] = useState<BusMessage[]>([]);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [wihQueue, setWihQueue] = useState<WihWorkItem[]>([]);

  useEffect(() => {
    serviceRef.current = new WorkspaceService(config);
    
    const unsubscribeConnection = serviceRef.current.on('connection', (data) => {
      setIsConnected((data as { status: string }).status === 'connected');
    });

    const unsubscribeDag = serviceRef.current.on('dag', (data) => {
      setDags(prev => {
        const updated = data as DagState;
        const index = prev.findIndex(d => d.id === updated.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = updated;
          return next;
        }
        return [...prev, updated];
      });
    });

    const unsubscribeBus = serviceRef.current.on('bus.message', (data) => {
      setMessages(prev => [data as BusMessage, ...prev].slice(0, 100));
    });

    const unsubscribeLedger = serviceRef.current.on('ledger', (data) => {
      setEvents(prev => [data as LedgerEvent, ...prev].slice(0, 100));
    });

    const unsubscribeWih = serviceRef.current.on('wih', (data) => {
      setWihQueue(data as WihWorkItem[]);
    });

    serviceRef.current.connect();

    // Load initial data
    serviceRef.current.getDags().then(setDags).catch(console.error);
    serviceRef.current.getBusMessages().then(setMessages).catch(console.error);
    serviceRef.current.getLedgerEvents().then(setEvents).catch(console.error);
    serviceRef.current.getWihQueue().then(setWihQueue).catch(console.error);

    return () => {
      unsubscribeConnection();
      unsubscribeDag();
      unsubscribeBus();
      unsubscribeLedger();
      unsubscribeWih();
      serviceRef.current?.disconnect();
    };
  }, [config.baseUrl, config.workspaceId]);

  const createDag = useCallback(async (name: string, nodes: Omit<DagNode, 'id'>[]) => {
    return serviceRef.current?.createDag(name, nodes);
  }, []);

  const runDag = useCallback(async (dagId: string) => {
    return serviceRef.current?.runDag(dagId);
  }, []);

  const sendMessage = useCallback(async (message: Omit<BusMessage, 'id' | 'timestamp' | 'delivered'>) => {
    return serviceRef.current?.sendBusMessage(message);
  }, []);

  const submitWork = useCallback(async (type: string, data: unknown, priority?: number) => {
    return serviceRef.current?.submitWihWork(type, data, priority);
  }, []);

  return {
    isConnected,
    dags,
    messages,
    events,
    wihQueue,
    createDag,
    runDag,
    sendMessage,
    submitWork,
    service: serviceRef.current,
  };
}

// ============================================================================
// Singleton Instance (for global access)
// ============================================================================

let globalWorkspaceService: WorkspaceService | null = null;

export function initWorkspaceService(config: WorkspaceConfig): WorkspaceService {
  if (!globalWorkspaceService) {
    globalWorkspaceService = new WorkspaceService(config);
  }
  return globalWorkspaceService;
}

export function getWorkspaceService(): WorkspaceService | null {
  return globalWorkspaceService;
}

export { WorkspaceService };
export default WorkspaceService;
