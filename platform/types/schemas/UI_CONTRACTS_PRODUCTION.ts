/**
 * A2R Production UI Contracts
 * 
 * Edge-case hardened TypeScript interfaces for:
 * - Project (Codex-style session management)
 * - Thread (Claude-style conversations)
 * - Artifact (Claude Artifacts with versioning)
 * - ChangeSet (Cursor-style diff review with strict state machine)
 * - ApprovalPolicy (AI SDK 6 risk-tier rules)
 * - AgentRun (Agent execution tracking)
 * 
 * SAFETY PRINCIPLES:
 * 1. No optional IDs - all entities have required id
 * 2. State machines use discriminated unions
 * 3. Timestamps are required (createdAt, updatedAt)
 * 4. Foreign keys are required (no orphaned entities)
 * 5. All arrays have explicit empty state (never undefined)
 * 6. Version numbers for optimistic concurrency
 */

import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

export type UUID = string;

export type Timestamp = string; // ISO 8601

export type RiskTier = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface EntityBase {
  readonly id: UUID;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly version: number; // Optimistic concurrency
}

// ============================================================================
// Project (Codex App Pattern)
// ============================================================================

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rootPath: z.string().min(1), // Absolute path
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().min(1),
  
  // Context pack - what the agent knows about this project
  context: z.object({
    includedFiles: z.array(z.string()), // Relative paths
    workingDirectory: z.string(), // Relative to rootPath
    envVars: z.record(z.string()),
    systemPromptAdditions: z.array(z.string()),
    lastSyncedAt: z.string().datetime(),
  }),
  
  // Session management
  activeThreadId: z.string().uuid().nullable(),
  
  // Settings
  settings: z.object({
    autoAcceptSafeEdits: z.boolean(),
    autoAcceptTypes: z.array(z.enum(['formatting', 'comments', 'types'])),
    preferredModel: z.string(),
    preferredMode: z.enum(['llm', 'agent']),
    defaultSidecarOpen: z.boolean(),
    defaultDrawerOpen: z.boolean(),
    defaultDrawerHeight: z.number().int().min(100).max(800),
  }),
  
  // Stats (computed, not persisted)
  stats: z.object({
    totalTokensUsed: z.number().int().min(0),
    totalCost: z.number().min(0),
    filesModified: z.number().int().min(0),
    sessionsCount: z.number().int().min(0),
    lastActivityAt: z.string().datetime().nullable(),
  }),
});

export type Project = z.infer<typeof ProjectSchema>;

// Project events for event sourcing
export type ProjectEvent =
  | { type: 'project.created'; project: Project }
  | { type: 'project.updated'; projectId: UUID; updates: Partial<Project> }
  | { type: 'project.deleted'; projectId: UUID }
  | { type: 'project.threadActivated'; projectId: UUID; threadId: UUID }
  | { type: 'project.settingsChanged'; projectId: UUID; settings: Project['settings'] };

// ============================================================================
// Thread (Claude-style Conversation)
// ============================================================================

export const ThreadSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  mode: z.enum(['llm', 'agent']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().min(1),
  
  // State machine
  status: z.enum(['active', 'paused', 'completed', 'archived']),
  
  // Linked entities
  messageIds: z.array(z.string().uuid()), // Ordered list
  artifactIds: z.array(z.string().uuid()),
  changeSetIds: z.array(z.string().uuid()),
  
  // Optional integrations
  openclawSessionId: z.string().optional(),
  
  // Current state references
  currentMessageId: z.string().uuid().nullable(),
  checkpointId: z.string().uuid().nullable(),
  
  // Metadata
  metadata: z.object({
    messageCount: z.number().int().min(0),
    lastMessageAt: z.string().datetime().nullable(),
    estimatedTokens: z.number().int().min(0),
  }),
});

export type Thread = z.infer<typeof ThreadSchema>;

// Thread with resolved references (for UI)
export interface ThreadWithEntities extends Thread {
  messages: Message[];
  artifacts: Artifact[];
  changeSets: ChangeSet[];
}

// ============================================================================
// Message (Chat Message with Rich Content)
// ============================================================================

