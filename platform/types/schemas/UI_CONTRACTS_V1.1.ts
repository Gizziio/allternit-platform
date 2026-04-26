/**
 * Allternit Production UI Contracts v1.1
 * 
 * CORRECTIONS FROM v1.0:
 * - All Date → ISODate (string) for serialization safety
 * - Normalized entity references (ids instead of nested objects)
 * - Added Run, WorkItem, DAGRun, TraceEvent, Receipt types
 * - Added validation + factory functions
 */

import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

export type UUID = string;
export type ISODate = string; // ISO 8601 format
export type RiskTier = 'safe' | 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// Project (Codex App Pattern)
// ============================================================================

export interface Project {
  readonly id: UUID;
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  readonly version: number;
  
  name: string;
  description: string;
  rootPath: string; // Absolute path
  
  // Context pack - what the agent knows
  context: {
    includedFiles: string[]; // Relative paths
    workingDirectory: string;
    envVars: Record<string, string>;
    systemPromptAdditions: string[];
    lastSyncedAt: ISODate;
  };
  
  // NORMALIZED: References only, not nested objects
  activeThreadId: UUID | null;
  threadIds: UUID[];
  
  settings: {
    autoAcceptSafeEdits: boolean;
    autoAcceptTypes: ('formatting' | 'comments' | 'types')[];
    preferredModel: string;
    preferredMode: 'llm' | 'agent';
    defaultSidecarOpen: boolean;
    defaultDrawerOpen: boolean;
    defaultDrawerHeight: number;
  };
  
  // Stats (computed)
  stats: {
    totalTokensUsed: number;
    totalCost: number;
    filesModified: number;
    sessionsCount: number;
    lastActivityAt: ISODate | null;
  };
}

// ============================================================================
// Thread (Claude-style Conversation)
// ============================================================================

export interface Thread {
  readonly id: UUID;
  readonly projectId: UUID;
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  readonly version: number;
  
  title: string;
  mode: 'llm' | 'agent';
  status: 'active' | 'paused' | 'completed' | 'archived';
  
  // NORMALIZED: References only
  messageIds: UUID[];
  artifactIds: UUID[];
  changeSetIds: UUID[];
  
  // Optional integrations
  openclawSessionId?: string;
  
  // Current state
  currentMessageId: UUID | null;
  checkpointId: UUID | null;
  
  metadata: {
    messageCount: number;
    lastMessageAt: ISODate | null;
    estimatedTokens: number;
  };
}

// ============================================================================
// Message (Chat Message)
// ============================================================================

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'artifact'; artifactId: UUID }
  | { type: 'tool_call'; toolCallId: UUID }
  | { type: 'tool_result'; toolResultId: UUID }
  | { type: 'thinking'; thinking: string }
  | { type: 'image'; url: string; mimeType: string }
  | { type: 'code'; code: string; language: string }
  | { type: 'error'; error: string };

export interface Message {
  readonly id: UUID;
  readonly threadId: UUID;
  readonly projectId: UUID;
  
  role: 'user' | 'assistant' | 'system' | 'tool';
  authorId?: string;
  
  parts: MessagePart[];
  status: 'streaming' | 'pending' | 'completed' | 'error' | 'cancelled';
  
  streamState?: {
    isStreaming: boolean;
    streamId?: string;
    chunksReceived: number;
    lastChunkAt?: ISODate;
  };
  
  tokenCount?: {
    input: number;
    output: number;
    total: number;
  };
  
  cost?: {
    amount: number;
    currency: string;
    model: string;
  };
  
  timing: {
    sentAt: ISODate;
    firstTokenAt?: ISODate;
    completedAt?: ISODate;
    latencyMs?: number;
  };
  
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  readonly version: number;
  
  generatedArtifactIds: UUID[];
  generatedChangeSetId?: UUID;
}

// ============================================================================
// Tool Call
// ============================================================================

export interface ToolCall {
  readonly id: UUID;
  readonly messageId: UUID;
  readonly threadId: UUID;
  
  name: string;
  displayName?: string;
  arguments: Record<string, unknown>;
  
  status: 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'error';
  
  approval?: {
    required: boolean;
    riskTier: RiskTier;
    requestedAt?: ISODate;
    respondedAt?: ISODate;
    approvedBy?: string;
    rejectionReason?: string;
  };
  
  execution?: {
    startedAt?: ISODate;
    completedAt?: ISODate;
    durationMs?: number;
    logs?: string[];
  };
  
  result?: unknown;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
}

