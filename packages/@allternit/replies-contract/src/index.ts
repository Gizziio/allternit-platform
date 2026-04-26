// =============================================================================
// @allternit/replies-contract — Canonical type contract for the Allternit Replies API
//
// Public primitive:  Reply
// Internal primitive: Run (id convention: `run_${replyId}`)
// Continuity:        Conversation (id = gizzi sessionId)
// Output union:      ReplyItem
// Wire events:       ReplyEvent (SSE + reducer input)
//
// Provider-specific types (AnthropicStreamChunk, GizziBusEvent, etc.) must
// never appear in this package. This is pure TypeScript with zero deps.
// =============================================================================

// ---------------------------------------------------------------------------
// ReplyItem kinds
// ---------------------------------------------------------------------------

export type ReplyItemKind =
  | "text"
  | "reasoning"
  | "tool_call"
  | "artifact"
  | "citation"
  | "mcp_app"
  | "code"
  | "terminal"
  | "plan"
  | "file_op";

export interface TextReplyItem {
  kind: "text";
  id: string;
  text: string;
  isOpen: boolean;
}

export interface ReasoningReplyItem {
  kind: "reasoning";
  id: string;
  text: string;
  summary?: string;
  isOpen: boolean;
}

export interface ToolCallReplyItem {
  kind: "tool_call";
  id: string;
  toolCallId: string;
  toolName: string;
  title?: string;
  state: ToolCallState;
  input?: unknown;
  progressLines: string[];
  output?: unknown;
  outputPreview?: unknown;
  error?: string;
  isOpen: boolean;
  startedAt?: number;
  endedAt?: number;
}

export interface ArtifactReplyItem {
  kind: "artifact";
  id: string;
  artifactId: string;
  artifactType: string;
  title: string;
  url?: string;
  preview?: unknown;
  metadata?: Record<string, unknown>;
  isOpen: boolean;
}

export interface CitationRef {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
}

export interface CitationReplyItem {
  kind: "citation";
  id: string;
  items: CitationRef[];
  isOpen: boolean;
}

// McpApp — interactive MCP application rendered as a sandboxed iframe in the transcript
export interface McpAppReplyItem {
  kind: "mcp_app";
  id: string;
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
  /** Loose typed — McpAppFrame narrows these at render time */
  csp?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  domain?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  isOpen: boolean;
}

// Code — syntax-highlighted code block
export interface CodeReplyItem {
  kind: "code";
  id: string;
  language: string;
  code: string;
  filename?: string;
  isOpen: boolean;
}

// Terminal — command execution output
export type TerminalStatus = "running" | "completed" | "error";

export interface TerminalReplyItem {
  kind: "terminal";
  id: string;
  command: string;
  output: string;
  exitCode?: number;
  status: TerminalStatus;
  isOpen: boolean;
}

// Plan — structured execution plan with step-level status
export type PlanStepStatus = "pending" | "in-progress" | "complete" | "error";

export interface PlanStep {
  id: string;
  description: string;
  status: PlanStepStatus;
}

export interface PlanReplyItem {
  kind: "plan";
  id: string;
  planId: string;
  title: string;
  steps: PlanStep[];
  isOpen: boolean;
}

// FileOp — file system operation marker (create / modify / delete)
export type FileOpKind = "create" | "modify" | "delete";

