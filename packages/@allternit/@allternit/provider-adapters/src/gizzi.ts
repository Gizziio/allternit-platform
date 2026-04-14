// =============================================================================
// @a2r/provider-adapters/gizzi — Gizzi bus event → canonical ReplyEvent
//
// Gizzi emits raw bus events over SSE (message.part.updated, message.part.delta,
// message.updated). This adapter normalises them to canonical ReplyEvents.
//
// Usage:
//   const adapter = new GizziReplyAdapter({ sessionId, onEvent });
//   adapter.process(rawBusEvent);
// =============================================================================

import type { ReplyEvent } from "@a2r/replies-contract";

// ---------------------------------------------------------------------------
// Raw gizzi bus event shapes
// ---------------------------------------------------------------------------

export interface GizziBusEvent {
  type?: string;
  properties?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// GizziReplyAdapter — stateful, one instance per streaming request
// ---------------------------------------------------------------------------

export interface GizziReplyAdapterOptions {
  /** The gizzi sessionID this adapter is scoped to. */
  sessionId: string;
  /** Called once per canonical ReplyEvent produced. */
  onEvent: (event: ReplyEvent) => void;
}

export class GizziReplyAdapter {
  private readonly sessionId: string;
  private readonly onEvent: (event: ReplyEvent) => void;

  /** Tracks which partIDs are reasoning (not text). */
  private readonly reasoningPartIds = new Set<string>();
  /** Tracks which text partIDs have already had reply.item.added emitted. */
  private readonly openedTextPartIds = new Set<string>();
  /** Tracks which toolCallIDs have already had reply.item.added emitted. */
  private readonly emittedToolCallIds = new Set<string>();

  /** The current gizzi messageID (set on first event). */
  private messageId: string | null = null;

  constructor(options: GizziReplyAdapterOptions) {
    this.sessionId = options.sessionId;
    this.onEvent = options.onEvent;
  }

  /**
   * Process one raw gizzi bus event. May call onEvent zero or more times.
   */
  process(raw: GizziBusEvent): void {
    if (raw.type === "message.part.updated") {
      this.handlePartUpdated(raw);
    } else if (raw.type === "message.part.delta") {
      this.handlePartDelta(raw);
    }
    // message.updated (token counts) is not translated to ReplyEvents here —
    // callers that need token metadata can read it directly from the raw event.
  }

  // ---------------------------------------------------------------------------
  // Private handlers
  // ---------------------------------------------------------------------------

  private handlePartUpdated(raw: GizziBusEvent): void {
    const part = raw.properties?.part as Record<string, unknown> | undefined;
    if (!part || part.sessionID !== this.sessionId) return;

    const partId = part.id as string | undefined;
    const msgId = part.messageID as string | undefined;
    if (!partId || !msgId) return;

    this.ensureMessageStart(msgId);

    switch (part.type) {
      case "reasoning": {
        if (typeof part.text === "string" && part.text === "") {
          this.reasoningPartIds.add(partId);
          this.emit({
            type: "reply.item.added",
            replyId: this.messageId!,
            runId: `run_${this.messageId}`,
            itemId: partId,
            kind: "reasoning",
            ts: Date.now(),
          });
        }
        break;
      }

      case "tool": {
        const state = part.state as Record<string, unknown> | undefined;
        if (!state) break;
        const callID = part.callID as string | undefined;
        const toolName = (part.tool as string | undefined) ?? "tool";
        if (!callID) break;

        if (state.status === "running" && !this.emittedToolCallIds.has(callID)) {
          this.emittedToolCallIds.add(callID);
          this.emit({
            type: "reply.item.added",
            replyId: this.messageId!,
            runId: `run_${this.messageId}`,
            itemId: callID,
            kind: "tool_call",
            ts: Date.now(),
          });
          this.emit({
            type: "tool_call.started",
            replyId: this.messageId!,
            runId: `run_${this.messageId}`,
            itemId: callID,
            toolCallId: callID,
            toolName,
            input: (state.input as Record<string, unknown>) ?? {},
            ts: Date.now(),
          });
        } else if (state.status === "completed") {
          this.emit({
            type: "tool_call.completed",
            replyId: this.messageId!,
            runId: `run_${this.messageId}`,
            itemId: callID,
            toolCallId: callID,
            output: state.output ?? null,
            ts: Date.now(),
          });
        } else if (state.status === "error") {
          this.emit({
            type: "tool_call.failed",
            replyId: this.messageId!,
            runId: `run_${this.messageId}`,
            itemId: callID,
            toolCallId: callID,
            error: (state.error as string) ?? "Tool execution failed",
            ts: Date.now(),
          });
        }
        break;
      }

      default:
        break;
    }
  }

  private handlePartDelta(raw: GizziBusEvent): void {
    const props = raw.properties as {
      sessionID?: string;
      messageID?: string;
      partID?: string;
      field?: string;
      delta?: string;
    } | undefined;

    if (!props?.sessionID || props.sessionID !== this.sessionId) return;
    if (props.field !== "text" && props.field !== "content") return;
    if (!props.delta) return;

    this.ensureMessageStart(props.messageID ?? "");

    if (props.partID && this.reasoningPartIds.has(props.partID)) {
      this.emit({
        type: "reply.reasoning.delta",
        replyId: this.messageId!,
        runId: `run_${this.messageId}`,
        itemId: props.partID,
        delta: props.delta,
        ts: Date.now(),
      });
    } else {
      const textItemId = props.partID ?? `text_${this.messageId}`;
      if (!this.openedTextPartIds.has(textItemId)) {
        this.openedTextPartIds.add(textItemId);
        this.emit({
          type: "reply.item.added",
          replyId: this.messageId!,
          runId: `run_${this.messageId}`,
          itemId: textItemId,
          kind: "text",
          ts: Date.now(),
        });
      }
      this.emit({
        type: "reply.text.delta",
        replyId: this.messageId!,
        runId: `run_${this.messageId}`,
        itemId: textItemId,
        delta: props.delta,
        ts: Date.now(),
      });
    }
  }

  private ensureMessageStart(msgId: string): void {
    if (!this.messageId && msgId) {
      this.messageId = msgId;
      this.emit({
        type: "reply.started",
        replyId: msgId,
        runId: `run_${msgId}`,
        conversationId: this.sessionId,
        ts: Date.now(),
      });
    }
  }

  private emit(event: ReplyEvent): void {
    this.onEvent(event);
  }

  // ---------------------------------------------------------------------------
  // Convenience accessors for callers that need to emit terminal events
  // ---------------------------------------------------------------------------

  get currentMessageId(): string | null {
    return this.messageId;
  }
}
