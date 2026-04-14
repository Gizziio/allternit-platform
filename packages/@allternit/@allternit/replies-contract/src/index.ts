// =============================================================================
// @a2r/replies-contract — Canonical type contract for the A2R Replies API
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
  | "citation";

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

export type ReplyItem =
  | TextReplyItem
  | ReasoningReplyItem
  | ToolCallReplyItem
  | ArtifactReplyItem
  | CitationReplyItem;

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