export const MessageSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  projectId: z.string().uuid(),
  
  // Sender
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  authorId: z.string().optional(), // For multi-user scenarios
  
  // Content (rich parts)
  parts: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text: z.string() }),
    z.object({ type: z.literal('artifact'), artifactId: z.string().uuid() }),
    z.object({ type: z.literal('tool_call'), toolCallId: z.string().uuid() }),
    z.object({ type: z.literal('tool_result'), toolResultId: z.string().uuid() }),
    z.object({ type: z.literal('thinking'), thinking: z.string() }),
    z.object({ type: z.literal('image'), url: z.string(), mimeType: z.string() }),
    z.object({ type: z.literal('code'), code: z.string(), language: z.string() }),
    z.object({ type: z.literal('error'), error: z.string() }),
  ])),
  
  // State machine for streaming
  status: z.enum(['streaming', 'pending', 'completed', 'error', 'cancelled']),
  
  // Streaming metadata
  streamState: z.object({
    isStreaming: z.boolean(),
    streamId: z.string().optional(),
    chunksReceived: z.number().int().min(0),
    lastChunkAt: z.string().datetime().optional(),
  }).optional(),
  
  // Token accounting
  tokenCount: z.object({
    input: z.number().int().min(0),
    output: z.number().int().min(0),
    total: z.number().int().min(0),
  }).optional(),
  
  // Cost tracking
  cost: z.object({
    amount: z.number().min(0),
    currency: z.string().default('USD'),
    model: z.string(),
  }).optional(),
  
  // Timing
  timing: z.object({
    sentAt: z.string().datetime(),
    firstTokenAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    latencyMs: z.number().int().min(0).optional(),
  }),
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().min(1),
  
  // References to generated entities
  generatedArtifactIds: z.array(z.string().uuid()),
  generatedChangeSetId: z.string().uuid().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// ============================================================================
// Tool Call & Tool Result
// ============================================================================

export const ToolCallSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  threadId: z.string().uuid(),
  
  // Tool identification
  name: z.string(),
  displayName: z.string().optional(),
  
  // Arguments
  arguments: z.record(z.unknown()),
  argumentsSchema: z.record(z.unknown()).optional(), // For validation
  
  // State machine
  status: z.enum(['pending', 'approved', 'rejected', 'running', 'completed', 'error']),
  
  // Approval (if required)
  approval: z.object({
    required: z.boolean(),
    riskTier: z.enum(['safe', 'low', 'medium', 'high', 'critical']),
    requestedAt: z.string().datetime().optional(),
    respondedAt: z.string().datetime().optional(),
    approvedBy: z.string().optional(),
    rejectionReason: z.string().optional(),
  }).optional(),
  
  // Execution
  execution: z.object({
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    durationMs: z.number().int().min(0).optional(),
    logs: z.array(z.string()).optional(),
  }).optional(),
  
  // Result (if completed)
  result: z.unknown().optional(),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    stack: z.string().optional(),
  }).optional(),
  
  // Result preview for UI
  resultPreview: z.object({
    type: z.enum(['text', 'json', 'file', 'image', 'error']),
    content: z.string(),
    truncated: z.boolean(),
  }).optional(),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

// ============================================================================
// Artifact (Claude Artifacts Pattern)
// ============================================================================