export interface FileOpReplyItem {
  kind: "file_op";
  id: string;
  operation: FileOpKind;
  path: string;
  content?: string;
  diff?: string;
  isOpen: boolean;
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

// ---------------------------------------------------------------------------
// Status types
// ---------------------------------------------------------------------------

export type ReplyStatus = "streaming" | "complete" | "failed";
export type ToolCallState = "queued" | "running" | "done" | "error";

// ---------------------------------------------------------------------------
// Reply — the public runtime object
// ---------------------------------------------------------------------------

export interface Reply {
  id: string;
  runId: string;
  conversationId?: string;
  status: ReplyStatus;
  error?: string;
  startedAt: number;
  completedAt?: number;
  items: ReplyItem[];
}

// ---------------------------------------------------------------------------
// ReplyEvent — canonical SSE wire format and reducer input
//
// Naming conventions:
//   reply.*         — reply lifecycle events
//   tool_call.*     — tool lifecycle events (intentionally no "reply." prefix,
//                     matches cross-platform tool event naming)
//   artifact.*      — artifact lifecycle events
//   citation.*      — citation lifecycle events
// ---------------------------------------------------------------------------

export type ReplyEvent =
  | {
      type: "reply.started";
      replyId: string;
      runId: string;
      conversationId?: string;
      ts: number;
    }
  | {
      type: "reply.item.added";
      replyId: string;
      runId: string;
      itemId: string;
      kind: ReplyItemKind;
      ts: number;
    }
  | {
      type: "reply.text.delta";
      replyId: string;
      runId: string;
      itemId: string;
      delta: string;
      ts: number;
    }
  | {
      type: "reply.reasoning.delta";
      replyId: string;
      runId: string;
      itemId: string;
      delta: string;
      summary?: string;
      ts: number;
    }
  | {
      type: "tool_call.started";
      replyId: string;
      runId: string;
      itemId: string;
      toolCallId: string;
      toolName: string;
      input?: unknown;
      title?: string;
      ts: number;
    }
  | {
      type: "tool_call.progress";
      replyId: string;
      runId: string;
      itemId: string;
      toolCallId: string;
      statusText: string;
      ts: number;
    }
  | {
      type: "tool_call.completed";
      replyId: string;
      runId: string;
      itemId: string;
      toolCallId: string;
      output: unknown;
      preview?: unknown;
      ts: number;
    }
  | {
      type: "tool_call.failed";
      replyId: string;
      runId: string;
      itemId: string;
      toolCallId: string;
      error: string;
      ts: number;
    }
  | {
      type: "artifact.created";
      replyId: string;
      runId: string;
      itemId: string;
      artifactId: string;
      artifactType: string;
      title: string;
      url?: string;
      inlinePreview?: unknown;
      metadata?: Record<string, unknown>;
      ts: number;
    }
  | {
      type: "citation.added";
      replyId: string;
      runId: string;
      itemId: string;
      citationId: string;
      title: string;
      url?: string;
      snippet?: string;
      ts: number;
    }
  | {
      type: "mcp_app.created";
      replyId: string;
      runId: string;
      itemId: string;
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
      csp?: Record<string, unknown>;
      permissions?: Record<string, unknown>;
      domain?: string;
      toolInput?: Record<string, unknown>;
      toolResult?: unknown;
      ts: number;
    }
  | {
      type: "code.added";
      replyId: string;
      runId: string;
      itemId: string;
      language: string;
      code: string;
      filename?: string;
      ts: number;
    }
  | {
      type: "terminal.added";
      replyId: string;
      runId: string;
      itemId: string;
      command: string;
      output: string;
      exitCode?: number;
      status: TerminalStatus;
      ts: number;
    }
  | {
      type: "plan.created";
      replyId: string;
      runId: string;
      itemId: string;
      planId: string;
      title: string;
      steps: PlanStep[];
      ts: number;
    }
  | {
      type: "plan.updated";
      replyId: string;
      runId: string;
      itemId: string;
      steps: PlanStep[];
      ts: number;
    }
  | {
      type: "file_op.added";
      replyId: string;
      runId: string;
      itemId: string;
      operation: FileOpKind;
      path: string;
      content?: string;
      diff?: string;
      ts: number;
    }
  | {
      type: "reply.item.done";
      replyId: string;
      runId: string;
      itemId: string;
      ts: number;
    }
  | {
      type: "reply.completed";
      replyId: string;
      runId: string;
      ts: number;
    }
  | {
      type: "reply.failed";
      replyId: string;
      runId: string;
      error: string;
      ts: number;
    };

// ---------------------------------------------------------------------------
// Provider adapter interface
// ---------------------------------------------------------------------------

export interface ProviderReplyAdapter<TChunk> {
  mapChunkToEvents(chunk: TChunk): ReplyEvent[];
}

// ---------------------------------------------------------------------------
// ConversationReplyState — frontend projection keyed by conversationId
// ---------------------------------------------------------------------------

export interface ConversationReplyState {
  replies: Record<string, Reply>;
  orderedReplyIds: string[];
}
