import type { Agent } from '@/lib/agents/agent.types';
import type { AgentMode } from '@/design/allternit.tokens';
import type { ElementType } from 'react';

export interface SwarmOrchestratorProps {
  /** Available agents to add to the swarm */
  agents: Agent[];
  /** UI theme mode */
  mode?: AgentMode;
  /** Initial swarm configuration (for editing existing swarms) */
  initialSwarm?: SwarmConfig;
  /** Callback when swarm is saved */
  onSaveSwarm?: (swarm: SwarmConfig) => void | Promise<void>;
  /** Callback when swarm execution is requested */
  onExecuteSwarm?: (swarmId: string, config: SwarmExecutionRequest) => void | Promise<void>;
  /** Callback when swarm execution is stopped */
  onStopSwarm?: (executionId: string) => void | Promise<void>;
  /** Callback when swarm execution is paused */
  onPauseSwarm?: (executionId: string) => void | Promise<void>;
  /** Callback when swarm execution is resumed */
  onResumeSwarm?: (executionId: string) => void | Promise<void>;
  /** Real-time execution updates from backend */
  executionUpdates?: SwarmExecutionUpdate;
  /** Whether the user has permission to modify the swarm */
  canEdit?: boolean;
  /** Whether the user has permission to execute the swarm */
  canExecute?: boolean;
  /** Optional className for styling */
  className?: string;
}

export interface SwarmConfig {
  /** Unique identifier for the swarm */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Agents in the swarm with their configuration */
  agents: SwarmAgent[];
  /** Message routing configuration */
  routing: RoutingConfig;
  /** Execution mode for the swarm */
  executionMode: ExecutionMode;
  /** Creation timestamp */
  createdAt?: string;
  /** Last update timestamp */
  updatedAt?: string;
  /** Version for optimistic locking */
  version?: number;
  /** Tags for organization */
  tags?: string[];
  /** Whether the swarm is active */
  isActive?: boolean;
}

export interface SwarmAgent {
  /** Unique identifier within the swarm */
  id: string;
  /** Reference to the actual agent ID */
  agentId: string;
  /** Display name */
  name: string;
  /** Role in the swarm */
  role: AgentRole;
  /** Position on the canvas */
  position: { x: number; y: number };
  /** Connected agent IDs */
  connections: string[];
  /** Agent capabilities */
  capabilities: string[];
  /** Custom configuration for this agent in the swarm */
  config?: AgentSwarmConfig;
  /** Whether this agent is currently enabled */
  enabled?: boolean;
  /** Execution priority (higher = earlier) */
  priority?: number;
  /** Maximum concurrent tasks */
  maxConcurrency?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

export type AgentRole = 'coordinator' | 'worker' | 'specialist' | 'reviewer' | 'gatekeeper';

export type ExecutionMode = 'parallel' | 'sequential' | 'adaptive' | 'pipeline';

export interface RoutingConfig {
  /** Routing strategy */
  strategy: RoutingStrategy;
  /** Optional message type filters */
  messageFilter?: string[];
  /** Priority rules for message routing */
  priorityRules?: PriorityRule[];
  /** Fallback behavior when no agent matches */
  fallbackBehavior?: 'broadcast' | 'drop' | 'queue' | 'error';
  /** Maximum message queue size per agent */
  maxQueueSize?: number;
  /** Message TTL in seconds */
  messageTTL?: number;
}

export type RoutingStrategy = 
  | 'broadcast' 
  | 'roundRobin' 
  | 'capabilityBased' 
  | 'loadBalanced' 
  | 'priorityBased'
  | 'weightedRandom';

export interface PriorityRule {
  /** Rule identifier */
  id: string;
  /** Condition expression (e.g., "message.priority > 5") */
  condition: string;
  /** Priority level (1-10) */
  priority: number;
  /** Target agent IDs */
  targetAgents: string[];
  /** Whether this rule is active */
  enabled?: boolean;
}

export interface AgentSwarmConfig {
  /** Custom system prompt override */
  systemPrompt?: string;
  /** Temperature setting */
  temperature?: number;
  /** Maximum tokens per request */
  maxTokens?: number;
  /** Custom tools enabled for this agent in swarm */
  enabledTools?: string[];
  /** Custom model override */
  model?: string;
}

export interface SwarmExecutionRequest {
  swarmId: string;
  /** Initial input message */
  input: string;
  /** Execution context */
  context?: Record<string, unknown>;
  /** Maximum execution time */
  timeout?: number;
  /** Callback URL for progress updates */
  webhookUrl?: string;
  /** Whether to stream results */
  stream?: boolean;
}

export interface SwarmExecution {
  /** Execution identifier */
  id: string;
  /** Swarm being executed */
  swarmId: string;
  /** Current status */
  status: ExecutionStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Currently active agents */
  activeAgents: string[];
  /** Total messages exchanged */
  messagesExchanged: number;
  /** Execution start time */
  startTime?: Date;
  /** Execution end time */
  endTime?: Date;
  /** Current stage */
  currentStage?: string;
  /** Execution results */
  results?: ExecutionResult[];
  /** Error information if failed */
  error?: ExecutionError;
  /** Performance metrics */
  metrics?: ExecutionMetrics;
}

export type ExecutionStatus = 
  | 'idle' 
  | 'starting' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled'
  | 'timeout';

export interface ExecutionResult {
  agentId: string;
  output: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  duration: number;
}

export interface ExecutionError {
  code: string;
  message: string;
  agentId?: string;
  details?: Record<string, unknown>;
}

export interface ExecutionMetrics {
  totalDuration: number;
  averageLatency: number;
  tokensUsed: number;
  costEstimate: number;
  agentMetrics: AgentExecutionMetric[];
}

export interface AgentExecutionMetric {
  agentId: string;
  messagesProcessed: number;
  averageResponseTime: number;
  errorCount: number;
  tokensUsed: number;
}

export interface SwarmExecutionUpdate {
  executionId: string;
  status: ExecutionStatus;
  progress: number;
  activeAgents: string[];
  messagesExchanged: number;
  currentStage?: string;
  timestamp: Date;
  metrics?: Partial<ExecutionMetrics>;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface RoleConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: ElementType;
  description: string;
  maxInputs: number;
  maxOutputs: number;
}

export interface ExecutionModeConfig {
  label: string;
  description: string;
}

export interface AgentNodeData {
  id: string;
  agentId: string;
  name: string;
  role: AgentRole;
  enabled?: boolean;
  isExecuting?: boolean;
  executionStatus?: 'active' | 'error' | 'idle';
  capabilities: string[];
  connections: string[];
  priority?: number;
  config?: AgentSwarmConfig;
  position?: { x: number; y: number };
}
