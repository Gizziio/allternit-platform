/**
 * Reply Contract types for agent conversation streaming.
 * Extracted from the private @allternit/replies-contract package.
 */

export type ReplyItemKind =
  | 'text'
  | 'reasoning'
  | 'tool_call'
  | 'artifact'
  | 'citation'
  | 'mcp_app'
  | 'code'
  | 'terminal'
  | 'plan'
  | 'file_op';

export interface TextReplyItem {
  kind: 'text';
  content: string;
  timestamp: number;
}

export interface ReasoningReplyItem {
  kind: 'reasoning';
  content: string;
  timestamp: number;
}

export type ToolCallState = 'queued' | 'running' | 'done' | 'error';

export interface ToolCallReplyItem {
  kind: 'tool_call';
  id?: string;
  toolName: string;
  title?: string;
  input: unknown;
  output?: string;
  state: ToolCallState;
  duration?: number;
  timestamp: number;
  progressLines?: string[];
}

export interface ArtifactReplyItem {
  kind: 'artifact';
  id?: string;
  artifactId: string;
  title: string;
  artifactType?: string;
  type: string;
  url?: string;
  timestamp: number;
}

export interface CitationRef {
  sourceId: string;
  title: string;
  url?: string;
}

export interface CitationReplyItem {
  kind: 'citation';
  citations: CitationRef[];
  items?: CitationRef[];
  timestamp: number;
}

export interface McpAppReplyItem {
  kind: 'mcp_app';
  capsuleId: string;
  timestamp: number;
}

export interface CodeReplyItem {
  kind: 'code';
  language: string;
  code: string;
  timestamp: number;
}

export type TerminalStatus = 'running' | 'completed' | 'error';

export interface TerminalReplyItem {
  kind: 'terminal';
  output: string;
  status: TerminalStatus;
  exitCode?: number;
  timestamp: number;
}

export type PlanStepStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  status: PlanStepStatus;
  toolName?: string;
}

export interface PlanReplyItem {
  kind: 'plan';
  steps: PlanStep[];
  timestamp: number;
}

export type FileOpKind = 'read' | 'write' | 'delete' | 'rename' | 'create';

export interface FileOpReplyItem {
  kind: 'file_op';
  operation: FileOpKind;
  path: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

export type ReplyItem =
  | TextReplyItem
  | ReasoningReplyItem
  | ToolCallReplyItem
  | ArtifactReplyItem
  | CitationReplyItem
  | McpAppReplyItem
  | CodeReplyItem
  | TerminalReplyItem
  | PlanReplyItem
  | FileOpReplyItem;

export type ReplyStatus = 'streaming' | 'completed' | 'error';

export interface Reply {
  id: string;
  status: ReplyStatus;
  items: ReplyItem[];
  createdAt: number;
  updatedAt: number;
}

export interface ReplyEvent {
  type: string;
  replyId: string;
  data?: unknown;
  timestamp?: number;
  [key: string]: unknown;
}

export interface ProviderReplyAdapter {
  consume(stream: unknown): Promise<void>;
  process(event: unknown): ReplyEvent;
}

export interface ConversationReplyState {
  replies: Record<string, Reply>;
  orderedReplyIds: string[];
}
