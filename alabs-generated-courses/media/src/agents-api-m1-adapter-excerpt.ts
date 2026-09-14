  | { type: "error"; error: unknown }
  | { type: "raw" };

export interface AiSdkReplyAdapterOptions {
  replyId: string;
  runId: string;
  conversationId?: string;
  onEvent: (event: ReplyEvent) => void;
}

export class AiSdkReplyAdapter {
  private readonly replyId: string;
  private readonly runId: string;
  private readonly conversationId: string | undefined;
  private readonly onEvent: (event: ReplyEvent) => void;

  // Track opened items to avoid duplicate reply.item.added
  private readonly openedTextIds = new Set<string>();
  private readonly openedReasoningIds = new Set<string>();
  // tool-input-start id → toolName (for tool-call dedup)
  private readonly pendingTools = new Map<string, { toolName: string; title?: string }>();
  // toolCallId → itemId (for result/error routing)
  private readonly toolCallIdToItemId = new Map<string, string>();
  private started = false;
  // Text buffers for post-text-end structured extraction
  private readonly textBuffers = new Map<string, string>();
  // Guard: if the provider already sent native reasoning events, skip text extraction
  private hasNativeReasoning = false;

  constructor(options: AiSdkReplyAdapterOptions) {
    this.replyId = options.replyId;
    this.runId = options.runId;
    this.conversationId = options.conversationId;
    this.onEvent = options.onEvent;
  }

  private emit(event: ReplyEvent): void {
    this.onEvent(event);
  }

  private ts(): number {
    return Date.now();
  }

  private ensureStarted(): void {
    if (!this.started) {
      this.started = true;
      this.emit({
        type: "reply.started",
        replyId: this.replyId,
        runId: this.runId,
        conversationId: this.conversationId,
        ts: this.ts(),
      });
    }
  }

  process(part: AiSdkStreamPart): void {
    switch (part.type) {
      // -----------------------------------------------------------------------
      // Stream lifecycle
      // -----------------------------------------------------------------------
      case "start": {
        this.ensureStarted();
        break;
      }

      // -----------------------------------------------------------------------
      // Text
      // -----------------------------------------------------------------------
      case "text-start": {
        this.ensureStarted();
        if (!this.openedTextIds.has(part.id)) {
          this.openedTextIds.add(part.id);
          this.emit({
            type: "reply.item.added",
            replyId: this.replyId,
            runId: this.runId,
            itemId: part.id,
            kind: "text",
            ts: this.ts(),
          });
        }
        break;
      }

      case "text-delta": {
        this.ensureStarted();
        // Guard: if no text-start was emitted (some providers skip it), open now
        if (!this.openedTextIds.has(part.id)) {
          this.openedTextIds.add(part.id);
          this.emit({
            type: "reply.item.added",
            replyId: this.replyId,
            runId: this.runId,
            itemId: part.id,
            kind: "text",
            ts: this.ts(),
          });
        }
        if (part.text) {
          // Buffer for post-processing on text-end
          this.textBuffers.set(part.id, (this.textBuffers.get(part.id) ?? "") + part.text);
          this.emit({
            type: "reply.text.delta",
            replyId: this.replyId,
            runId: this.runId,
            itemId: part.id,
            delta: part.text,
            ts: this.ts(),
          });
        }
        break;
      }

      case "text-end": {
        this.emit({
          type: "reply.item.done",
          replyId: this.replyId,
          runId: this.runId,
          itemId: part.id,
          ts: this.ts(),
        });
        // Extract structured content from accumulated text (thinking blocks, documents).
        // Only runs if the provider didn't already emit native reasoning events.
        const buffered = this.textBuffers.get(part.id) ?? "";
