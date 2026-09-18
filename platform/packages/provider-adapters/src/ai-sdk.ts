/**
 * AiSdkReplyAdapter
 *
 * Converts AI SDK v6 TextStreamPart events (from streamText().fullStream)
 * into canonical ReplyEvents. Works for ALL AI SDK providers — Anthropic,
 * OpenAI, Gemini, etc. — with zero provider-specific code.
 *
 * Usage:
 *   const result = streamText({ model, messages, tools });
 *   const adapter = new AiSdkReplyAdapter({ replyId, runId, onEvent });
 *   await adapter.consume(result.fullStream);
 */

import type { ReplyEvent } from "@allternit/replies-contract";

// ---------------------------------------------------------------------------
// Minimal types — mirrors AI SDK v6 TextStreamPart without importing ai pkg
// ---------------------------------------------------------------------------

export type AiSdkStreamPart =
  | { type: "start" }
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; text: string }
  | { type: "text-end"; id: string }
  | { type: "reasoning-start"; id: string }
  | { type: "reasoning-delta"; id: string; text: string }
  | { type: "reasoning-end"; id: string }
  | { type: "tool-input-start"; id: string; toolName: string; title?: string }
  | { type: "tool-input-delta"; id: string; delta: string }
  | { type: "tool-input-end"; id: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown }
  | { type: "tool-error"; toolCallId: string; toolName: string; error: unknown }
  | { type: "source"; url?: string; title?: string; id?: string }
  | { type: "file"; file: { base64?: string; mimeType?: string; url?: string }; id?: string }
  | { type: "finish"; finishReason: string; totalUsage?: { promptTokens: number; completionTokens: number } }
  | { type: "finish-step" }
  | { type: "start-step" }
  | { type: "abort"; reason?: string }
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
        this.textBuffers.delete(part.id);
        if (buffered) this.extractStructuredParts(buffered, part.id);
        break;
      }

      // -----------------------------------------------------------------------
      // Reasoning (extended thinking)
      // -----------------------------------------------------------------------
      case "reasoning-start": {
        this.ensureStarted();
        this.hasNativeReasoning = true;
        if (!this.openedReasoningIds.has(part.id)) {
          this.openedReasoningIds.add(part.id);
          this.emit({
            type: "reply.item.added",
            replyId: this.replyId,
            runId: this.runId,
            itemId: part.id,
            kind: "reasoning",
            ts: this.ts(),
          });
        }
        break;
      }

      case "reasoning-delta": {
        this.ensureStarted();
        this.hasNativeReasoning = true;
        if (!this.openedReasoningIds.has(part.id)) {
          this.openedReasoningIds.add(part.id);
          this.emit({
            type: "reply.item.added",
            replyId: this.replyId,
            runId: this.runId,
            itemId: part.id,
            kind: "reasoning",
            ts: this.ts(),
          });
        }
        if (part.text) {
          this.emit({
            type: "reply.reasoning.delta",
            replyId: this.replyId,
            runId: this.runId,
            itemId: part.id,
            delta: part.text,
            ts: this.ts(),
          });
        }
        break;
      }

      case "reasoning-end": {
        this.emit({
          type: "reply.item.done",
          replyId: this.replyId,
          runId: this.runId,
          itemId: part.id,
          ts: this.ts(),
        });
        break;
      }

      // -----------------------------------------------------------------------
      // Tool calls
      // -----------------------------------------------------------------------
      case "tool-input-start": {
        this.ensureStarted();
        this.pendingTools.set(part.id, { toolName: part.toolName, title: part.title });
        this.emit({
          type: "reply.item.added",
          replyId: this.replyId,
          runId: this.runId,
          itemId: part.id,
          kind: "tool_call",
          ts: this.ts(),
        });
        this.emit({
          type: "tool_call.started",
          replyId: this.replyId,
          runId: this.runId,
          itemId: part.id,
          toolCallId: part.id,
          toolName: part.toolName,
          title: part.title,
          ts: this.ts(),
        });
        break;
      }

      case "tool-input-delta": {
        // Emit progress with partial input JSON
        this.emit({
          type: "tool_call.progress",
          replyId: this.replyId,
          runId: this.runId,
          itemId: part.id,
          toolCallId: part.id,
          statusText: part.delta,
          ts: this.ts(),
        });
        break;
      }

      case "tool-call": {
        // tool-call fires when input is fully accumulated (after tool-input-*)
        // If tool-input-start already emitted, this is a no-op for item.added/started
        // but we use it to register the toolCallId → itemId mapping
        const toolCallId = (part as { toolCallId: string; toolName: string; args: unknown }).toolCallId;
        const toolName = (part as { toolCallId: string; toolName: string; args: unknown }).toolName;
        const args = (part as { toolCallId: string; toolName: string; args: unknown }).args;

        if (!this.toolCallIdToItemId.has(toolCallId)) {
          // Provider didn't emit tool-input-start (e.g. some OpenAI modes)
          this.toolCallIdToItemId.set(toolCallId, toolCallId);
          this.ensureStarted();
          this.emit({
            type: "reply.item.added",
            replyId: this.replyId,
            runId: this.runId,
            itemId: toolCallId,
            kind: "tool_call",
            ts: this.ts(),
          });
          this.emit({
            type: "tool_call.started",
            replyId: this.replyId,
            runId: this.runId,
            itemId: toolCallId,
            toolCallId,
            toolName,
            input: args,
            ts: this.ts(),
          });
        } else {
          // tool-input-start was already emitted — update with full input
          this.emit({
            type: "tool_call.started",
            replyId: this.replyId,
            runId: this.runId,
            itemId: toolCallId,
            toolCallId,
            toolName,
            input: args,
            ts: this.ts(),
          });
        }
        this.toolCallIdToItemId.set(toolCallId, toolCallId);
        break;
      }

      case "tool-result": {
        const p = part as { toolCallId: string; toolName: string; result: unknown };
        const itemId = this.toolCallIdToItemId.get(p.toolCallId) ?? p.toolCallId;

        // Detect MCP app results — emit a dedicated mcp_app.created event so
        // the transcript can render McpAppFrame inline rather than a generic tool row.
        if (isMcpAppResult(p.result)) {
          const app = p.result;
          const mcpItemId = `mcp-${p.toolCallId}`;
          this.emit({
            type: "reply.item.added",
            replyId: this.replyId,
            runId: this.runId,
            itemId: mcpItemId,
            kind: "mcp_app",
            ts: this.ts(),
          });
          this.emit({
            type: "mcp_app.created",
            replyId: this.replyId,
            runId: this.runId,
            itemId: mcpItemId,
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            connectorId: app.connectorId ?? "",
            connectorName: app.connectorName ?? p.toolName,
            resourceUri: app.resourceUri ?? "",
            title: app.title ?? p.toolName,
            description: app.description,
            html: app.html ?? "",
            allow: app.allow,
            prefersBorder: app.prefersBorder,
            csp: app.csp,
            permissions: app.permissions,
            domain: app.domain,
            toolInput: app.toolInput,
            toolResult: app.toolResult,
            ts: this.ts(),
          });
          // Also mark the original tool_call item as done
          this.emit({
            type: "tool_call.completed",
            replyId: this.replyId,
            runId: this.runId,
            itemId,
            toolCallId: p.toolCallId,
            output: p.result,
            ts: this.ts(),
          });
          this.emit({
            type: "reply.item.done",
            replyId: this.replyId,
            runId: this.runId,
            itemId,
            ts: this.ts(),
          });
        } else {
          this.emit({
            type: "tool_call.completed",
            replyId: this.replyId,
            runId: this.runId,
            itemId,
            toolCallId: p.toolCallId,
            output: p.result,
            ts: this.ts(),
          });
          this.emit({
            type: "reply.item.done",
            replyId: this.replyId,
            runId: this.runId,
            itemId,
            ts: this.ts(),
          });
        }
        break;
      }

      case "tool-error": {
        const p = part as { toolCallId: string; toolName: string; error: unknown };
        const itemId = this.toolCallIdToItemId.get(p.toolCallId) ?? p.toolCallId;
        const errMsg =
          p.error instanceof Error
            ? p.error.message
            : typeof p.error === "string"
              ? p.error
              : JSON.stringify(p.error);
        this.emit({
          type: "tool_call.failed",
          replyId: this.replyId,
          runId: this.runId,
          itemId,
          toolCallId: p.toolCallId,
          error: errMsg,
          ts: this.ts(),
        });
        this.emit({
          type: "reply.item.done",
          replyId: this.replyId,
          runId: this.runId,
          itemId,
          ts: this.ts(),
        });
        break;
      }

      // -----------------------------------------------------------------------
      // Sources → citations
      // -----------------------------------------------------------------------
      case "source": {
        const p = part as { url?: string; title?: string; id?: string; type: string };
        const citationId = p.id ?? `cite-${this.ts()}`;
        const itemId = `citations-${this.replyId}`;
        this.emit({
          type: "citation.added",
          replyId: this.replyId,
          runId: this.runId,
          itemId,
          citationId,
          title: p.title ?? p.url ?? "",
          url: p.url,
          ts: this.ts(),
        });
        break;
      }

      // -----------------------------------------------------------------------
      // Files → artifacts
      // -----------------------------------------------------------------------
      case "file": {
        const p = part as { file: { base64?: string; mimeType?: string; url?: string }; id?: string; type: string };
        const artifactId = p.id ?? `artifact-${this.ts()}`;
        const itemId = artifactId;
        this.emit({
          type: "reply.item.added",
          replyId: this.replyId,
          runId: this.runId,
          itemId,
          kind: "artifact",
          ts: this.ts(),
        });
        this.emit({
          type: "artifact.created",
          replyId: this.replyId,
          runId: this.runId,
          itemId,
          artifactId,
          artifactType: p.file.mimeType ?? "file",
          title: p.file.mimeType ?? "File",
          url: p.file.url,
          ts: this.ts(),
        });
        break;
      }

      // -----------------------------------------------------------------------
      // Finish / error / abort
      // -----------------------------------------------------------------------
      case "finish": {
        const p = part as { finishReason: string; totalUsage?: { promptTokens: number; completionTokens: number } };
        if (p.finishReason === "error") {
          this.emit({
            type: "reply.failed",
            replyId: this.replyId,
            runId: this.runId,
            error: "stream finished with error",
            ts: this.ts(),
          });
        } else {
          this.emit({
            type: "reply.completed",
            replyId: this.replyId,
            runId: this.runId,
            ts: this.ts(),
          });
        }
        break;
      }

      case "error": {
        const p = part as { error: unknown };
        const errMsg =
          p.error instanceof Error
            ? p.error.message
            : typeof p.error === "string"
              ? p.error
              : "stream error";
        this.emit({
          type: "reply.failed",
          replyId: this.replyId,
          runId: this.runId,
          error: errMsg,
          ts: this.ts(),
        });
        break;
      }

      case "abort": {
        const p = part as { reason?: string };
        this.emit({
          type: "reply.failed",
          replyId: this.replyId,
          runId: this.runId,
          error: p.reason ?? "aborted",
          ts: this.ts(),
        });
        break;
      }

      // finish-step, start-step, raw, tool-input-end — no canonical event needed
      default:
        break;
    }
  }


  /**
   * Post-process accumulated text after a text item closes.
   * Extracts structured patterns that AI SDK providers don't emit as native events:
   *   - <thinking>/<think>/<thought> → reasoning item (skipped if provider already sent reasoning events)
   *   - <document title="..."> → artifact item
   */
  private extractStructuredParts(text: string, afterItemId: string): void {
    // ── Thinking blocks ──────────────────────────────────────────────────────
    // Only extract if no native reasoning-start/delta events were received.
    // Anthropic's AI SDK already handles these; this path is for models that
    // embed <thinking> in plain text (e.g. DeepSeek, Kimi, local models).
    if (!this.hasNativeReasoning) {
      const thinkRe = /<(?:thinking|think|thought)>([\s\S]*?)(?:<\/(?:thinking|think|thought)>|$)/g;
      let m: RegExpExecArray | null;
      let idx = 0;
      while ((m = thinkRe.exec(text)) !== null) {
        const content = m[1].trim();
        if (!content) continue;
        const itemId = `thinking-${afterItemId}-${idx++}`;
        this.emit({ type: "reply.item.added", replyId: this.replyId, runId: this.runId, itemId, kind: "reasoning", ts: this.ts() });
        this.emit({ type: "reply.reasoning.delta", replyId: this.replyId, runId: this.runId, itemId, delta: content, ts: this.ts() });
        this.emit({ type: "reply.item.done", replyId: this.replyId, runId: this.runId, itemId, ts: this.ts() });
      }
    }

    // ── Document blocks ──────────────────────────────────────────────────────
    // <document title="...">content</document> — explicit long-form AI artifacts.
    const docRe = /<document(?:\s+title="([^"]*)")?>([\s\S]*?)(?:<\/document>|$)/g;
    let m2: RegExpExecArray | null;
    let docIdx = 0;
    while ((m2 = docRe.exec(text)) !== null) {
      const title = m2[1]?.trim() || "Document";
      const content = m2[2].trim();
      if (!content) continue;
      const artifactId = `doc-${afterItemId}-${docIdx++}`;
      this.emit({ type: "reply.item.added", replyId: this.replyId, runId: this.runId, itemId: artifactId, kind: "artifact", ts: this.ts() });
      this.emit({
        type: "artifact.created",
        replyId: this.replyId,
        runId: this.runId,
        itemId: artifactId,
        artifactId,
        artifactType: "document",
        title,
        inlinePreview: content,
        ts: this.ts(),
      });
    }
  }

  /**
   * Consume an AI SDK fullStream AsyncIterable, emitting ReplyEvents for each part.
   * Handles errors gracefully — emits reply.failed rather than throwing.
   */
  async consume(stream: AsyncIterable<AiSdkStreamPart>): Promise<void> {
    try {
      for await (const part of stream) {
        this.process(part);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "stream consume error";
      this.emit({
        type: "reply.failed",
        replyId: this.replyId,
        runId: this.runId,
        error: errMsg,
        ts: this.ts(),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface McpAppPayload {
  type: "mcp-app";
  connectorId?: string;
  connectorName?: string;
  resourceUri?: string;
  title?: string;
  description?: string;
  html?: string;
  allow?: string;
  prefersBorder?: boolean;
  csp?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  domain?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
}

function isMcpAppResult(result: unknown): result is McpAppPayload {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as Record<string, unknown>)["type"] === "mcp-app"
  );
}
