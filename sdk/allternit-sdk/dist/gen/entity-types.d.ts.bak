// Auto-generated entity types from OpenAPI spec
// These are extracted from response schemas to provide proper type safety

/** Message base entity */
export interface Message {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  time: {
    created: number;
    completed?: number;
  };
  agent: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  format?: {
    type: 'text' | 'json_schema';
    schema?: Record<string, unknown>;
    retryCount?: number;
  };
  system?: string;
  variant?: string;
}

/** Session entity */
export interface Session {
  id: string;
  directory: string;
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;
  };
  parentID?: string;
  summary?: {
    additions: number;
    deletions: number;
    files: number;
  };
  share?: {
    url: string;
  };
  revert?: {
    messageID: string;
    partID?: string;
  };
}

/** Part base */
interface PartBase {
  id: string;
  sessionID: string;
  messageID: string;
}

/** Part entity - discriminated union (matches server MessageV2.Part) */
export type Part =
  | TextPart
  | FilePart
  | ToolPart
  | AgentPart
  | CompactionPart
  | ReasoningPart
  | SubtaskPart
  | RetryPart
  | StepStartPart
  | StepFinishPart
  | SnapshotPart
  | PatchPart;

export interface TextPart extends PartBase {
  type: 'text';
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
  time?: { start: number; end?: number };
  metadata?: Record<string, unknown>;
}

export interface FilePart extends PartBase {
  type: 'file';
  mime: string;
  url: string;
  filename?: string;
  source?: {
    text: { value: string; start: number; end: number };
    type: 'file';
    path: string;
  } | {
    text: { value: string; start: number; end: number };
    type: 'symbol';
    path: string;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    name: string;
    kind: number;
  } | {
    text: { value: string; start: number; end: number };
    type: 'resource';
    clientName: string;
    uri: string;
  };
}

export interface ToolPart extends PartBase {
  type: 'tool';
  tool: string;
  callID: string;
  metadata?: Record<string, unknown>;
  state:
    | { status: 'pending'; input: Record<string, unknown>; raw: string }
    | { status: 'running'; input: Record<string, unknown>; title?: string; metadata?: Record<string, unknown>; time: { start: number } }
    | { status: 'completed'; input: Record<string, unknown>; output: string; title: string; metadata: Record<string, unknown>; time: { start: number; end: number; compacted?: number } }
    | { status: 'error'; input: Record<string, unknown>; error: string; metadata?: Record<string, unknown>; time: { start: number; end: number } };
}

export interface AgentPart extends PartBase {
  type: 'agent';
  name: string;
  source?: { value: string; start: number; end: number };
}

export interface CompactionPart extends PartBase {
  type: 'compaction';
  auto: boolean;
}

export interface ReasoningPart extends PartBase {
  type: 'reasoning';
  text: string;
  time: { start: number; end?: number };
  metadata?: Record<string, unknown>;
}

export interface SubtaskPart extends PartBase {
  type: 'subtask';
  prompt: string;
  description: string;
  agent: string;
  model?: { providerID: string; modelID: string };
  command?: string;
}

export interface RetryPart extends PartBase {
  type: 'retry';
  attempt: number;
  error: {
    name?: string;
    message: string;
    statusCode?: number;
    isRetryable: boolean;
    [key: string]: unknown;
  };
  time: { created: number };
}

export interface StepStartPart extends PartBase {
  type: 'step-start';
  snapshot?: string;
}

export interface StepFinishPart extends PartBase {
  type: 'step-finish';
  reason?: string;
  snapshot?: string;
  cost: number;
  tokens: {
    total?: number;
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
}

export interface SnapshotPart extends PartBase {
  type: 'snapshot';
  snapshot: string;
}

export interface PatchPart extends PartBase {
  type: 'patch';
  hash: string;
  files: string[];
}

/** Agent entity */
export interface Agent {
  name: string;
  description?: string;
  mode: 'all' | 'subagent' | 'primary';
  role?: string;
  permission: Array<{
    permission: string;
    pattern: string;
    action: 'ask' | 'allow' | 'deny';
  }>;
  options: Record<string, unknown>;
  hidden?: boolean;
  model?: { providerID: string; modelID: string };
  prompt?: { system?: string };
  skills?: string[];
  steps?: number;
}

/** Provider entity */
export interface Provider {
  id: string;
  name: string;
  models: Record<string, Model>;
}

/** Model entity */
export interface Model {
  id: string;
  name: string;
  providerID: string;
}

/** Config entity */
export interface Config {
  theme?: string;
  keybinds?: KeybindsConfig;
  editor?: string;
  [key: string]: unknown;
}

/** Keybinds configuration */
export interface KeybindsConfig {
  leader: string;
  [key: string]: string;
}

/** Command entity */
export interface Command {
  id: string;
  name: string;
  description?: string;
}

/** Session status */
export type SessionStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'retry'; attempt: number; message: string; next: number };

/** User message (role: 'user') */
export type UserMessage = Message & {
  role: 'user';
  summary?: {
    title?: string;
    body?: string;
    diffs: Array<{ file: string; before: string; after: string; additions: number; deletions: number; status?: 'added' | 'deleted' | 'modified' }>;
  };
  tools?: Record<string, boolean>;
};

/** Assistant message (role: 'assistant') */
export type AssistantMessage = Message & {
  role: 'assistant';
  parentID: string;
  providerID: string;
  modelID: string;
  mode: string;
  path: { cwd: string; root: string };
  tokens: {
    total?: number;
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
  cost: number;
  summary?: boolean;
  error?: {
    name: string;
    message: string;
    data?: unknown;
    retries?: number;
    statusCode?: number;
    isRetryable?: boolean;
    providerID?: string;
  };
  finish?: string;
};

/** Event from server — OpenAPI union extended with undocumented server events */
export type Event =
  | import('./types.gen.js').EventSubscribeResponse
  | { type: 'user.updated'; properties: { user: Record<string, unknown> } };

/** Todo item (matches server Todo.Info) */
export interface Todo {
  content: string;
  status: string;
  priority: string;
}

export interface McpResource {
  id: string;
  name: string;
  content?: string;
}

export interface QuestionAnswer {
  value: string;
  label: string;
}

export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  pattern: string;
  action: 'ask' | 'allow' | 'deny';
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  question: string;
  options?: QuestionAnswer[];
  allowMultiple?: boolean;
  allowFreeform?: boolean;
}

export interface LspStatus {
  id: string;
  name: string;
  root: string;
  status: 'error' | 'connected';
}

export interface McpStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
}

export interface FormatterStatus {
  name: string;
  enabled: boolean;
}

export interface ProviderListResponse {
  all: Provider[];
  default: Record<string, string>;
  connected: string[];
}

export interface ProviderAuthMethod {
  id: string;
  name: string;
  type: 'oauth' | 'api_key';
}

export interface ProviderAuthAuthorization {
  url: string;
  state: string;
}

export interface FileDiff {
  path: string;
  added: number;
  removed: number;
}

export interface VcsInfo {
  branch: string;
  commit?: string;
  dirty?: boolean;
}

export interface SessionMessageResponse {
  messages: Message[];
}

/** Path info from /path endpoint */
export interface Path {
  home: string;
  state: string;
  config: string;
  worktree: string;
  directory: string;
}

// Legacy alias
export type GIZZIClient = import('./a2r-client.js').A2RClient;
