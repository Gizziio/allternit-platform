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
import { z } from 'zod';

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

// Zod Schema for VoiceConfig
export const voiceConfigSchema = z.object({
  voiceId: z.string().optional(),
  voiceLabel: z.string().optional(),
  engine: z.enum(['chatterbox', 'xtts_v2', 'piper']).optional(),
  enabled: z.boolean(),
  autoSpeak: z.boolean().optional(),
  speakOnCheckpoint: z.boolean().optional(),
});

// Agent Status
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error';

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
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  workspaceId?: string; // Reference to agent workspace
  ownerId?: string; // User who created the agent
}

// Zod Schema for Agent
export const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string(),
  type: z.enum(['orchestrator', 'sub-agent', 'worker']),
  parentAgentId: z.string().optional(),
  model: z.string().min(1),
  provider: z.enum(['openai', 'anthropic', 'local', 'custom']),
  capabilities: z.array(z.string()),
  systemPrompt: z.string().optional(),
  tools: z.array(z.string()),
  maxIterations: z.number().int().min(1).max(100),
  temperature: z.number().min(0).max(2),
  voice: voiceConfigSchema.optional(),
  config: z.record(z.unknown()).default({}),
  status: z.enum(['idle', 'running', 'paused', 'error']),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastRunAt: z.string().optional(),
  workspaceId: z.string().optional(),
  ownerId: z.string().optional(),
});

// Schema for validating array of agents (API response)
export const agentArraySchema = z.array(agentSchema);

// Schema for API response wrapper
export const agentListResponseSchema = z.object({
  agents: agentArraySchema,
  total: z.number().int().nonnegative(),
});

// Agent Workspace (5-layer workspace structure)
export interface AgentWorkspace {
  id: string;
  agentId: string;
  agentName: string;
  version: string;
  manifest: {
    id: string;
    agentId: string;
    agentName: string;
    template: string;
    version: string;
    createdAt: number;
    lastModified: number;
    layers: AgentWorkspaceLayers;
    files: string[];
    [key: string]: unknown;
  };
  fileTree: Array<{
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modifiedAt?: string;
  }>;
  lastModified: number;
  status: AgentStatus;
  layers: AgentWorkspaceLayers;
}

// Workspace layer flags
export interface AgentWorkspaceLayers {
  cognitive: boolean;
  identity: boolean;
  governance: boolean;
  skills: boolean;
  business: boolean;
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
  workspaceId?: string;  // Optional workspace ID
  ownerId?: string;  // User who created the agent
}

// Zod Schema for CreateAgentInput
export const createAgentInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string(),
  type: z.enum(['orchestrator', 'sub-agent', 'worker']).optional(),
  parentAgentId: z.string().optional(),
  model: z.string().min(1),
  provider: z.enum(['openai', 'anthropic', 'local', 'custom']),
  capabilities: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
  tools: z.array(z.string()).optional(),
  maxIterations: z.number().int().min(1).max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  voice: voiceConfigSchema.optional(),
  config: z.record(z.unknown()).optional(),
  workspaceId: z.string().optional(),
  ownerId: z.string().optional(),
});

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

// Zod Schema for AgentTask
export const agentTaskSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  runId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: z.enum(['pending', 'in-progress', 'completed', 'failed', 'cancelled']),
  priority: z.number().int(),
  dependencies: z.array(z.string()),
  result: z.string().optional(),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

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

// Zod Schema for AgentRun
export const agentRunSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  input: z.string(),
  output: z.string().optional(),
  tasks: z.array(agentTaskSchema),
  checkpointCount: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()).optional(),
  runnerTrace: z.array(z.any()).optional(), // AgentTraceEntry[]
  elapsed: z.number().optional(),
});

// Trace entry for Runner integration
export interface AgentTraceEntry {
  id: string;
  timestamp: number;
  kind: 'info' | 'tool' | 'error' | 'thought' | 'plan' | 'checkpoint';
  title: string;
  detail?: string;
  status?: 'running' | 'success' | 'error' | 'pending';
}

// Zod Schema for AgentTraceEntry
export const agentTraceEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.number(),
  kind: z.enum(['info', 'tool', 'error', 'thought', 'plan', 'checkpoint']),
  title: z.string(),
  detail: z.string().optional(),
  status: z.enum(['running', 'success', 'error', 'pending']).optional(),
});

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

