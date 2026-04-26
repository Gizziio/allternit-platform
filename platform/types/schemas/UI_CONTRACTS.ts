/**
 * Allternit UI Contracts
 * 
 * TypeScript interfaces for core patterns:
 * - Project (Codex-style project management)
 * - Thread (Claude-style conversations)
 * - Artifact (Claude Artifacts)
 * - ChangeSet (Cursor-style diff review)
 * - ApprovalPolicy (AI SDK 6 risk tiers)
 * - SchemaUI (json-render style generative UI)
 */

// ============================================================================
// Project (Codex App Pattern)
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  rootPath: string; // File system root for this project
  createdAt: Date;
  updatedAt: Date;
  
  // Context pack
  context: ProjectContext;
  
  // Sessions
  threads: Thread[];
  activeThreadId: string | null;
  
  // Settings
  settings: ProjectSettings;
  
  // Stats
  stats: ProjectStats;
}

export interface ProjectContext {
  // Files the agent should know about
  includedFiles: string[];
  
  // Current working directory relative to rootPath
  workingDirectory: string;
  
  // Environment variables for this project
  envVars: Record<string, string>;
  
  // System prompt additions
  systemPromptAdditions: string[];
  
  // Last synced at
  lastSyncedAt: Date;
}

export interface ProjectSettings {
  // Auto-apply settings
  autoAcceptSafeEdits: boolean;
  autoAcceptTypes: ('formatting' | 'comments' | 'types')[];
  
  // Model preferences per project
  preferredModel: string;
  preferredMode: 'llm' | 'agent';
  
  // UI preferences
  defaultSidecarOpen: boolean;
  defaultDrawerOpen: boolean;
}

export interface ProjectStats {
  totalTokensUsed: number;
  totalCost: number;
  filesModified: number;
  sessionsCount: number;
}

// ============================================================================
// Thread (Claude-style Conversation)
// ============================================================================

export interface Thread {
  id: string;
  projectId: string;
  title: string;
  mode: 'llm' | 'agent';
  createdAt: Date;
  updatedAt: Date;
  
  // Messages
  messages: Message[];
  
  // Linked artifacts
  artifactIds: string[];
  
  // Session state
  status: 'active' | 'paused' | 'completed';
  
  // Optional OpenClaw integration
  openclawSessionId?: string;
}

export interface Message {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: MessageContent[];
  createdAt: Date;
  
  // Token usage
  tokenCount?: {
    input: number;
    output: number;
  };
  
  // Cost
  cost?: number;
  
  // Timing
  latency?: number;
  
  // Optional: Linked artifacts created in this message
  artifactIds?: string[];
  
  // Optional: Tool calls made in this message
  toolCalls?: ToolCall[];
  
  // Optional: Checkpoint for this message state
  checkpointId?: string;
}

export type MessageContent = 
  | { type: 'text'; text: string }
  | { type: 'artifact'; artifactId: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'tool_result'; toolResult: ToolResult }
  | { type: 'thinking'; thinking: string }
  | { type: 'image'; url: string; mimeType: string }
  | { type: 'code'; code: string; language: string };

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: unknown;
  error?: string;
}

export interface ToolResult {
  toolCallId: string;
  output: unknown;
  isError: boolean;
}

// ============================================================================
// Artifact (Claude Artifacts Pattern)
// ============================================================================

export interface Artifact {
  id: string;
  threadId: string;
  projectId: string;
  
  // Content
  type: ArtifactType;
  title: string;
  content: string;
  language?: string; // For code artifacts
  
  // State
  version: number;
  versions: ArtifactVersion[];
  
  // UI State
  status: ArtifactStatus;
  viewMode: ArtifactViewMode;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: 'user' | 'assistant';
  
  // Optional: Link to file if saved
  filePath?: string;
}