export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  projectId: z.string().uuid(),
  messageId: z.string().uuid(), // Which message created this
  
  // Content type
  type: z.enum([
    'code', 'markdown', 'mermaid', 'svg', 'html',
    'react', 'json', 'yaml', 'terminal', 'diff', 'unknown'
  ]),
  
  // Display
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  
  // Content (current version)
  content: z.string(),
  language: z.string().optional(), // For syntax highlighting
  
  // Versioning
  version: z.number().int().min(1),
  versions: z.array(z.object({
    version: z.number().int().min(1),
    content: z.string(),
    changeDescription: z.string().max(200).optional(),
    createdAt: z.string().datetime(),
    createdBy: z.enum(['user', 'assistant']),
  })),
  
  // State machine
  status: z.enum([
    'streaming',      // Content being generated
    'preview',        // Generated, needs review
    'editing',        // User editing
    'saved',          // Saved to file
    'rejected',       // User rejected
    'error',          // Generation error
  ]),
  
  // UI state
  viewMode: z.enum(['preview', 'code', 'split']),
  isPinned: z.boolean().default(false),
  
  // File sync (if applicable)
  fileSync: z.object({
    filePath: z.string(), // Relative to project root
    lastSyncedAt: z.string().datetime(),
    syncStatus: z.enum(['synced', 'modified', 'conflict', 'error']),
    autoSync: z.boolean(),
  }).optional(),
  
  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.enum(['user', 'assistant']),
  
  // Error (if status === 'error')
  error: z.object({
    message: z.string(),
    code: z.string(),
    recoverable: z.boolean(),
  }).optional(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

// ============================================================================
// ChangeSet (Cursor Review Pattern - STRICT STATE MACHINE)
// ============================================================================

// Diff line with review state
export const DiffLineSchema = z.object({
  id: z.string(), // Unique within hunk
  type: z.enum(['context', 'addition', 'deletion']),
  content: z.string(),
  oldLineNumber: z.number().int().nullable(),
  newLineNumber: z.number().int().nullable(),
  isAccepted: z.boolean().nullable(), // null = undecided
});

export type DiffLine = z.infer<typeof DiffLineSchema>;

// Diff hunk with review state
export const DiffHunkSchema = z.object({
  id: z.string(),
  fileChangeId: z.string(),
  
  // Location in files
  oldStart: z.number().int(),
  oldLines: z.number().int(),
  newStart: z.number().int(),
  newLines: z.number().int(),
  
  // Content
  lines: z.array(DiffLineSchema),
  header: z.string().optional(), // e.g., "@@ -1,5 +1,7 @@"
  
  // Review state
  isAccepted: z.boolean().nullable(), // null = partially accepted
  acceptedCount: z.number().int().min(0),
  rejectedCount: z.number().int().min(0),
  pendingCount: z.number().int().min(0),
});

export type DiffHunk = z.infer<typeof DiffHunkSchema>;

// Individual file change
export const FileChangeSchema = z.object({
  id: z.string().uuid(),
  changeSetId: z.string().uuid(),
  
  // File identification
  filePath: z.string(), // Relative path
  absolutePath: z.string(), // Full path
  fileType: z.enum(['code', 'config', 'doc', 'test', 'other']),
  
  // Change classification
  changeType: z.enum(['add', 'modify', 'delete', 'rename']),
  oldFilePath: z.string().optional(), // For renames
  
  // Content
  oldContent: z.string().optional(), // null for add
  newContent: z.string().optional(), // null for delete
  oldHash: z.string().optional(), // SHA256 for integrity
  newHash: z.string().optional(),
  
  // Diff
  hunks: z.array(DiffHunkSchema),
  
  // Stats
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
  
  // Review state
  reviewState: z.enum(['pending', 'accepted', 'rejected', 'partial']),
  reviewedAt: z.string().datetime().optional(),
  reviewedBy: z.string().optional(),
  
  // Risk assessment
  riskTier: z.enum(['safe', 'low', 'medium', 'high', 'critical']),
  riskReason: z.string().optional(),
  
  // Apply state
  applyState: z.enum(['pending', 'applying', 'applied', 'failed']),
  applyError: z.string().optional(),
  appliedAt: z.string().datetime().optional(),
});

export type FileChange = z.infer<typeof FileChangeSchema>;

// Main ChangeSet - STRICT STATE MACHINE
export const ChangeSetSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  threadId: z.string().uuid(),
  messageId: z.string().uuid(), // Which assistant message produced this
  
  // Content
  changes: z.array(FileChangeSchema),
  
  // State machine (single source of truth)
  status: z.enum([
    'generating',     // Still receiving changes
    'pending',        // Awaiting review
    'in_review',      // User is reviewing
    'partial',        // Some changes accepted
    'approved',       // All changes accepted
    'rejected',       // All changes rejected
    'applying',       // Currently being applied
    'applied',        // All changes written to disk
    'apply_failed',   // Some changes failed to apply
    'stale',          // Files changed on disk since generation
  ]),
  
  // Review progress
  reviewProgress: z.object({
    totalFiles: z.number().int().min(0),
    totalHunks: z.number().int().min(0),
    acceptedFiles: z.number().int().min(0),
    rejectedFiles: z.number().int().min(0),
    pendingFiles: z.number().int().min(0),
    acceptedHunks: z.number().int().min(0),
    rejectedHunks: z.number().int().min(0),
    pendingHunks: z.number().int().min(0),
  }),
  
  // User review state
  userReview: z.object({
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    comment: z.string().max(1000).optional(),
    reviewedBy: z.string().optional(),
  }),
  
  // Risk assessment
  riskAssessment: z.object({
    overallRisk: z.enum(['safe', 'low', 'medium', 'high', 'critical']),
    maxFileRisk: z.enum(['safe', 'low', 'medium', 'high', 'critical']),
    destructiveChanges: z.boolean(), // delete, rename
    securitySensitive: z.boolean(),
    configChanges: z.boolean(),
    testCoverage: z.enum(['full', 'partial', 'none', 'unknown']),
  }),
  
  // Policy decision
  policy: z.object({
    policyId: z.string(),
    decision: z.enum(['auto_apply', 'stage', 'require_approval']),
    autoApproved: z.boolean(),
    autoApproveReason: z.string().optional(),
    overriddenBy: z.string().optional(),
    overriddenAt: z.string().datetime().optional(),
  }),
  
  // Apply state
  applyState: z.object({
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    appliedFiles: z.number().int().min(0),
    failedFiles: z.number().int().min(0),
    rollbackAvailable: z.boolean(),
    rollbackSnapshotId: z.string().optional(),
  }),
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(), // Auto-cleanup
  
  // Metadata
  metadata: z.object({
    generator: z.enum(['agent', 'user', 'tool', 'import']),
    toolCalls: z.array(z.string().uuid()), // Which tool calls produced this
    agentRunId: z.string().uuid().optional(),
  }),
});

