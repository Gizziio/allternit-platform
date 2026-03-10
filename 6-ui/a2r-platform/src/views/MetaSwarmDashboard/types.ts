/**
 * Meta-Swarm Dashboard Types
 * 
 * TypeScript interfaces matching the Rust backend types
 */

export type SwarmMode = 'swarm_agentic' | 'claude_swarm' | 'closed_loop' | 'hybrid';
export type Status = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type AgentStatus = 'idle' | 'working' | 'waiting' | 'completed' | 'failed';
export type Priority = 'P1' | 'P2' | 'P3';

export interface EntityId {
  id: string;
}

export interface Cost {
  input_tokens: number;
  output_tokens: number;
  estimated_usd: number;
}

export interface Progress {
  total: number;
  completed: number;
  failed: number;
  in_progress: number;
}

export interface Task {
  id: EntityId;
  description: string;
  objective: string;
  status: Status;
  progress: Progress;
  cost: Cost;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: EntityId;
  role: AgentRole;
  status: AgentStatus;
  capabilities: string[];
  current_task?: EntityId;
  stats: AgentStats;
}

export interface AgentRole {
  name: string;
  description: string;
  model: string;
}

export interface AgentStats {
  tasks_completed: number;
  tasks_failed: number;
  total_cost: Cost;
  success_rate: number;
}

export interface AgentTeam {
  id: EntityId;
  name: string;
  agents: EntityId[];
  topology: 'sequential' | 'parallel' | 'hub_and_spoke';
}

export interface ExecutionResult {
  task_id: EntityId;
  status: Status;
  output: {
    type: 'success' | 'failure' | 'partial';
    content: string;
  };
  cost: Cost;
  duration_secs: number;
  timestamp: string;
}

export interface ProgressUpdate {
  timestamp: string;
  task_id: EntityId;
  session_id: EntityId;
  update_type: ProgressUpdateType;
  progress: Progress;
  cost: Cost;
  message: string;
}

export type ProgressUpdateType = 
  | 'started'
  | 'mode_selected'
  | 'phase_started'
  | 'phase_completed'
  | 'agent_started'
  | 'agent_completed'
  | 'agent_failed'
  | 'progress_update'
  | 'quality_gate'
  | 'review_complete'
  | 'knowledge_stored'
  | 'completed'
  | 'failed';

export interface RoutingDecision {
  mode: SwarmMode;
  confidence: number;
  reasoning: string;
  alternatives: Array<{ mode: SwarmMode; score: number }>;
}

export interface Session {
  id: EntityId;
  task_id: EntityId;
  status: Status;
  mode?: SwarmMode;
  current_phase?: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Pattern {
  id: EntityId;
  name: string;
  description: string;
  pattern_type: 'architecture' | 'collaboration' | 'fix' | 'prevention' | 'root_cause' | 'process';
  domain: string;
  effectiveness: {
    usage_count: number;
    success_rate: number;
    average_cost: Cost;
  };
}

export interface FileLock {
  file_path: string;
  agent_id: EntityId;
  locked_at: string;
}

export interface QualityCheck {
  name: string;
  passed: boolean;
  score: number;
  critical: boolean;
  findings: string[];
}

export interface TriageItem {
  id: EntityId;
  priority: Priority;
  category: string;
  description: string;
  location?: string;
  blocking: boolean;
  suggested_fix?: string;
}

export interface TriageResult {
  task_id: EntityId;
  items: TriageItem[];
  p1_count: number;
  p2_count: number;
  p3_count: number;
  can_ship: boolean;
}

export interface BudgetInfo {
  allocated: number;
  spent: number;
  remaining: number;
  projected: number;
  alert_threshold: number;
}
