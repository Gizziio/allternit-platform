/**
 * UI Part types — canonical type definitions for Allternit canvas and chat rendering.
 *
 * Extracted from rust-stream-adapter.ts so canvas components, MCP context, and
 * chat renderers can import types without depending on the legacy adapter hook.
 */

import type {
  TextUIPart,
  ToolUIPart,
  DynamicToolUIPart,
  FileUIPart,
  SourceDocumentUIPart,
} from "ai";
import type {
  McpAppResourceCsp,
  McpAppResourcePermissions,
  McpAppToolDefinition,
} from "./mcp/apps";

// ============================================================================
// Wire event types (Rust SSE contract)
// ============================================================================

export type RustEventType =
  | "message_start"
  | "content_block_start"
  | "content_block_delta"
  | "tool_result"
  | "tool_error"
  | "mcp_app"
  | "mcp_app_message"
  | "mcp_app_update_context"
  | "source"
  | "plan"
  | "plan_update"
  | "checkpoint"
  | "task"
  | "citation"
  | "artifact"
  | "error"
  | "finish";

export interface RustStreamEvent {
  type: RustEventType;
  messageId?: string;
  partId?: string;
  delta?: {
    type: "text_delta" | "thinking_delta";
    text?: string;
    thinking?: string;
  };
  content_block?: {
    type: "tool_use" | "text" | "thinking";
    id: string;
    name?: string;
    input?: Record<string, unknown>;
    text?: string;
    thinking?: string;
  };
  toolCallId?: string;
  toolName?: string;
  result?: unknown;
  error?: string;
  sourceId?: string;
  url?: string;
  title?: string;
  connectorId?: string;
  connectorName?: string;
  resourceUri?: string;
  html?: string;
  allow?: string;
  prefersBorder?: boolean;
  tool?: McpAppToolDefinition;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  csp?: McpAppResourceCsp;
  permissions?: McpAppResourcePermissions;
  domain?: string;
  artifactId?: string;
  kind?: string;
  content?: string;
  citationId?: string;
  startIndex?: number;
  endIndex?: number;
  checkpointId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  taskId?: string;
  status?: "pending" | "running" | "complete" | "error";
  progress?: number;
  planId?: string;
  steps?: PlanStep[];
  durationMs?: number;
  modelId?: string;
  runtimeModelId?: string;
  finishedAt?: number;
  role?: "user" | "assistant";
  parts?: unknown[];
  context?: Record<string, unknown>;
}

// ============================================================================
// UI Part types
// ============================================================================

export type MessageRole = "user" | "assistant" | "system";

export interface ReasoningUIPart {
  type: "reasoning";
  reasoningId: string;
  text: string;
  isOpen?: boolean;
  metadata?: Record<string, unknown>;
  trace?: ReasoningTrace;
}

export type ArtifactKind =
  | "image"
  | "svg"
  | "mermaid"
  | "jsx"
  | "html"
  | "document"
  | "slides"
  | "sheet"
  | "audio"
  | "video"
  | "podcast";

export interface LinkedSourceDocumentUIPart extends SourceDocumentUIPart {
  url?: string;
}

export interface ArtifactUIPart {
  type: "artifact";
  artifactId: string;
  kind: ArtifactKind;
  url?: string;
  content?: string;
  title: string;
}

export interface ErrorUIPart {
  type: "error";
  message: string;
  stackTrace?: string;
  kind: "compilation" | "runtime" | "validation" | "unknown";
}

export interface McpAppUIPart {
  type: "mcp-app";
  toolCallId: string;
  toolName: string;
  connectorId: string;
  connectorName: string;
  resourceUri: string;
  title: string;
  description?: string;
  html: string;
  allow?: string;
  prefersBorder?: boolean;
  tool?: McpAppToolDefinition;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  csp?: McpAppResourceCsp;
  permissions?: McpAppResourcePermissions;
  domain?: string;
}

type ChatMessageStatus = "streaming" | "complete" | "error" | "stopped";

export interface ChatMessageMetadata {
  modelId?: string;
  runtimeModelId?: string;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  toolCount?: number;
  sourceCount?: number;
  artifactCount?: number;
  status?: ChatMessageStatus;
}

export type ReasoningTraceStepType =
  | "reasoning"
  | "search"
  | "file-read"
  | "file-write"
  | "command"
  | "agent"
  | "tool";

export interface ReasoningTraceStepMetadata {
  files?: string[];
  agents?: string[];
  commands?: string[];
  searchQuery?: string;
  results?: number;
}

export interface ReasoningTraceStep {
  type: ReasoningTraceStepType;
  summary: string;
  detail?: string;
  status?: "pending" | "running" | "completed";
  metadata?: ReasoningTraceStepMetadata;
}

export interface ReasoningTrace {
  version: number;
  source?: string;
  headline?: string;
  steps: ReasoningTraceStep[];
}

export interface PlanStep {
  id: string;
  description: string;
  status: "pending" | "in-progress" | "complete" | "error";
}

export interface PlanUIPart {
  type: "plan";
  planId: string;
  title: string;
  steps: PlanStep[];
}

export interface CheckpointUIPart {
  type: "checkpoint";
  checkpointId: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface TaskUIPart {
  type: "task";
  taskId: string;
  title: string;
  description?: string;
  status: "pending" | "running" | "complete" | "error";
  progress?: number;
}

export interface CitationUIPart {
  type: "citation";
  citationId: string;
  sourceId: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

export type UIPart =
  | (TextUIPart & { partId?: string })
  | ToolUIPart
  | DynamicToolUIPart
  | FileUIPart
  | LinkedSourceDocumentUIPart
  | McpAppUIPart
  | PlanUIPart
  | CheckpointUIPart
  | TaskUIPart
  | CitationUIPart
  | ArtifactUIPart
  | ErrorUIPart
  | (ReasoningUIPart & { partId?: string });

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string | UIPart[];
  createdAt: Date;
  metadata?: ChatMessageMetadata;
}
