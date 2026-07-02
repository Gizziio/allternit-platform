/**
 * allternit Super-Agent OS - Allternit Rails Bridge Types
 */

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
