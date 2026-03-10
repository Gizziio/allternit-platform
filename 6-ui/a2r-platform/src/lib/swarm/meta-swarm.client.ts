/**
 * Meta-Swarm Client
 * 
 * JavaScript/TypeScript client for the Meta-Swarm system.
 * Provides API for submitting tasks, monitoring progress, and receiving events.
 * 
 * Usage:
 * ```typescript
 * const client = new MetaSwarmClient({ wsUrl: 'ws://localhost:8010/swarm' });
 * const handle = await client.submitTask('Implement feature X', { mode: 'closed_loop' });
 * client.onProgress = (update) => console.log(update.progress);
 * ```
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type SwarmMode = 'swarm_agentic' | 'claude_swarm' | 'closed_loop' | 'hybrid' | 'auto';

export type TaskStatus = 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type ExecutionPhase = 
  | 'brainstorm'
  | 'plan'
  | 'work'
  | 'review'
  | 'compound'
  | 'split'
  | 'execute'
  | 'merge'
  | 'evolve'
  | 'evaluate';

export interface TaskConfig {
  mode?: SwarmMode;
  budget?: number;
  maxAgents?: number;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface TaskHandle {
  taskId: string;
  sessionId: string;
  mode: SwarmMode;
  status: TaskStatus;
  createdAt: Date;
}

export interface AgentStatus {
  id: string;
  name: string;
  state: 'idle' | 'working' | 'waiting' | 'error' | 'completed';
  currentTask?: string;
  progress: number;
  filesTouched: string[];
  tokensUsed: number;
  errors: number;
}

export interface ProgressUpdate {
  taskId: string;
  phase: ExecutionPhase;
  progress: number; // 0-1
  message: string;
  agents: AgentStatus[];
  costs: CostSummary;
  timestamp: Date;
}

export interface CostSummary {
  budget: number;
  spent: number;
  projected: number;
  tokensIn: number;
  tokensOut: number;
  apiCalls: number;
}

export interface FileConflict {
  path: string;
  lockedBy: string;
  lockedAt: Date;
  waitingAgents: string[];
}

export interface KnowledgePattern {
  id: string;
  name: string;
  patternType: 'anti_pattern' | 'root_cause' | 'optimization' | 'security' | 'architecture';
  domain: string;
  description: string;
  effectiveness: {
    usageCount: number;
    successRate: number;
    avgCostSavings: number;
  };
}

export interface DashboardState {
  activeTasks: TaskHandle[];
  agents: AgentStatus[];
  costs: CostSummary;
  conflicts: FileConflict[];
  patterns: KnowledgePattern[];
  systemHealth: 'healthy' | 'degraded' | 'critical';
}

// ============================================================================
// MetaSwarm Client
// ============================================================================

export interface MetaSwarmClientConfig {
  apiUrl?: string;
  wsUrl?: string;
  apiKey?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export class MetaSwarmClient extends EventEmitter {
  private config: Required<MetaSwarmClientConfig>;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private taskCache = new Map<string, TaskHandle>();
  private isConnected = false;

  constructor(config: MetaSwarmClientConfig = {}) {
    super();
    this.config = {
      apiUrl: config.apiUrl || '/api/v1/swarm',
      wsUrl: config.wsUrl || 'ws://localhost:8010/swarm/events',
      apiKey: config.apiKey || '',
      autoReconnect: config.autoReconnect ?? true,
      reconnectInterval: config.reconnectInterval || 5000,
    };
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.error('[MetaSwarm] Failed to parse message:', err);
          }
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.emit('disconnected');
          
          if (this.config.autoReconnect) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        // Reconnection failed, will retry
      });
    }, this.config.reconnectInterval);
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== 'object' || data === null) return;

    const msg = data as Record<string, unknown>;
    const type = msg.type as string;

    switch (type) {
      case 'progress':
        this.emit('progress', this.parseProgressUpdate(msg));
        break;
      case 'agent_status':
        this.emit('agentStatus', msg.agents);
        break;
      case 'cost_update':
        this.emit('costUpdate', msg.costs);
        break;
      case 'conflict':
        this.emit('conflict', msg.conflict);
        break;
      case 'knowledge_update':
        this.emit('knowledgeUpdate', msg.patterns);
        break;
      case 'task_complete':
        this.emit('taskComplete', {
          taskId: msg.taskId,
          result: msg.result,
          costs: msg.costs,
        });
        break;
      case 'task_failed':
        this.emit('taskFailed', {
          taskId: msg.taskId,
          error: msg.error,
        });
        break;
      default:
        this.emit('message', data);
    }
  }

  private parseProgressUpdate(msg: Record<string, unknown>): ProgressUpdate {
    return {
      taskId: msg.taskId as string,
      phase: msg.phase as ExecutionPhase,
      progress: msg.progress as number,
      message: msg.message as string,
      agents: (msg.agents as AgentStatus[]) || [],
      costs: msg.costs as CostSummary,
      timestamp: new Date(msg.timestamp as string),
    };
  }

  // ============================================================================
  // Task Submission
  // ============================================================================

  async submitTask(description: string, config: TaskConfig = {}): Promise<TaskHandle> {
    const response = await fetch(`${this.config.apiUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify({
        description,
        mode: config.mode || 'auto',
        budget: config.budget,
        max_agents: config.maxAgents,
        timeout: config.timeout,
        priority: config.priority || 'normal',
        metadata: config.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to submit task: ${error}`);
    }

    const data = await response.json();
    const handle: TaskHandle = {
      taskId: data.task_id,
      sessionId: data.session_id,
      mode: data.mode,
      status: data.status,
      createdAt: new Date(data.created_at),
    };

    this.taskCache.set(handle.taskId, handle);
    this.emit('taskSubmitted', handle);

    return handle;
  }

  async submitWithSwarmAgentic(description: string, config: Omit<TaskConfig, 'mode'> = {}): Promise<TaskHandle> {
    return this.submitTask(description, { ...config, mode: 'swarm_agentic' });
  }

  async submitWithClaudeSwarm(description: string, config: Omit<TaskConfig, 'mode'> = {}): Promise<TaskHandle> {
    return this.submitTask(description, { ...config, mode: 'claude_swarm' });
  }

  async submitWithClosedLoop(description: string, config: Omit<TaskConfig, 'mode'> = {}): Promise<TaskHandle> {
    return this.submitTask(description, { ...config, mode: 'closed_loop' });
  }

  // ============================================================================
  // Task Management
  // ============================================================================

  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}/status`, {
      headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to get task status: ${response.statusText}`);
    }

    const data = await response.json();
    return data.status;
  }

  async cancelTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}/cancel`, {
      method: 'POST',
      headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel task: ${response.statusText}`);
    }

    this.emit('taskCancelled', { taskId });
  }

  async getTaskResult(taskId: string): Promise<unknown> {
    const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}/result`, {
      headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to get task result: ${response.statusText}`);
    }

    return response.json();
  }

  // ============================================================================
  // Dashboard
  // ============================================================================

  async getDashboardState(): Promise<DashboardState> {
    const response = await fetch(`${this.config.apiUrl}/dashboard`, {
      headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to get dashboard state: ${response.statusText}`);
    }

    return response.json();
  }

  async getActiveTasks(): Promise<TaskHandle[]> {
    const response = await fetch(`${this.config.apiUrl}/tasks/active`, {
      headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to get active tasks: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tasks.map((t: Record<string, unknown>) => ({
      taskId: t.task_id,
      sessionId: t.session_id,
      mode: t.mode,
      status: t.status,
      createdAt: new Date(t.created_at as string),
    }));
  }

  // ============================================================================
  // Knowledge Base
  // ============================================================================

  async queryKnowledge(query: string, limit = 10): Promise<KnowledgePattern[]> {
    const response = await fetch(
      `${this.config.apiUrl}/knowledge?query=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to query knowledge: ${response.statusText}`);
    }

    return response.json();
  }

  async getPatternsByDomain(domain: string): Promise<KnowledgePattern[]> {
    const response = await fetch(
      `${this.config.apiUrl}/knowledge/domain/${encodeURIComponent(domain)}`,
      {
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get patterns: ${response.statusText}`);
    }

    return response.json();
  }

  // ============================================================================
  // File Conflicts
  // ============================================================================

  async getFileConflicts(): Promise<FileConflict[]> {
    const response = await fetch(`${this.config.apiUrl}/conflicts`, {
      headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to get conflicts: ${response.statusText}`);
    }

    return response.json();
  }

  async releaseFileLock(filePath: string): Promise<void> {
    const response = await fetch(`${this.config.apiUrl}/conflicts/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify({ path: filePath }),
    });

    if (!response.ok) {
      throw new Error(`Failed to release lock: ${response.statusText}`);
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  get isConnectedToServer(): boolean {
    return this.isConnected;
  }

  get cachedTasks(): TaskHandle[] {
    return Array.from(this.taskCache.values());
  }
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseMetaSwarmOptions {
  autoConnect?: boolean;
  onProgress?: (update: ProgressUpdate) => void;
  onTaskComplete?: (taskId: string, result: unknown) => void;
  onTaskFailed?: (taskId: string, error: string) => void;
}

export function useMetaSwarm(config: MetaSwarmClientConfig = {}, options: UseMetaSwarmOptions = {}) {
  const clientRef = useRef<MetaSwarmClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTasks, setActiveTasks] = useState<TaskHandle[]>([]);
  const [dashboardState, setDashboardState] = useState<DashboardState | null>(null);

  // Initialize client
  useEffect(() => {
    const client = new MetaSwarmClient(config);
    clientRef.current = client;

    // Set up event handlers
    client.on('connected', () => setIsConnected(true));
    client.on('disconnected', () => setIsConnected(false));
    
    client.on('progress', (update: ProgressUpdate) => {
      options.onProgress?.(update);
    });

    client.on('taskComplete', ({ taskId, result }: { taskId: string; result: unknown }) => {
      setActiveTasks(prev => prev.filter(t => t.taskId !== taskId));
      options.onTaskComplete?.(taskId, result);
    });

    client.on('taskFailed', ({ taskId, error }: { taskId: string; error: string }) => {
      setActiveTasks(prev => prev.filter(t => t.taskId !== taskId));
      options.onTaskFailed?.(taskId, error);
    });

    client.on('taskSubmitted', (handle: TaskHandle) => {
      setActiveTasks(prev => [...prev, handle]);
    });

    // Auto-connect if requested
    if (options.autoConnect) {
      client.connect().catch(console.error);
    }

    return () => {
      client.disconnect();
    };
  }, []);

  // Actions
  const submitTask = useCallback(async (description: string, taskConfig: TaskConfig = {}) => {
    if (!clientRef.current) throw new Error('Client not initialized');
    return clientRef.current.submitTask(description, taskConfig);
  }, []);

  const cancelTask = useCallback(async (taskId: string) => {
    if (!clientRef.current) throw new Error('Client not initialized');
    return clientRef.current.cancelTask(taskId);
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!clientRef.current) return;
    const state = await clientRef.current.getDashboardState();
    setDashboardState(state);
  }, []);

  const connect = useCallback(async () => {
    if (!clientRef.current) throw new Error('Client not initialized');
    return clientRef.current.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  return {
    isConnected,
    activeTasks,
    dashboardState,
    submitTask,
    cancelTask,
    refreshDashboard,
    connect,
    disconnect,
    client: clientRef.current,
  };
}

export default MetaSwarmClient;