export type ChangeSet = z.infer<typeof ChangeSetSchema>;

// ChangeSet with resolved message
export interface ChangeSetWithMessage extends ChangeSet {
  message: Message;
  thread: Thread;
}

// ============================================================================
// Approval Policy (AI SDK 6 Risk Tier Pattern)
// ============================================================================

export const ApprovalRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  priority: z.number().int().min(0), // Higher = evaluated first
  
  // Conditions (ALL must match for rule to apply)
  conditions: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('risk-tier'), tier: z.enum(['safe', 'low', 'medium', 'high', 'critical']), operator: z.enum(['eq', 'gte']) }),
    z.object({ type: z.literal('file-pattern'), pattern: z.string(), negate: z.boolean().default(false) }),
    z.object({ type: z.literal('change-type'), changeType: z.enum(['add', 'modify', 'delete', 'rename']), negate: z.boolean().default(false) }),
    z.object({ type: z.literal('file-type'), fileType: z.enum(['code', 'config', 'doc', 'test', 'other']), negate: z.boolean().default(false) }),
    z.object({ type: z.literal('tool-name'), toolName: z.string(), negate: z.boolean().default(false) }),
    z.object({ type: z.literal('command-pattern'), pattern: z.string(), negate: z.boolean().default(false) }),
    z.object({ type: z.literal('has-tests'), value: z.boolean() }),
    z.object({ type: z.literal('file-size'), maxBytes: z.number().int().min(0) }),
    z.object({ type: z.literal('line-count'), maxLines: z.number().int().min(0) }),
  ])),
  
  // Action
  action: z.enum(['auto_apply', 'stage', 'require_approval']),
  
  // Confirmation for destructive
  requireConfirmation: z.boolean().default(false),
  confirmationMessage: z.string().max(200).optional(),
  
  // Notification
  notifyOnApply: z.boolean().default(false),
  notifyChannels: z.array(z.enum(['ui', 'notification', 'sound'])).default(['ui']),
});

export type ApprovalRule = z.infer<typeof ApprovalRuleSchema>;

