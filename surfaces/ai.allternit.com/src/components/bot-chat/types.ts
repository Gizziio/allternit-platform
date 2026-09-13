/**
 * Bot-chat foundation types (Phase 1A).
 *
 * Surface-agnostic data model for the bot-mode transcript. Adapters map
 * transport-specific events (web chat stream callbacks, fabric relay SSE)
 * into the fold events consumed by `transcript.ts`; components render a
 * `BotChatTranscript` and never touch transports.
 *
 * @module bot-chat/types
 */

/** Streaming lifecycle of a chat message. */
export type BotChatMessageStatus = "streaming" | "settled" | "error";

export interface BotChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  /** Epoch milliseconds. */
  createdAt: number;
  status: BotChatMessageStatus;
  /** Placeholder for later edit-retry support (1B+); previous text versions. */
  versions?: string[];
}

export type ToolRunStatus = "running" | "success" | "error";

/** A tool invocation as it appears in the transcript. */
export interface ToolCallRecord {
  id: string;
  tool: string;
  /** Short human-readable summary of the input. */
  inputSummary: string;
  /** Short human-readable summary of the output (filled by the result). */
  outputSummary?: string;
  durationMs?: number;
  status: ToolRunStatus;
  error?: string;
  /** Epoch milliseconds; used for gap-timestamp placement. */
  createdAt?: number;
}

/**
 * A completed tool result. Same identity as the call it resolves (`id`).
 * Kept as a distinct type so adapters can type their wire results without
 * pretending to know the call's input.
 */
export interface ToolResultRecord {
  id: string;
  tool: string;
  inputSummary: string;
  outputSummary: string;
  durationMs?: number;
  status: "success" | "error";
  error?: string;
  createdAt?: number;
}

/** One actionable option on an approval request. */
export interface ApprovalOption {
  id: string;
  label: string;
  kind: "approve" | "deny" | "neutral";
}

/**
 * Normalized approval request. The wire event may omit `options` (binary
 * approve/deny is the current server shape) and never invents `grantKey` —
 * that field is server-issued only; when absent, "always allow" UI must not
 * render.
 */
export interface ApprovalRequest {
  id: string;
  botId: string;
  botName: string;
  title: string;
  detail?: string;
  options: ApprovalOption[];
  grantKey?: string;
  /** Seconds until expiry, if the server sets one. */
  timeout?: number;
  status: "pending" | "approved" | "denied" | "expired";
  createdAt?: number;
}

/** A folded group of 2+ consecutive, non-error tool calls. */
export interface ToolRunGroup {
  id: string;
  /** Members in execution order. Never contains an errored call. */
  calls: ToolCallRecord[];
  status: ToolRunStatus;
  /**
   * UI expansion flag. Toggled by the component, NOT by the fold — the fold
   * never rewrites it except to carry it through immutable updates.
   */
  expanded: boolean;
}

/** Inline artifact produced by the bot. */
export interface InlineArtifact {
  id: string;
  kind: string;
  title: string;
  content: string;
  url?: string;
  createdAt?: number;
}

export type TranscriptRow =
  | { kind: "message"; id: string; createdAt: number; message: BotChatMessage }
  | { kind: "artifact"; id: string; createdAt: number; artifact: InlineArtifact }
  | { kind: "toolCall"; id: string; createdAt: number; call: ToolCallRecord }
  | { kind: "toolRun"; id: string; createdAt: number; run: ToolRunGroup }
  | { kind: "approval"; id: string; createdAt: number; approval: ApprovalRequest }
  | { kind: "timestamp-gap"; id: string; from: number; to: number }
  | { kind: "error"; id: string; createdAt: number; text: string };

/** Ladder of the active streaming turn, from quietest to loudest. */
export type BotChatRung = "thinking" | "typing" | "streaming";

/**
 * State of the in-flight bot turn. Materialized into `rows` only on
 * `turn.completed` (messages) or immediately (tool rows).
 */
export interface ActiveTurn {
  /** Assistant message id this turn is writing into. */
  id: string;
  rung: BotChatRung;
  /** Thinking buffer, capped at THINKING_BUFFER_CAP chars. */
  thinkingBuffer: string;
  /** Answer text accumulated so far (the streaming bubble source). */
  partialText: string;
  /** Tool calls made this turn that have not all settled into rows yet. */
  pendingToolCalls: ToolCallRecord[];
  startedAt: number;
}

export interface BotChatTranscript {
  rows: TranscriptRow[];
  activeTurn: ActiveTurn | null;
}

/** Maximum retained characters of the thinking buffer. */
export const THINKING_BUFFER_CAP = 2000;

/** Minimum row-to-row time separation that produces a `timestamp-gap` row. */
export const GAP_THRESHOLD_MS = 30 * 60 * 1000;