// Zod Schema for Checkpoint
export const checkpointSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  runId: z.string().min(1),
  label: z.string(),
  description: z.string().optional(),
  data: z.record(z.unknown()),
  timestamp: z.string(),
  taskId: z.string().optional(),
});

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

// Zod Schema for Commit
export const commitSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  message: z.string(),
  author: z.string(),
  timestamp: z.string(),
  parentId: z.string().optional(),
  changes: z.array(z.any()), // CommitChange[]
  checkpointId: z.string().optional(),
});

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

// Zod Schema for ExecutionPlan
export const executionPlanSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  steps: z.array(z.any()), // PlanStep[]
  currentStepIndex: z.number().int().nonnegative(),
  status: z.enum(['pending', 'active', 'completed', 'failed']),
});

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

// Zod Schema for QueueItem
export const queueItemSchema = z.object({
  id: z.string().min(1),
  priority: z.number().int(),
  content: z.string(),
  agentId: z.string().optional(),
  runId: z.string().optional(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

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

// Zod Schema for GateReview
export const gateReviewSchema = z.object({
  id: z.string().min(1),
  wihId: z.string().min(1),
  dagId: z.string().min(1),
  agentId: z.string().min(1),
  type: z.enum(['tool_use', 'file_write', 'checkpoint', 'completion', 'policy_violation']),
  status: z.enum(['pending', 'approved', 'rejected', 'escalated']),
  title: z.string(),
  description: z.string(),
  proposedAction: z.string(),
  context: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  reviewedAt: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewNote: z.string().optional(),
  autoExpireAt: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']),
});

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

// Zod Schema for AgentMailMessage
export const agentMailMessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  fromAgentId: z.string().min(1),
  fromAgentName: z.string().optional(),
  toAgentId: z.string().optional(),
  subject: z.string(),
  body: z.string(),
  bodyRef: z.string().optional(),
  status: z.enum(['unread', 'read', 'acknowledged', 'archived']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  timestamp: z.string(),
  attachments: z.array(z.object({
    ref: z.string(),
    filename: z.string(),
    contentType: z.string(),
  })).optional(),
  requiresAck: z.boolean().optional(),
  ackedAt: z.string().optional(),
});

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

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates an Agent object at runtime
 * @param data Unknown data to validate
 * @returns Validated Agent object
 * @throws ZodError if validation fails
 */
export function validateAgent(data: unknown): Agent {
  return agentSchema.parse(data) as Agent;
}

/**
 * Validates an array of Agents
 * @param data Unknown data to validate
 * @returns Validated Agent array
 * @throws ZodError if validation fails
 */
export function validateAgentArray(data: unknown): Agent[] {
  return agentArraySchema.parse(data) as Agent[];
}

/**
 * Validates Agent list API response
 * @param data Unknown data to validate
 * @returns Validated response with agents and total count
 * @throws ZodError if validation fails
 */
export function validateAgentListResponse(data: unknown): { agents: Agent[]; total: number } {
  return agentListResponseSchema.parse(data) as { agents: Agent[]; total: number };
}

/**
 * Validates CreateAgentInput
 * @param data Unknown data to validate
 * @returns Validated input
 * @throws ZodError if validation fails
 */
export function validateCreateAgentInput(data: unknown): CreateAgentInput {
  return createAgentInputSchema.parse(data) as CreateAgentInput;
}

/**
 * Validates an AgentRun object
 * @param data Unknown data to validate
 * @returns Validated AgentRun
 * @throws ZodError if validation fails
 */
export function validateAgentRun(data: unknown): AgentRun {
  return agentRunSchema.parse(data) as AgentRun;
}

/**
 * Validates an AgentTask object
 * @param data Unknown data to validate
 * @returns Validated AgentTask
 * @throws ZodError if validation fails
 */
export function validateAgentTask(data: unknown): AgentTask {
  return agentTaskSchema.parse(data) as AgentTask;
}

/**
 * Validates a GateReview object
 * @param data Unknown data to validate
 * @returns Validated GateReview
 * @throws ZodError if validation fails
 */
export function validateGateReview(data: unknown): GateReview {
  return gateReviewSchema.parse(data) as GateReview;
}

/**
 * Safe validation that returns null on failure instead of throwing
 * @param schema Zod schema to validate against
 * @param data Data to validate
 * @returns Validated data or null
 */
export function safeValidate<T>(schema: z.ZodType<T>, data: unknown): T | null {
  try {
    return schema.parse(data);
  } catch (error) {
    console.error('[AgentTypes] Validation error:', error);
    return null;
  }
}
