/**
 * Agent Types - Production Implementation
 * 
 * Defines the core data models for the Agent Studio:
 * - Agent: Configuration and metadata for an AI agent
 * - AgentTask: Individual tasks within an agent execution
 * - AgentRun: A complete execution run of an agent
 * - Checkpoint: Save points during execution
 * - Commit: Versioned state snapshots
 */

import type { AvatarConfig } from './character.types';

// Agent Types
export type AgentType = 'orchestrator' | 'sub-agent' | 'worker';

// Voice Configuration
export interface VoiceConfig {
  voiceId?: string;
  voiceLabel?: string;
  engine?: 'chatterbox' | 'xtts_v2' | 'piper';
  enabled: boolean;
  autoSpeak?: boolean;
  speakOnCheckpoint?: boolean;
}

// Agent Configuration
export interface Agent {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  parentAgentId?: string; // For sub-agents
  model: string;
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  capabilities: string[];
  systemPrompt?: string;
  tools: string[];
  maxIterations: number;
  temperature: number;
  voice?: VoiceConfig;
  config: Record<string, unknown>;
  status: 'idle' | 'running' | 'paused' | 'error';
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
}

// Agent creation input
export interface CreateAgentInput {
  name: string;
  description: string;
  type?: AgentType;
  parentAgentId?: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  capabilities?: string[];
  systemPrompt?: string;
  tools?: string[];
  maxIterations?: number;
  temperature?: number;
  voice?: VoiceConfig;
  config?: Record<string, unknown>;
  avatar?: AvatarConfig;  // Agent visual avatar configuration
}

// Extended Agent with typed avatar
export interface AgentWithAvatar extends Agent {
  avatar?: AvatarConfig;
}

// Helper to extract avatar from agent config
export function getAgentAvatar(agent: Agent): AvatarConfig | undefined {
  const avatar = agent.config?.avatar as AvatarConfig | undefined;
  return avatar;
}

// Task status
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

// Agent Task
export interface AgentTask {
  id: string;
  agentId: string;
  runId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  dependencies: string[];
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

// Agent Run (execution instance)
export interface AgentRun {
  id: string;
  agentId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  input: string;
  output?: string;
  tasks: AgentTask[];
  checkpointCount: number;
  metadata?: Record<string, unknown>;
  // Runner integration
  runnerTrace?: AgentTraceEntry[];
  elapsed?: number;
}

// Trace entry for Runner integration
export interface AgentTraceEntry {
  id: string;
  timestamp: number;
  kind: 'info' | 'tool' | 'error' | 'thought' | 'plan' | 'checkpoint';
  title: string;
  detail?: string;
  status?: 'running' | 'success' | 'error' | 'pending';
}

// For compatibility with AdvancedAgentRun
export interface RunnerTraceEntry extends AgentTraceEntry {}

// Checkpoint during execution
export interface Checkpoint {
  id: string;
  agentId: string;
  runId: string;
  label: string;
  description?: string;
  data: Record<string, unknown>;
  timestamp: string;
  taskId?: string;
}

// Commit (versioned snapshot)
export interface Commit {
  id: string;
  agentId: string;
  message: string;
  author: string;
  timestamp: string;
  parentId?: string;
  changes: CommitChange[];
  checkpointId?: string;
}

export interface CommitChange {
  type: 'added' | 'modified' | 'deleted';
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
}

// Execution Plan
export interface ExecutionPlan {
  id: string;
  agentId: string;
  steps: PlanStep[];
  currentStepIndex: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  order: number;
  taskId?: string;
}

// Queue Item
export interface QueueItem {
  id: string;
  priority: number;
  content: string;
  agentId?: string;
  runId?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// Agent Event for real-time updates
export type AgentEventType = 
  | 'agent.created'
  | 'agent.updated'
  | 'agent.deleted'
  | 'agent.status.changed'
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'checkpoint.created'
  | 'commit.created'
  | 'mail.received'
  | 'mail.sent'
  | 'gate.review_requested'
  | 'gate.decision_recorded'
  | 'error';

// ============================================================================
// Gate/Review Types
// ============================================================================

export interface GateReview {
  id: string;
  wihId: string;
  dagId: string;
  agentId: string;
  type: 'tool_use' | 'file_write' | 'checkpoint' | 'completion' | 'policy_violation';
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  title: string;
  description: string;
  proposedAction: string;
  context?: Record<string, unknown>;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  autoExpireAt?: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface GateDecision {
  decisionId: string;
  wihId: string;
  approved: boolean;
  note?: string;
  reason?: string;
  timestamp: string;
  mutations?: Array<{
    action: string;
    path?: string;
    value?: unknown;
  }>;
}

// Agent Mail Types
// ============================================================================

export interface AgentMailMessage {
  id: string;
  threadId: string;
  fromAgentId: string;
  fromAgentName?: string;
  toAgentId?: string;
  subject: string;
  body: string;
  bodyRef?: string;
  status: 'unread' | 'read' | 'acknowledged' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: string;
  attachments?: Array<{
    ref: string;
    filename: string;
    contentType: string;
  }>;
  requiresAck?: boolean;
  ackedAt?: string;
}

export interface AgentMailThread {
  id: string;
  subject: string;
  participants: string[];
  messageCount: number;
  lastMessageAt: string;
  unreadCount: number;
}

export interface SendMailInput {
  toAgentId: string;
  subject: string;
  body: string;
  threadId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  requiresAck?: boolean;
  attachments?: Array<{
    ref: string;
    filename: string;
    contentType: string;
  }>;
}

export interface AgentEvent {
  type: AgentEventType;
  agentId: string;
  runId?: string;
  taskId?: string;
  timestamp: string;
  data: unknown;
}

// Available capabilities
export const AGENT_CAPABILITIES = [
  { id: 'code-generation', name: 'Code Generation', description: 'Generate and edit code' },
  { id: 'file-operations', name: 'File Operations', description: 'Read, write, and manage files' },
  { id: 'web-search', name: 'Web Search', description: 'Search the web for information' },
  { id: 'browser-automation', name: 'Browser Automation', description: 'Control browser via UI-TARS' },
  { id: 'terminal', name: 'Terminal', description: 'Execute shell commands' },
  { id: 'database', name: 'Database', description: 'Query and manage databases' },
  { id: 'api-integration', name: 'API Integration', description: 'Make HTTP requests to APIs' },
  { id: 'memory', name: 'Memory', description: 'Access long-term memory and context' },
  { id: 'planning', name: 'Planning', description: 'Create and execute multi-step plans' },
  { id: 'reasoning', name: 'Reasoning', description: 'Complex reasoning and analysis' },
] as const;

// Available models
export const AGENT_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' },
  { id: 'local-llama', name: 'Local Llama', provider: 'local' },
] as const;

// Agent type definitions
export const AGENT_TYPES: { id: AgentType; name: string; description: string; icon: string }[] = [
  { id: 'orchestrator', name: 'Orchestrator', description: 'Coordinates other agents and manages complex workflows', icon: 'Network' },
  { id: 'sub-agent', name: 'Sub-Agent', description: 'Specialized agent that reports to an orchestrator', icon: 'Bot' },
  { id: 'worker', name: 'Worker', description: 'Single-purpose agent for specific tasks', icon: 'Cog' },
];

// Voice preset from voice service
export interface VoicePreset {
  id: string;
  label: string;
  engine: 'chatterbox' | 'xtts_v2' | 'piper';
  assetReady: boolean;
}

// Voice service response
export interface VoicesResponse {
  voices: VoicePreset[];
}
