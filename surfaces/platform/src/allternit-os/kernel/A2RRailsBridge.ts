/**
 * A2rchitect Super-Agent OS - A2R Rails Bridge
 * 
 * Bridge between the UI and the A2R Agent System Rails (Rust backend).
 * Connects to the workspace service at port 3021.
 * 
 * This integrates with existing:
 * - A2R Rails Bus system (SQLite queue at .a2r/bus/queue.db)
 * - A2R Rails Work/DAG system (.a2r/work/dags/)
 * - A2R Rails Ledger (.a2r/ledger/events/)
 * - A2R Rails Gate (policy enforcement)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types (matching Rust A2R Rails system)
// ============================================================================

export interface DagState {
  dag_id: string;
  nodes: Record<string, DagNode>;
  edges: DagEdge[];
  status: 'planning' | 'active' | 'paused' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface DagNode {
  id: string;
  name: string;
  description: string;
  status: 'NEW' | 'READY' | 'RUNNING' | 'DONE' | 'FAILED';
  execution_mode: 'fresh' | 'shared';
  blocked_by: string[];
  related_to: string[];
  context_pack_path?: string;
}

export interface DagEdge {
  from_node_id: string;
  to_node_id: string;
  edge_type: 'blocked_by' | 'related_to';
}

export interface WihState {
  wih_id: string;
  dag_id: string;
  node_id: string;
  status: 'open' | 'picked_up' | 'closed' | 'archived';
  owner?: string;
  terminal_context?: TerminalContext;
  created_at: string;
  updated_at: string;
}

export interface TerminalContext {
  session_id: string;
  pane_id: string;
  log_stream_endpoint: string;
  worktree_path?: string;
}

export interface BusMessage {
  id: number;
  correlation_id: string;
  to: string;
  from: string;
  kind: string;
  payload: Record<string, unknown>;
  transport: 'tmux' | 'socket' | 'internal';
  status: 'pending' | 'delivered' | 'failed';
  created_at: string;
}

export interface LedgerEvent {
  event_id: string;
  ts: string;
  actor: {
    type: 'Gate' | 'Runner' | 'Bus' | 'Agent' | 'User';
    id: string;
  };
  scope?: {
    dag_id?: string;
    wih_id?: string;
  };
  type: string;
  payload: Record<string, unknown>;
  provenance?: {
    prompt_id?: string;
    delta_id?: string;
  };
}

export interface RailsRunnerState {
  processed: string[];
  cursor: number;
  loop_progress: Record<string, LoopProgress>;
}

export interface LoopProgress {
  wih_id: string;
  current_iteration: number;
  spawn_requests: number;
  escalation_state?: string;
}

// ============================================================================
// A2R Rails HTTP Client
// ============================================================================

export interface A2RRailsClientOptions {
  baseUrl?: string;
  workspaceId: string;
  onError?: (error: Error) => void;
}

export class A2RRailsClient {
  private baseUrl: string;
  private workspaceId: string;
  private onError?: (error: Error) => void;

  constructor(options: A2RRailsClientOptions) {
    this.baseUrl = options.baseUrl || 'http://127.0.0.1:3021';
    this.workspaceId = options.workspaceId;
    this.onError = options.onError;
  }

  // -------------------------------------------------------------------------
  // Sessions (tmux integration)
  // -------------------------------------------------------------------------

  async createTerminalSession(name: string, metadata?: Record<string, unknown>): Promise<{
    id: string;
    name: string;
    status: string;
  }> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        working_dir: process.cwd(),
        env: {},
        metadata: {
          workspace_id: this.workspaceId,
          ...metadata,
        },
      }),
    });

    if (!response.ok) {
      const error = new Error(`Failed to create session: ${response.statusText}`);
      this.onError?.(error);
      throw error;
    }

    return response.json();
  }

  async getSession(sessionId: string): Promise<{
    id: string;
    name: string;
    status: string;
    windows: number;
    panes: number;
  }> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`);
    
    if (!response.ok) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return response.json();
  }

  async createPane(
    sessionId: string,
    name: string,
    command?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ id: string; session_id: string; title: string }> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/panes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        command,
        metadata: {
          workspace_id: this.workspaceId,
          ...metadata,
        },
      }),
    });

    if (!response.ok) {
      const error = new Error(`Failed to create pane: ${response.statusText}`);
      this.onError?.(error);
      throw error;
    }

    return response.json();
  }

  async killPane(paneId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/panes/${paneId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to kill pane: ${response.statusText}`);
    }
  }

  async capturePane(paneId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/panes/${paneId}/capture`);
    
    if (!response.ok) {
      throw new Error(`Failed to capture pane output`);
    }

    const result = await response.json();
    return result.output || '';
  }

  async sendKeysToPane(paneId: string, keys: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/panes/${paneId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send keys to pane`);
    }
  }

  // -------------------------------------------------------------------------
 // DAG / Work Surface
  // -------------------------------------------------------------------------

  async listDags(): Promise<DagState[]> {
    // This would be an API endpoint on the Rails service
    const response = await fetch(`${this.baseUrl}/workspace/${this.workspaceId}/dags`);
    
    if (!response.ok) {
      // Fallback: return empty array if endpoint doesn't exist yet
      return [];
    }

    return response.json();
  }

  async getDag(dagId: string): Promise<DagState | null> {
    const response = await fetch(`${this.baseUrl}/workspace/${this.workspaceId}/dags/${dagId}`);
    
    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  // -------------------------------------------------------------------------
  // Bus Messages
  // -------------------------------------------------------------------------

  async sendBusMessage(message: Omit<BusMessage, 'id' | 'status' | 'created_at'>): Promise<number> {
    const response = await fetch(`${this.baseUrl}/workspace/${this.workspaceId}/bus/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Failed to send bus message: ${response.statusText}`);
    }

    const result = await response.json();
    return result.message_id;
  }

  async pollPendingMessages(recipient?: string, limit = 10): Promise<BusMessage[]> {
    const params = new URLSearchParams();
    if (recipient) params.append('recipient', recipient);
    params.append('limit', limit.toString());

    const response = await fetch(
      `${this.baseUrl}/workspace/${this.workspaceId}/bus/poll?${params}`
    );

    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  // -------------------------------------------------------------------------
  // Ledger
  // -------------------------------------------------------------------------

  async getLedgerEvents(since?: string): Promise<LedgerEvent[]> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);

    const response = await fetch(
      `${this.baseUrl}/workspace/${this.workspaceId}/ledger?${params}`
    );

    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseA2RRailsOptions {
  workspaceId: string;
  baseUrl?: string;
  autoPoll?: boolean;
  pollInterval?: number;
  onError?: (error: Error) => void;
}

export interface UseA2RRailsReturn {
  client: A2RRailsClient;
  isConnected: boolean;
  dags: DagState[];
  messages: BusMessage[];
  events: LedgerEvent[];
  refresh: () => Promise<void>;
  sendMessage: (message: Omit<BusMessage, 'id' | 'status' | 'created_at'>) => Promise<number>;
  createSession: (name: string) => Promise<{ id: string; name: string }>;
  createPane: (sessionId: string, name: string, command?: string) => Promise<{ id: string }>;
}

export function useA2RRails(options: UseA2RRailsOptions): UseA2RRailsReturn {
  const { workspaceId, baseUrl, autoPoll = true, pollInterval = 5000, onError } = options;
  
  const clientRef = useRef(new A2RRailsClient({ workspaceId, baseUrl, onError }));
  const [isConnected, setIsConnected] = useState(false);
  const [dags, setDags] = useState<DagState[]>([]);
  const [messages, setMessages] = useState<BusMessage[]>([]);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Health check
  const checkHealth = useCallback(async () => {
    const healthy = await clientRef.current.healthCheck();
    setIsConnected(healthy);
    return healthy;
  }, []);

  // Refresh all data
  const refresh = useCallback(async () => {
    const healthy = await checkHealth();
    if (!healthy) return;

    try {
      const [dagsData, messagesData, eventsData] = await Promise.all([
        clientRef.current.listDags(),
        clientRef.current.pollPendingMessages(),
        clientRef.current.getLedgerEvents(),
      ]);

      setDags(dagsData);
      setMessages(messagesData);
      setEvents(eventsData);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [checkHealth, onError]);

  // Send message wrapper
  const sendMessage = useCallback(async (
    message: Omit<BusMessage, 'id' | 'status' | 'created_at'>
  ): Promise<number> => {
    const id = await clientRef.current.sendBusMessage(message);
    await refresh();
    return id;
  }, [refresh]);

  // Create session wrapper
  const createSession = useCallback(async (name: string) => {
    const session = await clientRef.current.createTerminalSession(name);
    await refresh();
    return session;
  }, [refresh]);

  // Create pane wrapper
  const createPane = useCallback(async (sessionId: string, name: string, command?: string) => {
    const pane = await clientRef.current.createPane(sessionId, name, command);
    await refresh();
    return pane;
  }, [refresh]);

  // Initial connection check
  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Auto-poll
  useEffect(() => {
    if (autoPoll && isConnected) {
      refresh();
      pollTimerRef.current = setInterval(refresh, pollInterval);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [autoPoll, isConnected, pollInterval, refresh]);

  return {
    client: clientRef.current,
    isConnected,
    dags,
    messages,
    events,
    refresh,
    sendMessage,
    createSession,
    createPane,
  };
}

export default useA2RRails;
