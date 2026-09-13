/**
 * Chat stream → fold adapter (Phase 1C).
 *
 * Maps `chatApi.streamChat` / `sendMessageStream` callbacks and cowork
 * approval payloads into `TranscriptEvent`s. The fold (`applyEvent`) remains
 * the only way transcript state changes. Pure: no fetch, no stores.
 *
 * @module bot-chat/chat-stream-adapter
 */

import {
  applyEvent,
  initTranscript,
  type ApprovalRequestedWire,
  type TranscriptEvent,
} from "./transcript";
import type { BotChatTranscript } from "./types";

// ---------------------------------------------------------------------------
// Stream callback shape (matches SendMessageOptions.callbacks, minus artifacts)
// ---------------------------------------------------------------------------

export interface StreamCallbacks {
  onChunk?: (content: string) => void;
  onThinking?: (thinking: string) => void;
  onToolCall?: (toolCall: unknown) => void;
  onToolResult?: (toolResult: unknown) => void;
  onToolError?: (toolError: unknown) => void;
  onArtifact?: (artifact: unknown) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

export interface StreamAdapterContext {
  /** Assistant turn id used for deltas / turn.completed. */
  turnId: string;
  now?: () => number;
}

function clip(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value.slice(0, 240);
  try {
    return JSON.stringify(value).slice(0, 240);
  } catch {
    return fallback;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toolId(value: unknown, fallback: string): string {
  const rec = asRecord(value);
  const id = rec.toolCallId ?? rec.id ?? rec.callId;
  return typeof id === "string" && id ? id : fallback;
}

function toolName(value: unknown): string {
  const rec = asRecord(value);
  const name = rec.toolName ?? rec.tool ?? rec.name ?? rec.type;
  return typeof name === "string" && name ? name.replace(/^tool-/, "") : "tool";
}

/** User send → `message.user`. Call this at send time; do not invent assistant text. */
export function userSendEvent(
  text: string,
  opts?: { id?: string; createdAt?: number },
): TranscriptEvent {
  const createdAt = opts?.createdAt ?? Date.now();
  return {
    type: "message.user",
    id: opts?.id ?? `u-${createdAt}`,
    text,
    createdAt,
  };
}

/**
 * Bind stream callbacks to fold events. Each callback emits one or more
 * `TranscriptEvent`s via `onEvent`. The consumer feeds those into `applyEvent`.
 */
export function streamCallbacksToEvents(
  onEvent: (event: TranscriptEvent) => void,
  ctx: StreamAdapterContext,
): StreamCallbacks {
  const now = ctx.now ?? (() => Date.now());
  let toolSeq = 0;

  return {
    onChunk: (content) => {
      if (!content) return;
      onEvent({ type: "message.delta", id: ctx.turnId, textDelta: content });
    },
    onThinking: (thinking) => {
      if (!thinking) return;
      onEvent({ type: "thinking.delta", id: ctx.turnId, textDelta: thinking });
    },
    onToolCall: (toolCall) => {
      toolSeq += 1;
      const rec = asRecord(toolCall);
      const input = asRecord(rec.input ?? rec.args);
      const subagentType =
        (typeof input.subagent_type === "string" && input.subagent_type) ||
        (typeof rec.subagent_type === "string" && rec.subagent_type) ||
        "";
      const description =
        (typeof input.description === "string" && input.description) ||
        (typeof rec.description === "string" && rec.description) ||
        "";
      const inputSummary =
        subagentType || description
          ? JSON.stringify({
              subagent_type: subagentType || undefined,
              description: description || undefined,
              input: input.prompt ?? input.input,
            })
          : clip(rec.input ?? rec.args, toolName(toolCall));
      onEvent({
        type: "tool.call",
        id: toolId(toolCall, `${ctx.turnId}-tool-${toolSeq}`),
        tool: toolName(toolCall),
        inputSummary,
        createdAt: now(),
      });
    },
    onToolResult: (toolResult) => {
      const rec = asRecord(toolResult);
      onEvent({
        type: "tool.result",
        id: toolId(toolResult, `${ctx.turnId}-tool-${toolSeq}`),
        outputSummary: clip(rec.result ?? rec.output ?? rec.content),
        status: "success",
        createdAt: now(),
      });
    },
    onToolError: (toolError) => {
      const rec = asRecord(toolError);
      const err = clip(rec.error ?? rec.message, "Tool failed");
      onEvent({
        type: "tool.result",
        id: toolId(toolError, `${ctx.turnId}-tool-${toolSeq}`),
        outputSummary: err,
        status: "error",
        error: err,
        createdAt: now(),
      });
    },
    onArtifact: (artifact: unknown) => {
      const rec = asRecord(artifact);
      const id =
        (typeof rec.artifactId === "string" && rec.artifactId) ||
        (typeof rec.id === "string" && rec.id) ||
        `art-${Date.now()}`;
      const title = typeof rec.title === "string" ? rec.title : "Artifact";
      const kind = typeof rec.kind === "string" ? rec.kind : "html";
      const content = typeof rec.content === "string" ? rec.content : "";
      const url = typeof rec.url === "string" ? rec.url : undefined;
      onEvent({
        type: "artifact.created",
        id,
        artifact: {
          id,
          title,
          kind,
          content,
          url,
          createdAt: now(),
        },
        createdAt: now(),
      });
    },
    onDone: () => {
      onEvent({ type: "turn.completed", id: ctx.turnId, createdAt: now() });
    },
    onError: (error) => {
      onEvent({
        type: "error",
        id: ctx.turnId,
        text: error.message || "Chat streaming failed",
        createdAt: now(),
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Approvals (cowork wire → fold). No grantKey is invented.
// ---------------------------------------------------------------------------

export interface CoworkApprovalRequestPayload {
  actionId: string;
  summary: string;
  details?: {
    actionType?: string;
    target?: string;
    args?: Record<string, unknown>;
    consequence?: string;
  };
  timeout?: number;
  botId?: string;
  botName?: string;
  /** Present only if the server issued it. Never invented by this mapper. */
  grantKey?: string;
  options?: ApprovalRequestedWire["options"];
}

export interface CoworkApprovalResultPayload {
  actionId: string;
  approved: boolean;
  responder?: "user" | "auto" | "timeout";
}

export function approvalRequestToEvent(
  payload: CoworkApprovalRequestPayload,
): TranscriptEvent {
  const approval: ApprovalRequestedWire = {
    id: payload.actionId,
    botId: payload.botId ?? "",
    botName: payload.botName ?? "Bot",
    title: payload.summary,
    detail: payload.details?.consequence,
    timeout: payload.timeout,
  };
  if (payload.options && payload.options.length > 0) {
    approval.options = payload.options;
  }
  if (payload.grantKey) {
    approval.grantKey = payload.grantKey;
  }
  return { type: "approval.requested", approval };
}

export function approvalResultToEvent(
  payload: CoworkApprovalResultPayload,
): TranscriptEvent {
  const outcome =
    payload.responder === "timeout"
      ? "expired"
      : payload.approved
        ? "approved"
        : "denied";
  return { type: "approval.resolved", id: payload.actionId, outcome };
}

export function approvalAnswerToEvent(
  approvalId: string,
  optionId: string,
): TranscriptEvent {
  const denied = /deny|reject|no/i.test(optionId);
  return {
    type: "approval.resolved",
    id: approvalId,
    outcome: denied ? "denied" : "approved",
  };
}

// ---------------------------------------------------------------------------
// History rebuild (session.messages → fold)
// ---------------------------------------------------------------------------

export interface HistoryMessage {
  id: string;
  role: string;
  content: string;
  thinking?: string;
  timestamp?: string | number;
  metadata?: { agentElementsParts?: Array<Record<string, unknown>> };
}

function ts(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Date.parse(value);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function applyToolParts(
  transcript: BotChatTranscript,
  parts: Array<Record<string, unknown>>,
  createdAt: number,
): BotChatTranscript {
  let next = transcript;
  for (const part of parts) {
    const id = toolId(part, `hist-tool-${createdAt}`);
    const name = toolName(part);
    const state = typeof part.state === "string" ? part.state : "";
    const hasInput = part.input != null || part.args != null;
    const hasOutput = part.output != null || part.result != null;
    const isError = state === "output-error" || part.error != null;

    if (hasInput || state.startsWith("input")) {
      next = applyEvent(next, {
        type: "tool.call",
        id,
        tool: name,
        inputSummary: clip(part.input ?? part.args, name),
        createdAt,
      });
    }
    if (isError) {
      const err = clip(part.error ?? part.output ?? part.result, "Tool failed");
      next = applyEvent(next, {
        type: "tool.result",
        id,
        outputSummary: err,
        status: "error",
        error: err,
        createdAt,
      });
    } else if (hasOutput || state === "output-available") {
      next = applyEvent(next, {
        type: "tool.result",
        id,
        outputSummary: clip(part.output ?? part.result),
        status: "success",
        createdAt,
      });
    }
  }
  return next;
}

/**
 * Rebuild a transcript from stored session messages. Used on load; live
 * turns then flow through `streamCallbacksToEvents`. Empty assistant
 * placeholders (content '', no thinking, no tools) are skipped.
 */
export function messagesToTranscript(
  messages: HistoryMessage[],
  opts?: { now?: number },
): BotChatTranscript {
  const fallback = opts?.now ?? Date.now();
  let transcript = initTranscript();

  for (const msg of messages) {
    const createdAt = ts(msg.timestamp, fallback);
    if (msg.role === "user") {
      transcript = applyEvent(transcript, {
        type: "message.user",
        id: msg.id,
        text: msg.content,
        createdAt,
      });
      continue;
    }
    if (msg.role === "system") continue;

    const parts = msg.metadata?.agentElementsParts ?? [];
    const hasBody = Boolean(msg.content?.trim()) || Boolean(msg.thinking?.trim()) || parts.length > 0;
    if (!hasBody) continue;

    if (msg.thinking?.trim()) {
      transcript = applyEvent(transcript, {
        type: "thinking.delta",
        id: msg.id,
        textDelta: msg.thinking,
      });
    }
    if (parts.length > 0) {
      transcript = applyToolParts(transcript, parts, createdAt);
    }
    if (msg.content?.trim()) {
      transcript = applyEvent(transcript, {
        type: "message.delta",
        id: msg.id,
        textDelta: msg.content,
      });
    }
    transcript = applyEvent(transcript, {
      type: "turn.completed",
      id: msg.id,
      createdAt,
    });
  }

  return transcript;
}

export { applyEvent, initTranscript };
