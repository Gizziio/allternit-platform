/**
 * Meta-Swarm API Client
 * 
 * WebSocket and HTTP client for connecting to the Rust backend
 */

import type {
  Task,
  Agent,
  Session,
  ProgressUpdate,
  RoutingDecision,
  Pattern,
  FileLock,
  TriageResult,
  QualityCheck,
  BudgetInfo,
  SwarmMode,
} from './types';

const API_BASE = import.meta.env.VITE_META_SWARM_API_URL || 'ws://localhost:8080';
const HTTP_BASE = import.meta.env.VITE_META_SWARM_HTTP_URL || 'http://localhost:8080';

export class MetaSwarmClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(`${API_BASE}/ws`);
      
      this.ws.onopen = () => {
        console.log('Meta-Swarm WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onclose = () => {
        console.log('Meta-Swarm WebSocket closed');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Meta-Swarm WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to Meta-Swarm:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private handleMessage(message: any) {
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach(handler => handler(message.data));
  }

  onProgressUpdate(handler: (update: ProgressUpdate) => void) {
    this.addHandler('progress', handler);
  }

  onAgentStatusUpdate(handler: (agents: Agent[]) => void) {
    this.addHandler('agent_status', handler);
  }

  onFileLocksUpdate(handler: (locks: FileLock[]) => void) {
    this.addHandler('file_locks', handler);
  }

  private addHandler(type: string, handler: (data: any) => void) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  removeHandler(type: string, handler: (data: any) => void) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // HTTP API methods
  async submitTask(description: string): Promise<Task> {
    const response = await fetch(`${HTTP_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to submit task: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getTasks(): Promise<Task[]> {
    const response = await fetch(`${HTTP_BASE}/tasks`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.statusText}`);
    }
    return response.json();
  }

  async getTaskStatus(taskId: string): Promise<Task> {
    const response = await fetch(`${HTTP_BASE}/tasks/${taskId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch task: ${response.statusText}`);
    }
    return response.json();
  }

  async getAgents(): Promise<Agent[]> {
    const response = await fetch(`${HTTP_BASE}/agents`);
    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }
    return response.json();
  }

  async getSessions(): Promise<Session[]> {
    const response = await fetch(`${HTTP_BASE}/sessions`);
    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`);
    }
    return response.json();
  }

  async getPatterns(): Promise<Pattern[]> {
    const response = await fetch(`${HTTP_BASE}/knowledge/patterns`);
    if (!response.ok) {
      throw new Error(`Failed to fetch patterns: ${response.statusText}`);
    }
    return response.json();
  }

  async queryPatterns(query: string): Promise<Pattern[]> {
    const response = await fetch(`${HTTP_BASE}/knowledge/patterns/query?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Failed to query patterns: ${response.statusText}`);
    }
    return response.json();
  }

  async getFileLocks(): Promise<FileLock[]> {
    const response = await fetch(`${HTTP_BASE}/file-locks`);
    if (!response.ok) {
      throw new Error(`Failed to fetch file locks: ${response.statusText}`);
    }
    return response.json();
  }

  async getBudgetInfo(): Promise<BudgetInfo> {
    const response = await fetch(`${HTTP_BASE}/budget`);
    if (!response.ok) {
      throw new Error(`Failed to fetch budget: ${response.statusText}`);
    }
    return response.json();
  }

  async cancelTask(taskId: string): Promise<void> {
    const response = await fetch(`${HTTP_BASE}/tasks/${taskId}/cancel`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to cancel task: ${response.statusText}`);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton instance
export const metaSwarmClient = new MetaSwarmClient();