export type ArtifactType = 
  | 'code'           // Source code files
  | 'markdown'       // Documentation
  | 'mermaid'        // Diagrams
  | 'svg'            // Vector graphics
  | 'html'           // Web content
  | 'react'          // React components
  | 'json'           // Data
  | 'yaml'           // Config
  | 'terminal'       // Command output
  | 'diff';          // Change preview

export interface ArtifactVersion {
  version: number;
  content: string;
  createdAt: Date;
  changeDescription?: string;
}

export type ArtifactStatus = 
  | 'streaming'      // Content is being generated
  | 'preview'        // Generated, needs review
  | 'editing'        // User is editing
  | 'saved'          // Saved to file
  | 'rejected';      // User rejected

export type ArtifactViewMode = 
  | 'preview'        // Rendered view
  | 'code'           // Source view
  | 'split';         // Side-by-side

// ============================================================================
// ChangeSet (Cursor Review Pattern)
// ============================================================================

export interface ChangeSet {
  id: string;
  projectId: string;
  threadId: string;
  messageId: string; // Which message produced this change set
  
  // Content
  changes: FileChange[];
  
  // State
  status: ChangeSetStatus;
  
  // Review state
  reviewState: ChangeSetReviewState;
  
  // Risk assessment
  riskTier: RiskTier;
  
  // Metadata
  createdAt: Date;
  appliedAt?: Date;
  
  // Policy decision
  requiresApproval: boolean;
  autoApproved: boolean;
  autoApproveReason?: string;
}

export interface FileChange {
  id: string;
  changeSetId: string;
  
  // File info
  filePath: string;
  fileType: 'code' | 'config' | 'doc' | 'test' | 'other';
  
  // Change type
  changeType: 'add' | 'modify' | 'delete' | 'rename';
  
  // Content
  oldContent?: string;
  newContent?: string;
  diff: DiffHunk[];
  
  // Review state
  reviewState: FileReviewState;
  
  // Risk
  riskTier: RiskTier;
  
  // Stats
  additions: number;
  deletions: number;
}

export interface DiffHunk {
  id: string;
  fileChangeId: string;
  
  // Location
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  
  // Content
  lines: DiffLine[];
  
  // Review
  isAccepted: boolean | null; // null = undecided
}

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  lineNumber: number;
  isAccepted: boolean | null;
}

export type ChangeSetStatus = 
  | 'pending'        // Awaiting review
  | 'partial'        // Some changes accepted
  | 'approved'       // All changes accepted, ready to apply
  | 'rejected'       // All changes rejected
  | 'applied'        // Changes written to disk
  | 'failed';        // Apply failed

export interface ChangeSetReviewState {
  // Counts
  totalFiles: number;
  totalHunks: number;
  acceptedHunks: number;
  rejectedHunks: number;
  pendingHunks: number;
  
  // User decisions
  userComment?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export type FileReviewState = 
  | 'pending'        // Not reviewed
  | 'accepted'       // Accept all hunks
  | 'rejected'       // Reject all hunks
  | 'partial';       // Some hunks accepted

export type RiskTier = 
  | 'safe'           // Formatting, comments, safe refactors
  | 'low'            // Type changes, simple edits
  | 'medium'         // Logic changes, multiple files
  | 'high'           // Destructive changes, deletes, renames
  | 'critical';      // Security-sensitive, config changes

// ============================================================================
// ApprovalPolicy (AI SDK 6 Pattern)
// ============================================================================

export interface ApprovalPolicy {
  id: string;
  projectId?: string; // Global if undefined
  name: string;
  description: string;
  
  // Rules
  rules: ApprovalRule[];
  
  // Default behavior
  defaultAction: 'auto-apply' | 'stage' | 'require-approval';
  
  // Enabled
  isActive: boolean;
}

export interface ApprovalRule {
  id: string;
  name: string;
  
  // Conditions (all must match)
  conditions: ApprovalCondition[];
  
  // Action
  action: 'auto-apply' | 'stage' | 'require-approval';
  