// ============================================================================
// Artifact (Claude Artifacts)
// ============================================================================

export interface Artifact {
  readonly id: UUID;
  readonly threadId: UUID;
  readonly projectId: UUID;
  readonly messageId: UUID;
  
  type: 'code' | 'markdown' | 'mermaid' | 'svg' | 'html' | 'react' | 'json' | 'yaml' | 'terminal' | 'diff' | 'unknown';
  title: string;
  description?: string;
  
  content: string;
  language?: string;
  
  // Versioning
  version: number;
  versions: {
    version: number;
    content: string;
    changeDescription?: string;
    createdAt: ISODate;
    createdBy: 'user' | 'assistant';
  }[];
  
  // State
  status: 'streaming' | 'preview' | 'editing' | 'saved' | 'rejected' | 'error';
  viewMode: 'preview' | 'code' | 'split';
  isPinned: boolean;
  
  // File sync
  fileSync?: {
    filePath: string;
    lastSyncedAt: ISODate;
    syncStatus: 'synced' | 'modified' | 'conflict' | 'error';
    autoSync: boolean;
  };
  
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  createdBy: 'user' | 'assistant';
  
  error?: {
    message: string;
    code: string;
    recoverable: boolean;
  };
}

// ============================================================================
// ChangeSet (Cursor Review Pattern)
// ============================================================================

export interface DiffLine {
  readonly id: string;
  type: 'context' | 'addition' | 'deletion';
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  isAccepted: boolean | null;
}

export interface DiffHunk {
  readonly id: string;
  fileChangeId: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  header?: string;
  isAccepted: boolean | null;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
}

export interface FileChange {
  readonly id: UUID;
  readonly changeSetId: UUID;
  
  filePath: string;
  absolutePath: string;
  fileType: 'code' | 'config' | 'doc' | 'test' | 'other';
  changeType: 'add' | 'modify' | 'delete' | 'rename';
  oldFilePath?: string;
  
  oldContent?: string;
  newContent?: string;
  oldHash?: string;
  newHash?: string;
  
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  
  reviewState: 'pending' | 'accepted' | 'rejected' | 'partial';
  reviewedAt?: ISODate;
  reviewedBy?: string;
  
  riskTier: RiskTier;
  riskReason?: string;
  
  applyState: 'pending' | 'applying' | 'applied' | 'failed';
  applyError?: string;
  appliedAt?: ISODate;
}

export interface ChangeSet {
  readonly id: UUID;
  readonly projectId: UUID;
  readonly threadId: UUID;
  readonly messageId: UUID;
  
  changes: FileChange[];
  
  // STRICT STATE MACHINE
  status: 'generating' | 'pending' | 'in_review' | 'partial' | 'approved' | 'rejected' | 'applying' | 'applied' | 'apply_failed' | 'stale';
  
  reviewProgress: {
    totalFiles: number;
    totalHunks: number;
    acceptedFiles: number;
    rejectedFiles: number;
    pendingFiles: number;
    acceptedHunks: number;
    rejectedHunks: number;
    pendingHunks: number;
  };
  
  userReview: {
    startedAt?: ISODate;
    completedAt?: ISODate;
    comment?: string;
    reviewedBy?: string;
  };
  
  riskAssessment: {
    overallRisk: RiskTier;
    maxFileRisk: RiskTier;
    destructiveChanges: boolean;
    securitySensitive: boolean;
    configChanges: boolean;
    testCoverage: 'full' | 'partial' | 'none' | 'unknown';
  };
  
  policy: {
    policyId: string;
    decision: 'auto_apply' | 'stage' | 'require_approval';
    autoApproved: boolean;
    autoApproveReason?: string;
    overriddenBy?: string;
    overriddenAt?: ISODate;
  };
  
  applyState: {
    startedAt?: ISODate;
    completedAt?: ISODate;
    appliedFiles: number;
    failedFiles: number;
    rollbackAvailable: boolean;
    rollbackSnapshotId?: string;
  };
  
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  expiresAt?: ISODate;
  
  metadata: {
    generator: 'agent' | 'user' | 'tool' | 'import';
    toolCalls: UUID[];
    agentRunId?: UUID;
  };
}

// ============================================================================
// Approval Policy (AI SDK 6)
// ============================================================================