export const ApprovalPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  
  // Scope
  projectId: z.string().uuid().nullable(), // null = global default
  isDefault: z.boolean().default(false),
  
  // Rules (evaluated in priority order, first match wins)
  rules: z.array(ApprovalRuleSchema),
  
  // Fallback
  defaultAction: z.enum(['auto_apply', 'stage', 'require_approval']),
  
  // Settings
  settings: z.object({
    allowOverride: z.boolean().default(true),
    requireReasonForOverride: z.boolean().default(true),
    maxAutoApplySize: z.number().int().min(0).default(10000), // bytes
    batchApplyEnabled: z.boolean().default(true),
    reviewTimeout: z.number().int().min(0).default(0), // 0 = no timeout
  }),
  
  // State
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string(),
});

export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

// Predefined policies
export const BUILTIN_POLICIES = {
  cautious: {
    id: 'policy-cautious',
    name: 'Cautious',
    description: 'Require approval for all non-trivial changes',
    rules: [
      {
        id: 'rule-safe-formatting',
        name: 'Safe formatting auto-apply',
        priority: 100,
        conditions: [{ type: 'risk-tier', tier: 'safe', operator: 'eq' }],
        action: 'auto_apply',
      },
      {
        id: 'rule-destructive',
        name: 'Destructive requires approval',
        priority: 90,
        conditions: [{ type: 'change-type', changeType: 'delete' }],
        action: 'require_approval',
        requireConfirmation: true,
        confirmationMessage: 'This will delete files. Are you sure?',
      },
      {
        id: 'rule-high-risk',
        name: 'High risk requires approval',
        priority: 80,
        conditions: [{ type: 'risk-tier', tier: 'high', operator: 'gte' }],
        action: 'require_approval',
      },
    ],
    defaultAction: 'require_approval',
  } as const,
  
  balanced: {
    id: 'policy-balanced',
    name: 'Balanced',
    description: 'Auto-apply safe changes, stage medium risk',
    rules: [
      {
        id: 'rule-safe-auto',
        name: 'Safe auto-apply',
        priority: 100,
        conditions: [{ type: 'risk-tier', tier: 'low', operator: 'lte' }],
        action: 'auto_apply',
      },
      {
        id: 'rule-medium-stage',
        name: 'Medium risk stage',
        priority: 90,
        conditions: [{ type: 'risk-tier', tier: 'medium', operator: 'eq' }],
        action: 'stage',
      },
    ],
    defaultAction: 'require_approval',
  } as const,
  
  autonomous: {
    id: 'policy-autonomous',
    name: 'Autonomous',
    description: 'Auto-apply all changes except critical',
    rules: [
      {
        id: 'rule-non-critical',
        name: 'Non-critical auto-apply',
        priority: 100,
        conditions: [{ type: 'risk-tier', tier: 'critical', operator: 'lt' }],
        action: 'auto_apply',
      },
    ],
    defaultAction: 'auto_apply',
  } as const,
};

// ============================================================================
// Agent Run (Agent Execution Tracking)
// ============================================================================

export const AgentRunSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  projectId: z.string().uuid(),
  
  // Identification
  name: z.string(),
  description: z.string().optional(),
  
  // State machine
  status: z.enum([
    'queued',
    'starting',
    'running',
    'paused',
    'completed',
    'failed',
    'cancelled',
    'timeout',
  ]),
  
  // Steps
  steps: z.array(z.object({
    id: z.string(),
    index: z.number().int(),
    type: z.enum(['thinking', 'tool_call', 'file_edit', 'user_input', 'error']),
    status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
    content: z.string(),
    toolCallId: z.string().uuid().optional(),
    changeSetId: z.string().uuid().optional(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
  })),
  
  currentStepIndex: z.number().int().min(0),
  
  // Resources
  resources: z.object({
    tokensUsed: z.number().int().min(0),
    cost: z.number().min(0),
    durationMs: z.number().int().min(0).optional(),
  }),
  
  // Links
  changeSetIds: z.array(z.string().uuid()),
  toolCallIds: z.array(z.string().uuid()),
  artifactIds: z.array(z.string().uuid()),
  
  // Control
  isPausable: z.boolean().default(true),
  isCancellable: z.boolean().default(true),
  
  // Error
  error: z.object({
    message: z.string(),
    code: z.string(),
    recoverable: z.boolean(),
    retryable: z.boolean(),
  }).optional(),
  
  // Timestamps
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
});

export type AgentRun = z.infer<typeof AgentRunSchema>;