  // Optional: Require additional confirmation for destructive
  requireConfirmation?: boolean;
  confirmationMessage?: string;
}

export type ApprovalCondition =
  | { type: 'risk-tier'; tier: RiskTier; operator: 'eq' | 'gte' }
  | { type: 'file-pattern'; pattern: string } // glob pattern
  | { type: 'change-type'; changeType: FileChange['changeType'] }
  | { type: 'file-type'; fileType: FileChange['fileType'] }
  | { type: 'tool-name'; toolName: string }
  | { type: 'command-pattern'; pattern: string }; // for terminal commands

// Predefined policies
export const DEFAULT_POLICIES: Record<string, ApprovalPolicy> = {
  cautious: {
    id: 'cautious',
    name: 'Cautious',
    description: 'Require approval for all non-trivial changes',
    rules: [
      {
        id: 'safe-edits',
        name: 'Safe edits auto-apply',
        conditions: [{ type: 'risk-tier', tier: 'safe', operator: 'eq' }],
        action: 'auto-apply',
      },
      {
        id: 'destructive-requires-approval',
        name: 'Destructive changes require approval',
        conditions: [
          { type: 'change-type', changeType: 'delete' },
          { type: 'risk-tier', tier: 'high', operator: 'gte' },
        ],
        action: 'require-approval',
        requireConfirmation: true,
        confirmationMessage: 'This will delete files. Are you sure?',
      },
    ],
    defaultAction: 'require-approval',
    isActive: false,
  },
  
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    description: 'Auto-apply safe changes, stage medium risk',
    rules: [
      {
        id: 'safe-auto',
        name: 'Safe auto-apply',
        conditions: [{ type: 'risk-tier', tier: 'low', operator: 'lte' }],
        action: 'auto-apply',
      },
      {
        id: 'medium-stage',
        name: 'Medium risk stage',
        conditions: [{ type: 'risk-tier', tier: 'medium', operator: 'eq' }],
        action: 'stage',
      },
    ],
    defaultAction: 'require-approval',
    isActive: true,
  },
  
  autonomous: {
    id: 'autonomous',
    name: 'Autonomous',
    description: 'Auto-apply all changes except critical',
    rules: [
      {
        id: 'non-critical-auto',
        name: 'Non-critical auto-apply',
        conditions: [{ type: 'risk-tier', tier: 'critical', operator: 'lt' }],
        action: 'auto-apply',
      },
    ],
    defaultAction: 'auto-apply',
    isActive: false,
  },
};

// ============================================================================
// SchemaUI (json-render Pattern)
// ============================================================================

export interface SchemaUI {
  version: '1.0';
  id: string;
  title: string;
  description?: string;
  
  // Component definitions
  components: SchemaComponent[];
  
  // Root component
  root: string; // Reference to component id
  
  // Data model
  dataModel: Record<string, SchemaDataField>;
  
  // Actions
  actions: SchemaAction[];
}

export interface SchemaComponent {
  id: string;
  type: SchemaComponentType;
  props: Record<string, unknown>;
  children?: string[]; // References to child component ids
  conditional?: SchemaCondition; // Show/hide condition
}

export type SchemaComponentType =
  // Layout
  | 'Container'
  | 'Stack'
  | 'Grid'
  | 'Card'
  | 'SplitPane'
  | 'Tabs'
  
  // Form elements
  | 'TextField'
  | 'TextArea'
  | 'NumberField'
  | 'Select'
  | 'MultiSelect'
  | 'Checkbox'
  | 'Switch'
  | 'RadioGroup'
  | 'DatePicker'
  | 'FileUpload'
  
  // Display
  | 'Text'
  | 'Heading'
  | 'Badge'
  | 'Progress'
  | 'Spinner'
  | 'Alert'
  | 'Code'
  | 'Markdown'
  
  // Interactive
  | 'Button'
  | 'ButtonGroup'
  | 'IconButton'
  | 'Menu'
  | 'Dialog'
  
  // Data display
  | 'List'
  | 'Table'
  | 'DataTable'
  | 'Tree'
  | 'Timeline'
  | 'Chart'
  
  // AI-specific
  | 'Message'
  | 'MessageGroup'
  | 'StreamingText'
  | 'ToolCall'
  | 'Thinking'
  | 'Artifact'
  | 'Checkpoint'
  | 'Plan';