export type ApprovalCondition =
  | { type: 'risk-tier'; tier: RiskTier; operator: 'eq' | 'gte' }
  | { type: 'file-pattern'; pattern: string; negate?: boolean }
  | { type: 'change-type'; changeType: FileChange['changeType']; negate?: boolean }
  | { type: 'file-type'; fileType: FileChange['fileType']; negate?: boolean }
  | { type: 'tool-name'; toolName: string; negate?: boolean }
  | { type: 'command-pattern'; pattern: string; negate?: boolean }
  | { type: 'has-tests'; value: boolean }
  | { type: 'file-size'; maxBytes: number }
  | { type: 'line-count'; maxLines: number };

export interface ApprovalRule {
  readonly id: UUID;
  name: string;
  description?: string;
  priority: number;
  conditions: ApprovalCondition[];
  action: 'auto_apply' | 'stage' | 'require_approval';
  requireConfirmation?: boolean;
  confirmationMessage?: string;
  notifyOnApply?: boolean;
  notifyChannels: ('ui' | 'notification' | 'sound')[];
}

export interface ApprovalPolicy {
  readonly id: UUID;
  name: string;
  description?: string;
  projectId: UUID | null; // null = global
  isDefault: boolean;
  rules: ApprovalRule[];
  defaultAction: 'auto_apply' | 'stage' | 'require_approval';
  settings: {
    allowOverride: boolean;
    requireReasonForOverride: boolean;
    maxAutoApplySize: number;
    batchApplyEnabled: boolean;
    reviewTimeout: number;
  };
  isActive: boolean;
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  createdBy: string;
}

// ============================================================================
// NEW IN v1.1: Run (Agent Execution)
// ============================================================================

export interface Run {
  readonly id: UUID;
  readonly threadId: UUID;
  readonly projectId: UUID;
  
  name: string;
  description?: string;
  
  status: 'queued' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  
  steps: {
    readonly id: string;
    index: number;
    type: 'thinking' | 'tool_call' | 'file_edit' | 'user_input' | 'error' | 'checkpoint';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    content: string;
    toolCallId?: UUID;
    changeSetId?: UUID;
    artifactId?: UUID;
    startedAt?: ISODate;
    completedAt?: ISODate;
  }[];
  
  currentStepIndex: number;
  
  resources: {
    tokensUsed: number;
    cost: number;
    durationMs?: number;
  };
  
  // NORMALIZED: References
  changeSetIds: UUID[];
  toolCallIds: UUID[];
  artifactIds: UUID[];
  
  isPausable: boolean;
  isCancellable: boolean;
  
  error?: {
    message: string;
    code: string;
    recoverable: boolean;
    retryable: boolean;
  };
  
  readonly createdAt: ISODate;
  startedAt?: ISODate;
  completedAt?: ISODate;
  readonly updatedAt: ISODate;
}

// ============================================================================
// NEW IN v1.1: WorkItem (WIH for Queue/Kanban)
// ============================================================================

export type WorkItemStatus = 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'done';
export type WorkItemPriority = 'low' | 'medium' | 'high' | 'critical';

export interface WorkItem {
  readonly id: UUID;
  readonly projectId: UUID;
  
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  
  // References
  threadId?: UUID;
  runId?: UUID;
  changeSetId?: UUID;
  
  // Assignment
  assigneeId?: string;
  
  // Timestamps
  readonly createdAt: ISODate;
  startedAt?: ISODate;
  completedAt?: ISODate;
  readonly updatedAt: ISODate;
  
  // Metadata
  tags: string[];
  estimatedHours?: number;
  actualHours?: number;
}

// ============================================================================
// NEW IN v1.1: DAGRun (DAG Execution)
// ============================================================================

export interface DAGRun {
  readonly id: UUID;
  readonly projectId: UUID;
  dagId: string;
  dagVersion: string;
  
  status: 'pending' | 'running' | 'paused' | 'succeeded' | 'failed' | 'cancelled';
  
  tasks: {
    readonly id: string;
    name: string;
    status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'upstream_failed';
    runId?: UUID; // Linked agent run
    startedAt?: ISODate;
    completedAt?: ISODate;
    durationMs?: number;
    logs?: string[];
  }[];
  
  startedAt?: ISODate;
  completedAt?: ISODate;
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
}

// ============================================================================
// NEW IN v1.1: TraceEvent (Execution Tracing)
// ============================================================================

export interface TraceEvent {
  readonly id: UUID;
  readonly runId: UUID;
  readonly timestamp: ISODate;
  
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'llm' | 'tool' | 'file' | 'user' | 'system';
  
  message: string;
  details?: Record<string, unknown>;
  