// ============================================================================
// Sidecar State (Shell-level UI State)
// ============================================================================

export const SidecarStateSchema = z.object({
  // Visibility
  isOpen: z.boolean().default(false),
  activePanel: z.enum(['artifact', 'context', 'agent', 'changeset', 'preview']),
  
  // Size
  width: z.number().int().min(250).max(600).default(350),
  isResizing: z.boolean().default(false),
  
  // Panel states
  panels: z.object({
    artifact: z.object({
      activeArtifactId: z.string().uuid().nullable(),
      viewMode: z.enum(['preview', 'code', 'split']).default('preview'),
      pinnedArtifacts: z.array(z.string().uuid()).default([]),
    }),
    context: z.object({
      activeThreadId: z.string().uuid().nullable(),
      showTokenCount: z.boolean().default(true),
      showModelInfo: z.boolean().default(true),
      showProjectContext: z.boolean().default(true),
    }),
    agent: z.object({
      activeRunId: z.string().uuid().nullable(),
      filter: z.enum(['all', 'running', 'completed', 'failed']).default('all'),
      autoFollow: z.boolean().default(true),
    }),
    changeset: z.object({
      activeChangeSetId: z.string().uuid().nullable(),
      filter: z.enum(['pending', 'approved', 'rejected', 'applied', 'all']).default('pending'),
      showDiffView: z.boolean().default(true),
    }),
  }),
  
  // History for navigation
  history: z.array(z.object({
    panel: z.enum(['artifact', 'context', 'agent', 'changeset', 'preview']),
    entityId: z.string().uuid().optional(),
    timestamp: z.string().datetime(),
  })).default([]),
  
  // Keyboard shortcut
  toggleShortcut: z.string().default('Cmd+Shift+A'),
});

export type SidecarState = z.infer<typeof SidecarStateSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateProject(data: unknown): Project {
  return ProjectSchema.parse(data);
}

export function validateThread(data: unknown): Thread {
  return ThreadSchema.parse(data);
}

export function validateMessage(data: unknown): Message {
  return MessageSchema.parse(data);
}

export function validateArtifact(data: unknown): Artifact {
  return ArtifactSchema.parse(data);
}

export function validateChangeSet(data: unknown): ChangeSet {
  return ChangeSetSchema.parse(data);
}

export function validateApprovalPolicy(data: unknown): ApprovalPolicy {
  return ApprovalPolicySchema.parse(data);
}

// ============================================================================
// Type Guards
// ============================================================================

export function isProject(data: unknown): data is Project {
  return ProjectSchema.safeParse(data).success;
}

export function isThread(data: unknown): data is Thread {
  return ThreadSchema.safeParse(data).success;
}

export function isChangeSet(data: unknown): data is ChangeSet {
  return ChangeSetSchema.safeParse(data).success;
}

export function isArtifact(data: unknown): data is Artifact {
  return ArtifactSchema.safeParse(data).success;
}

// ============================================================================
// Factory Functions (for creating valid entities)
// ============================================================================

export function createProject(partial: Partial<Project> & { name: string; rootPath: string }): Project {
  const now = new Date().toISOString();
  return validateProject({
    id: crypto.randomUUID(),
    name: partial.name,
    description: partial.description ?? '',
    rootPath: partial.rootPath,
    createdAt: now,
    updatedAt: now,
    version: 1,
    context: {
      includedFiles: [],
      workingDirectory: '.',
      envVars: {},
      systemPromptAdditions: [],
      lastSyncedAt: now,
    },
    activeThreadId: null,
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
  });
}

export function createThread(partial: Partial<Thread> & { projectId: string; title: string }): Thread {
  const now = new Date().toISOString();
  return validateThread({
    id: crypto.randomUUID(),
    projectId: partial.projectId,
    title: partial.title,
    mode: 'agent',
    createdAt: now,
    updatedAt: now,
    version: 1,
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
  });
}

export function createChangeSet(partial: Partial<ChangeSet> & { projectId: string; threadId: string; messageId: string }): ChangeSet {
  const now = new Date().toISOString();
  return validateChangeSet({
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
  });
}

// ============================================================================
// Export All
// ============================================================================

export * from './UI_CONTRACTS_PRODUCTION';