export interface SchemaDataField {
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  defaultValue?: unknown;
  validation?: SchemaValidation[];
}

export interface SchemaValidation {
  type: 'required' | 'min' | 'max' | 'pattern' | 'email' | 'custom';
  value?: unknown;
  message: string;
}

export interface SchemaAction {
  id: string;
  name: string;
  trigger: 'onClick' | 'onSubmit' | 'onChange' | 'onLoad';
  targetComponent?: string;
  handler: 
    | { type: 'submit'; endpoint: string; method: 'POST' | 'PUT' }
    | { type: 'navigate'; to: string }
    | { type: 'update-data'; path: string; value: unknown }
    | { type: 'open-dialog'; dialogId: string }
    | { type: 'close-dialog'; dialogId: string }
    | { type: 'custom'; handlerId: string };
}

export interface SchemaCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

// ============================================================================
// Sidecar State (Shell-level UI State)
// ============================================================================

export interface SidecarState {
  // Visibility
  isOpen: boolean;
  activePanel: SidecarPanel;
  
  // Panel-specific state
  panels: {
    artifact: ArtifactPanelState;
    context: ContextPanelState;
    agent: AgentPanelState;
    changeset: ChangeSetPanelState;
  };
  
  // Size
  width: number; // pixels or percentage
}

export type SidecarPanel = 'artifact' | 'context' | 'agent' | 'changeset';

export interface ArtifactPanelState {
  activeArtifactId: string | null;
  viewMode: ArtifactViewMode;
}

export interface ContextPanelState {
  activeThreadId: string | null;
  showTokenCount: boolean;
  showModelInfo: boolean;
}

export interface AgentPanelState {
  activeRunId: string | null;
  filter: 'all' | 'running' | 'completed' | 'failed';
}

export interface ChangeSetPanelState {
  activeChangeSetId: string | null;
  filter: 'pending' | 'approved' | 'rejected' | 'applied';
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export interface KeyboardShortcut {
  id: string;
  name: string;
  keys: string; // e.g., "Cmd+Shift+A"
  scope: 'global' | 'chat' | 'code' | 'artifact';
  action: () => void;
  description: string;
}

export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  {
    id: 'toggle-artifacts',
    name: 'Toggle Artifacts Sidecar',
    keys: 'Cmd+Shift+A',
    scope: 'global',
    action: () => {}, // Implemented by component
    description: 'Show/hide the artifacts sidecar panel',
  },
  {
    id: 'toggle-terminal',
    name: 'Toggle Terminal Drawer',
    keys: 'Cmd+J',
    scope: 'global',
    action: () => {},
    description: 'Show/hide the terminal drawer',
  },
  {
    id: 'focus-chat',
    name: 'Focus Chat Input',
    keys: 'Cmd+L',
    scope: 'global',
    action: () => {},
    description: 'Focus the chat input field',
  },
  {
    id: 'accept-change',
    name: 'Accept Current Change',
    keys: 'Cmd+Y',
    scope: 'code',
    action: () => {},
    description: 'Accept the current diff hunk',
  },
  {
    id: 'reject-change',
    name: 'Reject Current Change',
    keys: 'Cmd+N',
    scope: 'code',
    action: () => {},
    description: 'Reject the current diff hunk',
  },
  {
    id: 'next-change',
    name: 'Next Change',
    keys: 'Cmd+Down',
    scope: 'code',
    action: () => {},
    description: 'Navigate to next diff hunk',
  },
  {
    id: 'prev-change',
    name: 'Previous Change',
    keys: 'Cmd+Up',
    scope: 'code',
    action: () => {},
    description: 'Navigate to previous diff hunk',
  },
];