  // Links
  messageId?: UUID;
  toolCallId?: UUID;
  fileChangeId?: UUID;
}

// ============================================================================
// NEW IN v1.1: Receipt (Browser Agent Evidence)
// ============================================================================

export interface Receipt {
  readonly id: UUID;
  readonly runId: UUID;
  readonly projectId: UUID;
  
  type: 'action' | 'navigation' | 'extraction' | 'screenshot' | 'verification';
  title: string;
  description: string;
  
  // Evidence
  screenshots: {
    url: string;
    timestamp: ISODate;
    description?: string;
  }[];
  
  // Data extracted
  extractedData?: Record<string, unknown>;
  
  // Verification
  verifiedBy?: string;
  verifiedAt?: ISODate;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  
  // Policy
  policyTier: 'low' | 'medium' | 'high';
  
  readonly createdAt: ISODate;
}

// ============================================================================
// Sidecar State
// ============================================================================

export interface SidecarState {
  isOpen: boolean;
  activePanel: 'artifact' | 'context' | 'agent' | 'changeset' | 'preview';
  width: number;
  isResizing: boolean;
  
  panels: {
    artifact: {
      activeArtifactId: UUID | null;
      viewMode: 'preview' | 'code' | 'split';
      pinnedArtifacts: UUID[];
    };
    context: {
      activeThreadId: UUID | null;
      showTokenCount: boolean;
      showModelInfo: boolean;
      showProjectContext: boolean;
    };
    agent: {
      activeRunId: UUID | null;
      filter: 'all' | 'running' | 'completed' | 'failed';
      autoFollow: boolean;
    };
    changeset: {
      activeChangeSetId: UUID | null;
      filter: 'pending' | 'approved' | 'rejected' | 'applied' | 'all';
      showDiffView: boolean;
    };
  };
  
  history: {
    panel: 'artifact' | 'context' | 'agent' | 'changeset' | 'preview';
    entityId?: UUID;
    timestamp: ISODate;
  }[];
  
  toggleShortcut: string;
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number(),
  name: z.string(),
  description: z.string(),
  rootPath: z.string(),
  context: z.object({
    includedFiles: z.array(z.string()),
    workingDirectory: z.string(),
    envVars: z.record(z.string()),
    systemPromptAdditions: z.array(z.string()),
    lastSyncedAt: z.string(),
  }),
  activeThreadId: z.string().uuid().nullable(),
  threadIds: z.array(z.string().uuid()),
  settings: z.object({
    autoAcceptSafeEdits: z.boolean(),
    autoAcceptTypes: z.array(z.enum(['formatting', 'comments', 'types'])),
    preferredModel: z.string(),
    preferredMode: z.enum(['llm', 'agent']),
    defaultSidecarOpen: z.boolean(),
    defaultDrawerOpen: z.boolean(),
    defaultDrawerHeight: z.number(),
  }),
  stats: z.object({
    totalTokensUsed: z.number(),
    totalCost: z.number(),
    filesModified: z.number(),
    sessionsCount: z.number(),
    lastActivityAt: z.string().nullable(),
  }),
});

export const ThreadSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number(),
  title: z.string(),
  mode: z.enum(['llm', 'agent']),
  status: z.enum(['active', 'paused', 'completed', 'archived']),
  messageIds: z.array(z.string().uuid()),
  artifactIds: z.array(z.string().uuid()),
  changeSetIds: z.array(z.string().uuid()),
  openclawSessionId: z.string().optional(),
  currentMessageId: z.string().uuid().nullable(),
  checkpointId: z.string().uuid().nullable(),
  metadata: z.object({
    messageCount: z.number(),
    lastMessageAt: z.string().nullable(),
    estimatedTokens: z.number(),
  }),
});

export const ChangeSetSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  threadId: z.string().uuid(),
  messageId: z.string().uuid(),
  changes: z.array(z.any()), // FileChange schema would go here
  status: z.enum(['generating', 'pending', 'in_review', 'partial', 'approved', 'rejected', 'applying', 'applied', 'apply_failed', 'stale']),
  reviewProgress: z.object({
    totalFiles: z.number(),
    totalHunks: z.number(),
    acceptedFiles: z.number(),
    rejectedFiles: z.number(),
    pendingFiles: z.number(),
    acceptedHunks: z.number(),
    rejectedHunks: z.number(),
    pendingHunks: z.number(),
  }),
  userReview: z.object({
    startedAt: z.string().optional(),
    completedAt: z.string().optional(),
    comment: z.string().optional(),
    reviewedBy: z.string().optional(),
  }),
  riskAssessment: z.object({
    overallRisk: z.enum(['safe', 'low', 'medium', 'high', 'critical']),
    maxFileRisk: z.enum(['safe', 'low', 'medium', 'high', 'critical']),
    destructiveChanges: z.boolean(),
    securitySensitive: z.boolean(),
    configChanges: z.boolean(),
    testCoverage: z.enum(['full', 'partial', 'none', 'unknown']),
  }),
  policy: z.object({
    policyId: z.string(),
    decision: z.enum(['auto_apply', 'stage', 'require_approval']),
    autoApproved: z.boolean(),
    autoApproveReason: z.string().optional(),
    overriddenBy: z.string().optional(),
    overriddenAt: z.string().optional(),
  }),
  applyState: z.object({
    startedAt: z.string().optional(),
    completedAt: z.string().optional(),
    appliedFiles: z.number(),
    failedFiles: z.number(),
    rollbackAvailable: z.boolean(),
    rollbackSnapshotId: z.string().optional(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().optional(),
  metadata: z.object({
    generator: z.enum(['agent', 'user', 'tool', 'import']),
    toolCalls: z.array(z.string().uuid()),
    agentRunId: z.string().uuid().optional(),
  }),
});

export const RunSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(['queued', 'starting', 'running', 'paused', 'completed', 'failed', 'cancelled', 'timeout']),
  steps: z.array(z.object({
    id: z.string(),
    index: z.number(),
    type: z.enum(['thinking', 'tool_call', 'file_edit', 'user_input', 'error', 'checkpoint']),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
    content: z.string(),
    toolCallId: z.string().uuid().optional(),
    changeSetId: z.string().uuid().optional(),
    artifactId: z.string().uuid().optional(),
    startedAt: z.string().optional(),
    completedAt: z.string().optional(),
  })),
  currentStepIndex: z.number(),
  resources: z.object({
    tokensUsed: z.number(),
    cost: z.number(),
    durationMs: z.number().optional(),
  }),
  changeSetIds: z.array(z.string().uuid()),
  toolCallIds: z.array(z.string().uuid()),
  artifactIds: z.array(z.string().uuid()),
  isPausable: z.boolean(),
  isCancellable: z.boolean(),
  error: z.object({
    message: z.string(),
    code: z.string(),
    recoverable: z.boolean(),
    retryable: z.boolean(),
  }).optional(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  updatedAt: z.string(),
});

// ============================================================================
// Factory Functions
// ============================================================================

export function createProject(partial: Partial<Project> & { name: string; rootPath: string }): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    version: 1,
    name: partial.name,
    description: partial.description ?? '',
    rootPath: partial.rootPath,
    context: {
      includedFiles: [],
      workingDirectory: '.',
      envVars: {},
      systemPromptAdditions: [],
      lastSyncedAt: now,
    },
    activeThreadId: null,
    threadIds: [],
    settings: {
      autoAcceptSafeEdits: false,
      autoAcceptTypes: [],
      preferredModel: 'gpt-4',
      preferredMode: 'agent',
      defaultSidecarOpen: false,
      defaultDrawerOpen: false,
      defaultDrawerHeight: 300,
    },
    stats: {
      totalTokensUsed: 0,
      totalCost: 0,
      filesModified: 0,
      sessionsCount: 0,
      lastActivityAt: null,
    },
    ...partial,
  };
}

export function createThread(partial: Partial<Thread> & { projectId: string; title: string }): Thread {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: partial.projectId,
    createdAt: now,
    updatedAt: now,
    version: 1,
    title: partial.title,
    mode: 'agent',
    status: 'active',
    messageIds: [],
    artifactIds: [],
    changeSetIds: [],
    currentMessageId: null,
    checkpointId: null,
    metadata: {
      messageCount: 0,
      lastMessageAt: null,
      estimatedTokens: 0,
    },
    ...partial,
  };
}

export function createChangeSet(partial: Partial<ChangeSet> & { projectId: string; threadId: string; messageId: string }): ChangeSet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: partial.projectId,
    threadId: partial.threadId,
    messageId: partial.messageId,
    changes: [],
    status: 'generating',
    reviewProgress: {
      totalFiles: 0,
      totalHunks: 0,
      acceptedFiles: 0,
      rejectedFiles: 0,
      pendingFiles: 0,
      acceptedHunks: 0,
      rejectedHunks: 0,
      pendingHunks: 0,
    },
    userReview: {},
    riskAssessment: {
      overallRisk: 'safe',
      maxFileRisk: 'safe',
      destructiveChanges: false,
      securitySensitive: false,
      configChanges: false,
      testCoverage: 'unknown',
    },
    policy: {
      policyId: 'policy-balanced',
      decision: 'stage',
      autoApproved: false,
    },
    applyState: {
      appliedFiles: 0,
      failedFiles: 0,
      rollbackAvailable: false,
    },
    createdAt: now,
    updatedAt: now,
    metadata: {
      generator: 'agent',
      toolCalls: [],
    },
    ...partial,
  };
}

export function createRun(partial: Partial<Run> & { projectId: string; threadId: string; name: string }): Run {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: partial.projectId,
    threadId: partial.threadId,
    name: partial.name,
    description: partial.description ?? '',
    status: 'queued',
    steps: [],
    currentStepIndex: 0,
    resources: {
      tokensUsed: 0,
      cost: 0,
    },
    changeSetIds: [],
    toolCallIds: [],
    artifactIds: [],
    isPausable: true,
    isCancellable: true,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function createWorkItem(partial: Partial<WorkItem> & { projectId: string; title: string }): WorkItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: partial.projectId,
    title: partial.title,
    description: partial.description ?? '',
    status: 'backlog',
    priority: 'medium',
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

// ============================================================================
// Predefined Policies
// ============================================================================

export const BUILTIN_POLICIES: Record<string, ApprovalPolicy> = {
  cautious: {
    id: 'policy-cautious',
    name: 'Cautious',
    description: 'Require approval for all non-trivial changes',
    projectId: null,
    isDefault: false,
    rules: [
      {
        id: crypto.randomUUID(),
        name: 'Safe formatting auto-apply',
        priority: 100,
        conditions: [{ type: 'risk-tier', tier: 'safe', operator: 'eq' }],
        action: 'auto_apply',
        notifyChannels: ['ui'],
      },
      {
        id: crypto.randomUUID(),
        name: 'Destructive requires approval',
        priority: 90,
        conditions: [{ type: 'change-type', changeType: 'delete' }],
        action: 'require_approval',
        requireConfirmation: true,
        confirmationMessage: 'This will delete files. Are you sure?',
        notifyChannels: ['ui', 'notification'],
      },
      {
        id: crypto.randomUUID(),
        name: 'High risk requires approval',
        priority: 80,
        conditions: [{ type: 'risk-tier', tier: 'high', operator: 'gte' }],
        action: 'require_approval',
        notifyChannels: ['ui'],
      },
    ],
    defaultAction: 'require_approval',
    settings: {
      allowOverride: true,
      requireReasonForOverride: true,
      maxAutoApplySize: 10000,
      batchApplyEnabled: true,
      reviewTimeout: 0,
    },
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  
  balanced: {
    id: 'policy-balanced',
    name: 'Balanced',
    description: 'Auto-apply safe changes, stage medium risk',
    projectId: null,
    isDefault: true,
    rules: [
      {
        id: crypto.randomUUID(),
        name: 'Safe auto-apply',
        priority: 100,
        conditions: [{ type: 'risk-tier', tier: 'low', operator: 'lte' }],
        action: 'auto_apply',
        notifyChannels: ['ui'],
      },
      {
        id: crypto.randomUUID(),
        name: 'Medium risk stage',
        priority: 90,
        conditions: [{ type: 'risk-tier', tier: 'medium', operator: 'eq' }],
        action: 'stage',
        notifyChannels: ['ui'],
      },
    ],
    defaultAction: 'require_approval',
    settings: {
      allowOverride: true,
      requireReasonForOverride: false,
      maxAutoApplySize: 50000,
      batchApplyEnabled: true,
      reviewTimeout: 0,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  
  autonomous: {
    id: 'policy-autonomous',
    name: 'Autonomous',
    description: 'Auto-apply all changes except critical',
    projectId: null,
    isDefault: false,
    rules: [
      {
        id: crypto.randomUUID(),
        name: 'Non-critical auto-apply',
        priority: 100,
        conditions: [{ type: 'risk-tier', tier: 'critical', operator: 'lt' }],
        action: 'auto_apply',
        notifyChannels: ['ui'],
      },
    ],
    defaultAction: 'auto_apply',
    settings: {
      allowOverride: true,
      requireReasonForOverride: false,
      maxAutoApplySize: 100000,
      batchApplyEnabled: true,
      reviewTimeout: 0,
    },
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
};
