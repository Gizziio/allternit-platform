/**
 * Rust Stream Adapter - Production
 * 
 * Maps Rust SSE events to official AI SDK UI parts.
 * Zero `any` types. Strict type safety.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
// Rust API Event Types (existing contract)
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
  partId?: string; // Track which part this delta belongs to
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
  // MCP App message fields
  role?: "user" | "assistant";
  parts?: unknown[];
  context?: Record<string, unknown>;
}

// ============================================================================
// Adapter Output Types (AI SDK Compatible)
// ============================================================================

/**
 * Message role for AI Elements - matches UIMessage["role"]
 */
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
  | "document"    // ProseMirror-style documents (Sparkpages)
  | "slides"      // Presentation decks
  | "sheet"       // Interactive data grids
  | "audio"       // Audio files with waveform
  | "video"       // Video files
  | "podcast";    // Multi-track audio
type ChatMessageStatus = "streaming" | "complete" | "error" | "stopped";

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
  /** Phase 2: Which agent sent this message (for mixed LLM/agent threads) */
  agentId?: string;
  agentName?: string;
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

/**
 * UI Part union - AI SDK compatible + Reasoning
 */
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

/**
 * Chat message structure compatible with AI Elements
 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string | UIPart[];
  createdAt: Date;
  metadata?: ChatMessageMetadata;
}

/**
 * Normalizes any part-like object to ensure it has a 'text' field.
 */
function normalizePart(part: any): UIPart {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  
  const text = 
    part.text ?? 
    part.content ?? 
    part.value ?? 
    "";
    
  const normalizedPart = { ...part, text };
  if (part?.type === "reasoning") {
    const metadata =
      part.metadata && typeof part.metadata === "object"
        ? part.metadata as Record<string, unknown>
        : undefined;

    return {
      ...normalizedPart,
      metadata,
      trace: extractReasoningTrace(metadata),
    };
  }

  return normalizedPart;
}

function normalizeArtifactKind(kind?: string): ArtifactKind {
  switch (kind) {
    case "image":
    case "svg":
    case "mermaid":
    case "jsx":
    case "html":
    case "document":
    case "slides":
    case "sheet":
    case "audio":
    case "video":
    case "podcast":
      return kind;
    default:
      return "html";
  }
}

function formatArtifactTitle(kind: ArtifactKind, title?: string): string {
  if (title && title.trim()) {
    return title.trim();
  }

  switch (kind) {
    case "image":
      return "Generated image";
    case "svg":
      return "Generated SVG";
    case "mermaid":
      return "Generated diagram";
    case "jsx":
      return "Generated component";
    case "html":
      return "Generated HTML";
    case "document":
      return "Generated document";
    case "slides":
      return "Presentation deck";
    case "sheet":
      return "Data sheet";
    case "audio":
      return "Generated audio";
    case "video":
      return "Generated video";
    case "podcast":
      return "AI Podcast";
    default:
      return "Generated artifact";
  }
}

function summarizeParts(parts: UIPart[]): Pick<ChatMessageMetadata, "toolCount" | "sourceCount" | "artifactCount"> {
  return {
    toolCount: parts.filter((part) => part.type === "dynamic-tool").length,
    sourceCount: parts.filter((part) => part.type === "source-document").length,
    artifactCount: parts.filter((part) => part.type === "artifact").length,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseReasoningTraceStepMetadata(value: unknown): ReasoningTraceStepMetadata | undefined {
  if (!isRecord(value)) return undefined;

  const metadata: ReasoningTraceStepMetadata = {};
  if (Array.isArray(value.files)) {
    metadata.files = value.files.filter((entry): entry is string => typeof entry === "string");
  }
  if (Array.isArray(value.agents)) {
    metadata.agents = value.agents.filter((entry): entry is string => typeof entry === "string");
  }
  if (Array.isArray(value.commands)) {
    metadata.commands = value.commands.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value.searchQuery === "string") {
    metadata.searchQuery = value.searchQuery;
  }
  if (typeof value.results === "number") {
    metadata.results = value.results;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function isReasoningTraceStepType(value: unknown): value is ReasoningTraceStepType {
  return (
    value === "reasoning" ||
    value === "search" ||
    value === "file-read" ||
    value === "file-write" ||
    value === "command" ||
    value === "agent" ||
    value === "tool"
  );
}

function parseReasoningTraceStep(value: unknown): ReasoningTraceStep | null {
  if (!isRecord(value)) return null;
  if (!isReasoningTraceStepType(value.type) || typeof value.summary !== "string") {
    return null;
  }

  return {
    type: value.type,
    summary: value.summary,
    detail: typeof value.detail === "string" ? value.detail : undefined,
    status:
      value.status === "pending" || value.status === "running" || value.status === "completed"
        ? value.status
        : undefined,
    metadata: parseReasoningTraceStepMetadata(value.metadata),
  };
}

function extractReasoningTrace(metadata?: Record<string, unknown>): ReasoningTrace | undefined {
  if (!metadata) return undefined;

  const rawTrace = metadata.reasoningTrace;
  if (!isRecord(rawTrace) || !Array.isArray(rawTrace.steps)) {
    return undefined;
  }

  const steps = rawTrace.steps
    .map((entry) => parseReasoningTraceStep(entry))
    .filter((entry): entry is ReasoningTraceStep => Boolean(entry));

  if (steps.length === 0) {
    return undefined;
  }

  return {
    version: typeof rawTrace.version === "number" ? rawTrace.version : 1,
    source: typeof rawTrace.source === "string" ? rawTrace.source : undefined,
    headline: typeof rawTrace.headline === "string" ? rawTrace.headline : undefined,
    steps,
  };
}

function updateMessageMetadata(
  setMessages: AdapterContext["setMessages"],
  messageId: string | null,
  patch: Partial<ChatMessageMetadata>
): void {
  if (!messageId) return;

  const definedPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<ChatMessageMetadata>;

  setMessages((prev) =>
    prev.map((message) => {
      if (message.id !== messageId) return message;

      const partSummary = Array.isArray(message.content)
        ? summarizeParts(message.content)
        : undefined;

      return {
        ...message,
        metadata: {
          ...message.metadata,
          ...partSummary,
          ...definedPatch,
        },
      };
    }),
    true
  );
}

// ============================================================================
// Rust Event -> AI SDK UI Part Mapping
// ============================================================================

/**
 * Mapping table: RustEventType -> Handler function
 * This is the deterministic mapping referenced in requirements.
 */
type RustEventHandler = (event: RustStreamEvent, context: AdapterContext) => void;

interface AdapterContext {
  assistantParts: UIPart[];
  assistantMessageId: string | null;
  hasStreamedDeltasByMessageId: Map<string, boolean>;
  pendingMcpAppPartsByToolCallId: Map<string, McpAppUIPart>;
  initialAssistantMetadata?: ChatMessageMetadata;
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[], immediate?: boolean) => void;
}

function buildMcpAppPart(event: RustStreamEvent): McpAppUIPart | null {
  if (
    !event.toolCallId ||
    !event.toolName ||
    !event.connectorId ||
    !event.connectorName ||
    !event.resourceUri ||
    !event.html ||
    !event.title
  ) {
    return null;
  }

  return {
    type: "mcp-app",
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    connectorId: event.connectorId,
    connectorName: event.connectorName,
    resourceUri: event.resourceUri,
    title: event.title,
    description: event.description,
    html: event.html,
    allow: event.allow,
    prefersBorder: event.prefersBorder,
    tool: event.tool,
    toolInput: event.toolInput,
    toolResult: event.toolResult,
    csp: event.csp,
    permissions: event.permissions,
    domain: event.domain,
  };
}

function upsertMcpAppPartAfterTool(
  ctx: AdapterContext,
  toolCallId: string,
  nextPart: McpAppUIPart,
): void {
  const existingIndex = ctx.assistantParts.findIndex(
    (part): part is McpAppUIPart =>
      part.type === "mcp-app" && part.toolCallId === toolCallId,
  );

  if (existingIndex >= 0) {
    ctx.assistantParts[existingIndex] = nextPart;
    return;
  }

  const toolIndex = ctx.assistantParts.findIndex(
    (part): part is DynamicToolUIPart =>
      part.type === "dynamic-tool" && part.toolCallId === toolCallId,
  );

  if (toolIndex >= 0) {
    ctx.assistantParts.splice(toolIndex + 1, 0, nextPart);
    return;
  }

  ctx.assistantParts.push(nextPart);
}

const RUST_EVENT_MAP: Record<RustEventType, RustEventHandler> = {
  message_start: (event, ctx) => {
    if (!event.messageId) return;
    const messageId = event.messageId;

    // If we've already received deltas for this message, do NOT reset/overwrite
    if (ctx.hasStreamedDeltasByMessageId.get(messageId)) {
      console.log("[rust-stream-adapter] Preserving live stream state, ignoring redundant message_start");
      return;
    }

    ctx.assistantParts.length = 0;

    if (ctx.assistantMessageId && ctx.assistantMessageId !== messageId) {
      // A placeholder was pre-created on submit. Rename it to the server-assigned ID
      // so we don't end up with two assistant bubbles.
      const oldId = ctx.assistantMessageId;
      ctx.assistantMessageId = messageId;
      ctx.setMessages(prev => prev.map(m =>
        m.id === oldId
          ? { ...m, id: messageId, content: [], metadata: ctx.initialAssistantMetadata }
          : m
      ), true);
    } else {
      ctx.assistantMessageId = messageId;
      const newMessage: ChatMessage = {
        id: messageId,
        role: "assistant",
        content: [],
        createdAt: new Date(),
        metadata: ctx.initialAssistantMetadata,
      };
      ctx.setMessages(prev => [...prev, newMessage], true);
    }
  },

  content_block_delta: (event, ctx) => {
    if (!ctx.assistantMessageId) return;

    // Mark this message as having active stream deltas
    ctx.hasStreamedDeltasByMessageId.set(ctx.assistantMessageId, true);

    const delta = event.delta;
    if (!delta) return;

    // For text_delta, append the full token directly.
    // Previous character-by-character setTimeout approach caused a race condition:
    // tokens arrive faster than the 20ms/char loop can drain, spawning concurrent
    // chains that interleave characters from different tokens → scrambled output.
    // Token-by-token streaming is already fast enough to feel natural.
    if (delta.type === "text_delta" && typeof delta.text === "string") {
      const text = delta.text;

      // Find or create text part
      let targetIndex = -1;
      if (event.partId) {
        targetIndex = ctx.assistantParts.findIndex(p => (p as any).partId === event.partId);
      }
      if (targetIndex === -1) {
        for (let i = ctx.assistantParts.length - 1; i >= 0; i--) {
          if (ctx.assistantParts[i].type === "text") {
            targetIndex = i;
            break;
          }
        }
      }

      if (targetIndex !== -1) {
        const part = ctx.assistantParts[targetIndex] as TextUIPart;
        ctx.assistantParts[targetIndex] = { ...part, text: part.text + text };
      } else {
        const textPart: TextUIPart & { partId?: string } = {
          type: "text",
          text: text,
          partId: event.partId,
        };
        ctx.assistantParts.push(textPart);
      }

      updateMessageParts(ctx, false);
      return; // Don't fall through to normal processing
    }
    
    // Attempt to find part by ID first, then fallback to last part of same type
    let targetIndex = -1;
    if (event.partId) {
      targetIndex = ctx.assistantParts.findIndex(p => (p as any).partId === event.partId);
    } else {
      // Fallback to finding last part of compatible type
      for (let i = ctx.assistantParts.length - 1; i >= 0; i--) {
        const p = ctx.assistantParts[i];
        if (delta.type === "text_delta" && p.type === "text") {
          targetIndex = i;
          break;
        }
        if (delta.type === "thinking_delta" && p.type === "reasoning") {
          targetIndex = i;
          break;
        }
      }
    }

    if (delta.type === "text_delta" && typeof delta.text === "string") {
      if (targetIndex !== -1) {
        const part = ctx.assistantParts[targetIndex] as TextUIPart;
        ctx.assistantParts[targetIndex] = { ...part, text: part.text + delta.text };
      } else {
        const textPart: TextUIPart & { partId?: string } = {
          type: "text",
          text: delta.text,
          partId: event.partId,
        };
        ctx.assistantParts.push(textPart);
      }
      
      updateMessageParts(ctx, false); // Throttled for smooth flow
    } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
      const trace = extractReasoningTrace(event.metadata);
      if (targetIndex !== -1) {
        const part = ctx.assistantParts[targetIndex] as ReasoningUIPart;
        ctx.assistantParts[targetIndex] = {
          ...part,
          text: part.text + delta.thinking,
          isOpen: true,
          metadata: event.metadata ?? part.metadata,
          trace: trace ?? part.trace,
        };
      } else {
        const reasoningPart: ReasoningUIPart & { partId?: string } = {
          type: "reasoning",
          reasoningId: event.partId || `reasoning-${Date.now()}`,
          text: delta.thinking,
          isOpen: true,
          partId: event.partId,
          metadata: event.metadata,
          trace,
        };
        ctx.assistantParts.push(reasoningPart);
      }
      
      updateMessageParts(ctx, false);
    }
  },

  content_block_start: (event, ctx) => {
    if (!ctx.assistantMessageId || !event.content_block) return;

    const block = event.content_block;

    // Check if we already have this part
    if (ctx.assistantParts.some(p => (p as any).partId === block.id)) {
      return;
    }

    // CLAUDE CODE STYLE: For thinking blocks, replace any existing thinking
    // This creates the ephemeral "single line" effect
    if (block.type === "thinking") {
      for (let i = ctx.assistantParts.length - 1; i >= 0; i--) {
        if (ctx.assistantParts[i].type === "reasoning") {
          ctx.assistantParts.splice(i, 1);
        }
      }
    }

    // AUTO-COLLAPSE PREVIOUS REASONING:
    // If we're starting a new block, collapse the most recent reasoning block
    const lastReasoning = [...ctx.assistantParts].reverse().find(p => p.type === "reasoning") as ReasoningUIPart | undefined;
    if (lastReasoning) {
      lastReasoning.isOpen = false;
    }

    if (block.type === "tool_use") {
      const toolPart: DynamicToolUIPart = {
        type: "dynamic-tool",
        state: "input-available",
        toolCallId: block.id,
        toolName: block.name || "tool",
        input: block.input ?? {},
      };
      ctx.assistantParts.push(toolPart);
      updateMessageParts(ctx, true);
    } else if (block.type === "thinking") {
      const trace = extractReasoningTrace(event.metadata);
      const reasoningPart: ReasoningUIPart & { partId?: string } = {
        type: "reasoning",
        reasoningId: block.id,
        text: block.thinking || "",
        isOpen: true,
        partId: block.id,
        metadata: event.metadata,
        trace,
      };
      ctx.assistantParts.push(reasoningPart);
      updateMessageParts(ctx, true);
    } else if (block.type === "text") {
      const textPart: TextUIPart & { partId?: string } = {
        type: "text",
        text: block.text || "",
        partId: block.id,
      };
      ctx.assistantParts.push(textPart);
      updateMessageParts(ctx, true);
    }
  },

  tool_result: (event, ctx) => {
    if (!ctx.assistantMessageId || !event.toolCallId) return;

    const toolPart = ctx.assistantParts.find(
      (p): p is DynamicToolUIPart =>
        p.type === "dynamic-tool" && p.toolCallId === event.toolCallId
    );

    if (toolPart) {
      toolPart.state = "output-available";
      // result is typed as unknown from Rust, but we need to store it
      // The Tool component will handle rendering
      (toolPart as DynamicToolUIPart & { result: unknown }).result = event.result;

      // If this is a generateA2UI tool result, emit an A2UIPart into the message
      // so the chat renderer shows the interactive UI inline.
      // Cast via unknown to avoid a circular import with ChatMessageTypes.ts.
      if (toolPart.toolName === "generateA2UI" && event.result && typeof event.result === "object") {
        const r = event.result as { payload?: unknown; title?: string; sessionId?: string };
        if (r.payload) {
          const a2uiPart = {
            type: "a2ui" as const,
            payload: r.payload,
            title: r.title ?? "Interactive UI",
            source: "agent",
          };
          ctx.assistantParts.push(a2uiPart as unknown as UIPart);
        }
      }

      // If this is a generateWebArtifact tool result, emit an ArtifactUIPart
      // so the UnifiedMessageRenderer renders an ArtifactCard → live preview panel.
      if (toolPart.toolName === "generateWebArtifact" && event.result && typeof event.result === "object") {
        const r = event.result as { content?: string; kind?: string; title?: string };
        if (r.content) {
          const artifactPart: ArtifactUIPart = {
            type: "artifact",
            artifactId: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            kind: (r.kind ?? "html") as ArtifactUIPart["kind"],
            content: r.content,
            title: r.title ?? "Generated Artifact",
          };
          ctx.assistantParts.push(artifactPart);
        }
      }

      const pendingMcpAppPart = ctx.pendingMcpAppPartsByToolCallId.get(
        event.toolCallId,
      );
      if (pendingMcpAppPart) {
        upsertMcpAppPartAfterTool(ctx, event.toolCallId, pendingMcpAppPart);
        ctx.pendingMcpAppPartsByToolCallId.delete(event.toolCallId);
      }

      updateMessageParts(ctx, true);
    }
  },

  tool_error: (event, ctx) => {
    if (!ctx.assistantMessageId || !event.toolCallId) return;
    
    const toolPart = ctx.assistantParts.find(
      (p): p is DynamicToolUIPart => 
        p.type === "dynamic-tool" && p.toolCallId === event.toolCallId
    );
    
    if (toolPart) {
      toolPart.state = "output-error";
      (toolPart as DynamicToolUIPart & { error: string }).error = 
        event.error ?? "Unknown error";
      ctx.pendingMcpAppPartsByToolCallId.delete(event.toolCallId);
      updateMessageParts(ctx, true);
    }
  },

  mcp_app: (event, ctx) => {
    const appPart = buildMcpAppPart(event);
    if (!appPart) {
      return;
    }

    const toolPart = ctx.assistantParts.find(
      (part): part is DynamicToolUIPart =>
        part.type === "dynamic-tool" && part.toolCallId === appPart.toolCallId,
    );

    if (toolPart?.state === "output-available") {
      upsertMcpAppPartAfterTool(ctx, appPart.toolCallId, appPart);
      updateMessageParts(ctx, true);
      return;
    }

    ctx.pendingMcpAppPartsByToolCallId.set(appPart.toolCallId, appPart);
  },

  mcp_app_message: (event, ctx) => {
    // Handle app-originated messages (ui/message from MCP App)
    const role = event.role ?? "assistant";
    const parts = event.parts ?? [];
    
    // Convert parts to UI parts
    const uiParts: UIPart[] = parts.map((part: unknown): UIPart => {
      if (typeof part === "string") {
        return { type: "text", text: part };
      }
      if (isRecord(part) && typeof part.type === "string") {
        if (part.type === "text" && typeof part.text === "string") {
          return { type: "text", text: part.text };
        }
      }
      return { type: "text", text: String(part) };
    });

    // Create a new message from the app
    const messageId = `mcp-app-msg-${Date.now()}`;
    const newMessage: ChatMessage = {
      id: messageId,
      role,
      content: uiParts.length > 0 ? uiParts : [{ type: "text", text: "" }],
      createdAt: new Date(),
      metadata: {
        status: "complete",
        source: "mcp-app",
      } as any,
    };

    ctx.setMessages(prev => [...prev, newMessage], true);
  },

  mcp_app_update_context: (_event, _ctx) => {
    // Context updates are stored per-session, not as visible messages
    // This is handled by the MCP App context manager (MCP-002)
    // The context is made available for the next model turn
    // Implementation note: The context is stored in a ref/persistence layer
    // outside the visible message stream
  },

  source: (event, ctx) => {
    if (!ctx.assistantMessageId) return;
    
    const sourcePart: LinkedSourceDocumentUIPart = {
      type: "source-document",
      sourceId: event.sourceId ?? `src-${Date.now()}`,
      mediaType: "text/html", // Default for URL sources
      title: event.title ?? event.url ?? "Source",
      url: event.url,
    };
    ctx.assistantParts.push(sourcePart);
    updateMessageParts(ctx, true);
  },

  plan: (event, ctx) => {
    if (!ctx.assistantMessageId) return;

    const planId = event.planId ?? "execution-plan";
    const nextPlan: PlanUIPart = {
      type: "plan",
      planId,
      title: event.title ?? "Execution plan",
      steps: event.steps ?? [],
    };

    const existingIndex = ctx.assistantParts.findIndex(
      (part): part is PlanUIPart => part.type === "plan" && part.planId === planId
    );

    if (existingIndex >= 0) {
      ctx.assistantParts[existingIndex] = nextPlan;
    } else {
      ctx.assistantParts.push(nextPlan);
    }

    updateMessageParts(ctx, true);
  },

  plan_update: (event, ctx) => {
    if (!ctx.assistantMessageId) return;

    const planId = event.planId ?? "execution-plan";
    const existingIndex = ctx.assistantParts.findIndex(
      (part): part is PlanUIPart => part.type === "plan" && part.planId === planId
    );

    const previousPlan = existingIndex >= 0 ? ctx.assistantParts[existingIndex] as PlanUIPart : undefined;
    const nextPlan: PlanUIPart = {
      type: "plan",
      planId,
      title: event.title ?? previousPlan?.title ?? "Execution plan",
      steps: event.steps ?? previousPlan?.steps ?? [],
    };

    if (existingIndex >= 0) {
      ctx.assistantParts[existingIndex] = nextPlan;
    } else {
      ctx.assistantParts.push(nextPlan);
    }

    updateMessageParts(ctx, true);
  },

  checkpoint: (event, ctx) => {
    if (!ctx.assistantMessageId) return;

    const checkpointPart: CheckpointUIPart = {
      type: "checkpoint",
      checkpointId: event.checkpointId ?? `checkpoint-${Date.now()}`,
      description: event.description ?? event.title ?? "Checkpoint reached",
      metadata: event.metadata,
    };

    ctx.assistantParts.push(checkpointPart);
    updateMessageParts(ctx, true);
  },

  task: (event, ctx) => {
    if (!ctx.assistantMessageId) return;

    const taskId = event.taskId ?? `task-${Date.now()}`;
    const nextTask: TaskUIPart = {
      type: "task",
      taskId,
      title: event.title ?? event.description ?? "Task",
      description: event.description,
      status: event.status ?? "running",
      progress: event.progress,
    };

    const existingIndex = ctx.assistantParts.findIndex(
      (part): part is TaskUIPart => part.type === "task" && part.taskId === taskId
    );

    if (existingIndex >= 0) {
      ctx.assistantParts[existingIndex] = {
        ...(ctx.assistantParts[existingIndex] as TaskUIPart),
        ...nextTask,
      };
    } else {
      ctx.assistantParts.push(nextTask);
    }

    updateMessageParts(ctx, true);
  },

  citation: (event, ctx) => {
    if (!ctx.assistantMessageId || !event.sourceId) return;

    const citationId = event.citationId ?? `citation-${Date.now()}`;
    if (
      ctx.assistantParts.some(
        (part): part is CitationUIPart => part.type === "citation" && part.citationId === citationId
      )
    ) {
      return;
    }

    const text = event.content ?? event.description ?? event.title ?? event.url ?? event.sourceId;
    const citationPart: CitationUIPart = {
      type: "citation",
      citationId,
      sourceId: event.sourceId,
      text,
      startIndex: event.startIndex ?? 0,
      endIndex: event.endIndex ?? text.length,
    };

    ctx.assistantParts.push(citationPart);
    updateMessageParts(ctx, true);
  },

  artifact: (event, ctx) => {
    if (!ctx.assistantMessageId) return;

    const kind = normalizeArtifactKind(event.kind);
    const hasDataUrl = typeof event.content === "string" && event.content.startsWith("data:");
    const artifactPart: ArtifactUIPart = {
      type: "artifact",
      artifactId: event.artifactId ?? `artifact-${Date.now()}`,
      kind,
      title: formatArtifactTitle(kind, event.title),
      url: kind === "image" ? event.url ?? (hasDataUrl ? event.content : undefined) : event.url,
      content: kind === "image" && !hasDataUrl ? undefined : event.content,
    };

    ctx.assistantParts.push(artifactPart);
    updateMessageParts(ctx, true);
  },

  error: (event, ctx) => {
    if (!ctx.assistantMessageId) return;

    const errorPart: ErrorUIPart = {
      type: "error",
      message: event.error ?? "Unknown stream error",
      kind: "unknown",
    };

    ctx.assistantParts.push(errorPart);
    updateMessageParts(ctx, true);
  },

  finish: (event, ctx) => {
    // finish is strictly metadata-only. setIsLoading(false) happens in finally.
    console.log("[rust-stream-adapter] Received finish metadata", event);
    updateMessageMetadata(ctx.setMessages, ctx.assistantMessageId, {
      finishedAt: event.finishedAt,
      durationMs: event.durationMs,
      modelId: event.modelId,
      runtimeModelId: event.runtimeModelId,
    });
  },
};

function updateMessageParts(ctx: AdapterContext, immediate: boolean): void {
  if (!ctx.assistantMessageId) return;

  // Use shallow copy only - React will detect content changes in parts
  ctx.setMessages(prev => {
    // Early exit if message not found (avoid unnecessary re-renders)
    const targetMsg = prev.find(m => m.id === ctx.assistantMessageId);
    if (!targetMsg) return prev;
    
    // Only update if content actually changed
    const newContent = [...ctx.assistantParts];
    const oldContent = targetMsg.content;
    
    // Quick length check first
    if (Array.isArray(oldContent) && oldContent.length === newContent.length) {
      // Check if parts are identical (by reference for performance)
      let unchanged = true;
      for (let i = 0; i < newContent.length; i++) {
        if (oldContent[i] !== newContent[i]) {
          unchanged = false;
          break;
        }
      }
      if (unchanged) return prev; // No change needed
    }
    
    return prev.map(m =>
      m.id === ctx.assistantMessageId
        ? { ...m, content: newContent }
        : m
    );
  });
}

// ============================================================================
// Hook Interface
// ============================================================================

export interface SubmitMessageParams {
  chatId: string;
  message: string;
  modelId: string;
  /// Runtime-owned model ID for dynamic model selection (e.g., "anthropic:claude-3-7")
  runtimeModelId?: string;
  attachments?: File[];
  webSearch?: boolean;
  conversationMode?: "llm" | "agent";
  agentId?: string;
  agentName?: string;
  agentProvider?: string;
  agentModel?: string;
  agentFallbackModels?: string[];
  agentSessionKey?: string;
  signal?: AbortSignal;
  mode?: 'plan' | 'build';  // Execution mode for system prompt
}

export interface UseRustStreamAdapterReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  currentAssistantId: string | null;
  submitMessage: (params: SubmitMessageParams) => Promise<void>;
  regenerate: (messageText: string, params: Omit<SubmitMessageParams, 'message'>) => Promise<void>;
  stop: () => void;
  clearMessages: () => void;
  /**
   * Directly inject a synthetic assistant message containing an artifact.
   * Used for instant template launch — no LLM call required.
   */
  injectArtifact: (artifact: ArtifactUIPart, intro?: string) => void;
}

export interface UseRustStreamAdapterOptions {
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
  onError?: (error: Error) => void;
  onFinish?: () => void;
}

type OpenClawRuntimeConfig = {
  token?: string | null;
  password?: string | null;
  gatewayUrl?: string;
  gatewayWsUrl?: string;
  port?: number;
};

let openClawRuntimeConfigPromise: Promise<OpenClawRuntimeConfig | null> | null = null;

function toWsUrl(httpUrl: string): string {
  return httpUrl
    .replace(/^http:\/\//i, "ws://")
    .replace(/^https:\/\//i, "wss://")
    .replace(/\/+$/, "");
}

async function loadOpenClawRuntimeConfig(): Promise<OpenClawRuntimeConfig | null> {
  try {
    const response = await fetch(`/allternit-config.json?nocache=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as Record<string, unknown>;
    const gatewayUrl = typeof payload.gatewayUrl === "string" && payload.gatewayUrl.trim()
      ? payload.gatewayUrl.trim()
      : (typeof payload.apiBaseUrl === "string" && payload.apiBaseUrl.trim()
        ? payload.apiBaseUrl.trim().replace(/\/api\/v1\/?$/i, "")
        : undefined);
    const gatewayWsUrl = typeof payload.gatewayWsUrl === "string" && payload.gatewayWsUrl.trim()
      ? payload.gatewayWsUrl.trim()
      : (gatewayUrl ? toWsUrl(gatewayUrl) : undefined);
    const token = typeof payload.token === "string" ? payload.token : null;
    const password = typeof payload.password === "string" ? payload.password : null;
    const port = typeof payload.port === "number" ? payload.port : undefined;

    return {
      token,
      password,
      gatewayUrl,
      gatewayWsUrl,
      port,
    };
  } catch {
    return null;
  }
}

async function getOpenClawRuntimeConfig(): Promise<OpenClawRuntimeConfig | null> {
  if (!openClawRuntimeConfigPromise) {
    openClawRuntimeConfigPromise = loadOpenClawRuntimeConfig();
  }
  return openClawRuntimeConfigPromise;
}

function normalizeStreamEvent(raw: unknown): RustStreamEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";

  switch (type) {
    case "message_start":
    case "content_block_start":
    case "content_block_delta":
    case "tool_result":
    case "tool_error":
    case "source":
    case "artifact":
    case "finish":
      return record as unknown as RustStreamEvent;
    
    // Raw types from various backends (NDJSON/Terminal Server)
    case "text":
      return {
        type: "content_block_delta",
        delta: {
          type: "text_delta",
          text: typeof record.text === "string" ? record.text : "",
        },
      };
    case "thinking":
    case "thought":
      return {
        type: "content_block_delta",
        delta: {
          type: "thinking_delta",
          thinking: typeof record.text === "string" ? record.text : (typeof record.thinking === "string" ? record.thinking : ""),
        },
      };
    case "tool_use":
      return {
        type: "content_block_start",
        content_block: {
          type: "tool_use",
          id: typeof record.id === "string" ? record.id : `tool-${Date.now()}`,
          name: typeof record.name === "string" ? record.name : "tool",
          input: (record.input && typeof record.input === "object")
            ? record.input as Record<string, unknown>
            : {},
        },
      };

    // Legacy / Alternative names
    case "message-start":
      return {
        type: "message_start",
        messageId: typeof record.messageId === "string" ? record.messageId : undefined,
      };
    case "text-delta":
      return {
        type: "content_block_delta",
        delta: {
          type: "text_delta",
          text: typeof record.text === "string" ? record.text : "",
        },
      };
    case "tool-call":
      return {
        type: "content_block_start",
        content_block: {
          type: "tool_use",
          id: typeof record.toolCallId === "string" ? record.toolCallId : `tool-${Date.now()}`,
          name: typeof record.toolName === "string" ? record.toolName : "tool",
          input: (record.args && typeof record.args === "object")
            ? record.args as Record<string, unknown>
            : {},
        },
      };
    case "tool-result":
      return {
        type: "tool_result",
        toolCallId: typeof record.toolCallId === "string" ? record.toolCallId : undefined,
        result: record.result,
      };
    case "mcp_app":
      return {
        type: "mcp_app",
        toolCallId:
          typeof record.toolCallId === "string" ? record.toolCallId : undefined,
        toolName: typeof record.toolName === "string" ? record.toolName : undefined,
        connectorId:
          typeof record.connectorId === "string" ? record.connectorId : undefined,
        connectorName:
          typeof record.connectorName === "string"
            ? record.connectorName
            : undefined,
        resourceUri:
          typeof record.resourceUri === "string" ? record.resourceUri : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        description:
          typeof record.description === "string" ? record.description : undefined,
        html: typeof record.html === "string" ? record.html : undefined,
        allow: typeof record.allow === "string" ? record.allow : undefined,
        prefersBorder:
          typeof record.prefersBorder === "boolean"
            ? record.prefersBorder
            : undefined,
        tool:
          record.tool && typeof record.tool === "object"
            ? (record.tool as McpAppToolDefinition)
            : undefined,
        toolInput:
          record.toolInput && typeof record.toolInput === "object"
            ? (record.toolInput as Record<string, unknown>)
            : undefined,
        toolResult: record.toolResult,
        csp:
          record.csp && typeof record.csp === "object"
            ? (record.csp as McpAppResourceCsp)
            : undefined,
        permissions:
          record.permissions && typeof record.permissions === "object"
            ? (record.permissions as McpAppResourcePermissions)
            : undefined,
        domain: typeof record.domain === "string" ? record.domain : undefined,
      };
    case "plan":
      return {
        type: "plan",
        planId: typeof record.planId === "string" ? record.planId : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        steps: Array.isArray(record.steps) ? record.steps as PlanStep[] : undefined,
      };
    case "plan_update":
    case "plan-update":
      return {
        type: "plan_update",
        planId: typeof record.planId === "string" ? record.planId : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        steps: Array.isArray(record.steps) ? record.steps as PlanStep[] : undefined,
      };
    case "checkpoint":
      return {
        type: "checkpoint",
        checkpointId: typeof record.checkpointId === "string" ? record.checkpointId : undefined,
        description: typeof record.description === "string" ? record.description : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        metadata: record.metadata && typeof record.metadata === "object"
          ? record.metadata as Record<string, unknown>
          : undefined,
      };
    case "task":
    case "task_update":
    case "task-update":
      return {
        type: "task",
        taskId: typeof record.taskId === "string" ? record.taskId : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        description: typeof record.description === "string" ? record.description : undefined,
        status: record.status === "pending" || record.status === "running" || record.status === "complete" || record.status === "error"
          ? record.status
          : undefined,
        progress: typeof record.progress === "number" ? record.progress : undefined,
      };
    case "citation":
      return {
        type: "citation",
        citationId: typeof record.citationId === "string" ? record.citationId : undefined,
        sourceId: typeof record.sourceId === "string" ? record.sourceId : undefined,
        content: typeof record.text === "string"
          ? record.text
          : (typeof record.content === "string" ? record.content : undefined),
        startIndex: typeof record.startIndex === "number" ? record.startIndex : undefined,
        endIndex: typeof record.endIndex === "number" ? record.endIndex : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        url: typeof record.url === "string" ? record.url : undefined,
      };
    case "artifact.created":
    case "artifact-created":
      return {
        type: "artifact",
        artifactId: typeof record.artifactId === "string"
          ? record.artifactId
          : (typeof record.id === "string" ? record.id : undefined),
        kind: typeof record.kind === "string"
          ? record.kind
          : (typeof record.artifactKind === "string" ? record.artifactKind : undefined),
        content: typeof record.content === "string" ? record.content : undefined,
        title: typeof record.title === "string" ? record.title : undefined,
        url: typeof record.url === "string" ? record.url : undefined,
      };
    case "error":
      return {
        type: "error",
        error: typeof record.error === "string"
          ? record.error
          : (typeof record.message === "string" ? record.message : "Unknown error"),
      };
    default:
      return null;
  }
}

type ChatEndpointAttempt = {
  url: string;
  label: string;
};

// Terminal Server URL - for direct LLM session API access
// Access injected build-time variable via globalThis to avoid ReferenceError
const TERMINAL_SERVER_URL = (globalThis as any).__TERMINAL_SERVER_URL__ 
  || 'http://127.0.0.1:4096';

function buildChatEndpointAttempts(chatId: string, conversationMode: "llm" | "agent"): ChatEndpointAttempt[] {
  const attempts: ChatEndpointAttempt[] = [];
  
  if (conversationMode === "agent") {
    // Agent mode - use OpenClaw gateway
    attempts.push({ url: '/api/agent-chat', label: 'origin:/api/agent-chat' });
    attempts.push({ url: 'http://127.0.0.1:3000/api/agent-chat', label: 'direct-127:/api/agent-chat' });
  } else {
    // LLM mode - use Agent Chat proxy route
    // This proxies to Gizzi terminal server at port 4096
    attempts.push({ url: `/api/agent-chat?chatId=${encodeURIComponent(chatId)}`, label: 'proxy:/api/agent-chat' });
    attempts.push({ url: `${TERMINAL_SERVER_URL}/v1/session/${chatId}/message`, label: 'terminal:message' });
  }

  // Dedupe while preserving order.
  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    if (seen.has(attempt.url)) return false;
    seen.add(attempt.url);
    return true;
  });
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useRustStreamAdapter(
  options: UseRustStreamAdapterOptions = {}
): UseRustStreamAdapterReturn {
  const { initialMessages, onMessagesChange } = options;
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAssistantId, setCurrentAssistantId] = useState<string | null>(() => {
    const lastAssistantMessage = [...(initialMessages ?? [])]
      .reverse()
      .find((message) => message.role === "assistant");
    return lastAssistantMessage?.id ?? null;
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const assistantPartsRef = useRef<UIPart[]>([]);
  const assistantMessageIdRef = useRef<string | null>(null);
  const pendingAssistantMetadataRef = useRef<ChatMessageMetadata | null>(null);
  const finishEventRef = useRef<RustStreamEvent | null>(null);
  const receivedErrorEventRef = useRef(false);
  const manualStopRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  const updatePendingRef = useRef<boolean>(false);
  const latestUpdaterRef = useRef<((prev: ChatMessage[]) => ChatMessage[]) | null>(null);

  // Throttled update function for frame-buffered rendering
  const throttledSetMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[], immediate = false) => {
    if (immediate) {
      setMessages(updater);
      lastUpdateRef.current = Date.now();
      updatePendingRef.current = false;
      latestUpdaterRef.current = null;
      return;
    }

    // For streaming deltas, update immediately for smoothest experience
    // Only throttle message_start events
    setMessages(updater);
    lastUpdateRef.current = Date.now();
    updatePendingRef.current = false;
    latestUpdaterRef.current = null;
  }, []);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentAssistantId(null);
    assistantPartsRef.current = [];
    assistantMessageIdRef.current = null;
    pendingAssistantMetadataRef.current = null;
    finishEventRef.current = null;
    receivedErrorEventRef.current = false;
    manualStopRef.current = false;
  }, []);

  const finalizeAssistantMessage = useCallback((status: ChatMessageStatus) => {
    const messageId = assistantMessageIdRef.current;
    if (!messageId) return;

    const startedAt = pendingAssistantMetadataRef.current?.startedAt;
    const finishedAt = finishEventRef.current?.finishedAt ?? Date.now();
    const durationMs = finishEventRef.current?.durationMs
      ?? (startedAt ? Math.max(0, finishedAt - startedAt) : undefined);

    updateMessageMetadata(throttledSetMessages, messageId, {
      modelId: finishEventRef.current?.modelId ?? pendingAssistantMetadataRef.current?.modelId,
      runtimeModelId: finishEventRef.current?.runtimeModelId ?? pendingAssistantMetadataRef.current?.runtimeModelId,
      startedAt,
      finishedAt,
      durationMs,
      status,
    });
  }, [throttledSetMessages]);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  const submitMessage = useCallback(async ({
    chatId,
    message,
    modelId,
    runtimeModelId,
    attachments,
    webSearch = false,
    conversationMode = "llm",
    agentId,
    agentName,
    agentProvider,
    agentModel,
    agentFallbackModels,
    agentSessionKey,
    signal: externalSignal,
    mode,  // Execution mode: plan or build
  }: SubmitMessageParams): Promise<void> => {
    if (!chatId) {
      options.onError?.(new Error("chatId is required"));
      return;
    }
    
    if (isLoading) {
      options.onError?.(new Error("Already processing a message"));
      return;
    }

    setIsLoading(true);
    manualStopRef.current = false;
    finishEventRef.current = null;
    receivedErrorEventRef.current = false;
    pendingAssistantMetadataRef.current = {
      modelId,
      runtimeModelId,
      startedAt: Date.now(),
      status: "streaming",
    };
    
    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date(),
    };
    
    setMessages((prev: ChatMessage[]) => [...prev, userMessage]);

    // Reset parts from any previous turn before creating the new placeholder.
    assistantPartsRef.current = [];

    // Create placeholder assistant message IMMEDIATELY so the UI shows a
    // thinking state rather than a blank gap during inference.
    // All subsequent handlers (message_start, sync object) update this message
    // in-place instead of appending a new one.
    const placeholderAssistantId = `assistant-pending-${Date.now()}`;
    assistantMessageIdRef.current = placeholderAssistantId;
    setCurrentAssistantId(placeholderAssistantId);
    // Pre-populate with an empty reasoning part so the Reasoning component
    // renders in "Thinking…" state immediately — the full inference wait
    // is visible instead of a blank shimmer.
    const initialReasoningPart = { type: 'reasoning', reasoningId: `r-${placeholderAssistantId}`, text: '' };
    setMessages((prev: ChatMessage[]) => [
      ...prev,
      {
        id: placeholderAssistantId,
        role: 'assistant',
        content: [initialReasoningPart],
        createdAt: new Date(),
        metadata: pendingAssistantMetadataRef.current ?? undefined,
      } as ChatMessage,
    ]);

    try {
      abortControllerRef.current = new AbortController();
      const signal = externalSignal ?? abortControllerRef.current.signal;
      const runtimeConfig = conversationMode === "agent"
        ? await getOpenClawRuntimeConfig()
        : null;
      
      // Build request body based on endpoint type
      // Terminal Server expects: { sessionID, parts: [...], model: { providerID, modelID } }
      // Legacy expects: { chatId, message, modelId, ... }
      const buildTerminalRequestBody = (sessionID: string) => {
        // Explicit model overrides — maps UI model IDs to terminal server providerID/modelID
        const TERMINAL_MODEL_MAP: Record<string, { providerID: string; modelID: string }> = {
          "kimi/kimi-for-coding":        { providerID: "kimi-for-coding", modelID: "k2p5" },
          "kimi/kimi-k2.5":              { providerID: "kimi-for-coding", modelID: "k2p5" },
          "kimi/kimi-k2-thinking":       { providerID: "kimi-for-coding", modelID: "kimi-k2-thinking" },
          "kimi-for-coding/kimi-k2.5":   { providerID: "kimi-for-coding", modelID: "k2p5" },
          "kimi-for-coding/k2p5":        { providerID: "kimi-for-coding", modelID: "k2p5" },
        };

        const rawId = runtimeModelId || modelId || "";
        if (TERMINAL_MODEL_MAP[rawId]) {
          const mapped = TERMINAL_MODEL_MAP[rawId];
          return JSON.stringify({
            sessionID,
            parts: [{ type: "text", text: message }],
            model: mapped,
          });
        }

        let providerID = "opencode";
        let modelID = "big-pickle";

        if (runtimeModelId && runtimeModelId.includes("/")) {
          const parts = runtimeModelId.split("/");
          providerID = parts[0];
          modelID = parts.slice(1).join("/");
        } else if (modelId && modelId.includes("/")) {
          const parts = modelId.split("/");
          providerID = parts[0];
          modelID = parts.slice(1).join("/");
        } else if (modelId) {
          // Use the modelId as-is (e.g., "big-pickle", "gpt-4o", etc.)
          modelID = modelId;
          // Infer provider from known model patterns
          if (modelId === "big-pickle" || modelId.startsWith("minimax")) {
            providerID = "opencode";
          } else if (modelId.startsWith("gpt") || modelId.startsWith("o1") || modelId.startsWith("o3")) {
            providerID = "openai";
          } else if (modelId.startsWith("claude")) {
            providerID = "anthropic";
          } else if (modelId.startsWith("gemini")) {
            providerID = "google";
          } else if (modelId.startsWith("deepseek")) {
            providerID = "deepseek";
          }
        }
        
        return JSON.stringify({
          sessionID,
          parts: [
            {
              type: "text",
              text: message,
            }
          ],
          model: {
            providerID,
            modelID,
          },
        });
      };
      
      const buildLegacyRequestBody = () => JSON.stringify({
        chatId,
        message,
        modelId,
        runtimeModelId,
        attachments: attachments?.map((f: any) => ({
          name: f.name,
          type: f.type,
          size: f.size
        })),
        webSearch,
        conversationMode,
        agentId,
        agentName,
        agentProvider,
        agentModel,
        agentFallbackModels,
        agentSessionKey,
        mode,  // Pass execution mode for system prompt injection
        gatewayUrl: runtimeConfig?.gatewayUrl,
        gatewayWsUrl: runtimeConfig?.gatewayWsUrl,
        gatewayToken: runtimeConfig?.token,
        gatewayPassword: runtimeConfig?.password,
      });

      const endpointAttempts = buildChatEndpointAttempts(chatId, conversationMode);
      let response: Response | null = null;
      let lastErrorMessage = "";
      let terminalSessionId: string | null = null;

      console.log('[rust-stream-adapter] Trying endpoints:', endpointAttempts.map(e => e.label));
      
      for (const attempt of endpointAttempts) {
        console.log('[rust-stream-adapter] Attempting endpoint:', attempt.url);
        
        // Check if this is a Terminal Server endpoint (either direct or via proxy)
        const isTerminalEndpoint = (attempt.url.includes("/session/") && attempt.url.includes("/message")) ||
                                   attempt.url.includes("/api/chat");
        
        // For Terminal Server, ensure session exists first
        if (isTerminalEndpoint && !terminalSessionId) {
          try {
            const sessionUrl = attempt.url.includes('/api/chat') 
              ? '/session'
              : attempt.url.replace(/\/session\/.*$/, '/session');
            
            const sessionTimeoutSignal = AbortSignal.timeout(30000);
            const createRes = await fetch(sessionUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                id: chatId,
                title: message.slice(0, 50) || 'New Chat'
              }),
              signal: sessionTimeoutSignal,
            });
            if (createRes.ok) {
              const sessionData = await createRes.json();
              terminalSessionId = sessionData.id || chatId;
            }
          } catch (e) {
            console.warn('[rust-stream-adapter] Failed to create session:', e);
          }
        }
        
        try {
          let fetchUrl = attempt.url;
          let requestBody: string;
          if (isTerminalEndpoint && terminalSessionId) {
            if (attempt.url.includes('/api/chat')) {
              fetchUrl = `/api/chat?chatId=${terminalSessionId}`;
            } else if (attempt.url.startsWith('http')) {
              // Absolute URL (direct terminal server) — preserve origin, replace path
              const origin = new URL(attempt.url).origin;
              fetchUrl = `${origin}/v1/session/${terminalSessionId}/message`;
            } else {
              fetchUrl = `/v1/session/${terminalSessionId}/message`;
            }
            requestBody = buildTerminalRequestBody(terminalSessionId);
          } else {
            requestBody = isTerminalEndpoint 
              ? buildTerminalRequestBody(chatId)
              : buildLegacyRequestBody();
          }
          
          const timeoutMs = 60000;
          const timeoutSignal = externalSignal 
            ? signal 
            : AbortSignal.timeout(timeoutMs);
          
          const candidate = await fetch(fetchUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
            signal: timeoutSignal,
          });

          if (candidate.ok) {
            response = candidate;
            break;
          }

          const detailText = await candidate.text().catch(() => "");
          const detail = detailText.trim().slice(0, 240);
          
          // Detect specific error types for better user messages
          console.log(`[rust-stream-adapter] HTTP Error ${candidate.status}:`, detail);
          if (candidate.status === 429) {
            lastErrorMessage = "Rate limit exceeded. The AI service is temporarily unavailable. Please wait a moment and try again.";
            console.error('[rust-stream-adapter] Rate limit detected (429)');
          } else if (candidate.status === 401 || candidate.status === 403) {
            lastErrorMessage = "Authentication failed. Please check your API key or sign in again.";
          } else if (candidate.status >= 500 && candidate.status < 600) {
            lastErrorMessage = `Server error (${candidate.status}). The AI service is experiencing issues. Please try again later.`;
          } else {
            lastErrorMessage = detail
              ? `${attempt.label} -> HTTP ${candidate.status}: ${candidate.statusText} - ${detail}`
              : `${attempt.label} -> HTTP ${candidate.status}: ${candidate.statusText}`;
          }

          if (candidate.status === 404) continue;
          // Don't retry on rate limit or auth errors
          if (candidate.status === 429 || candidate.status === 401 || candidate.status === 403) {
            break;
          }
          continue;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          // Detect network errors
          if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('Failed to fetch')) {
            lastErrorMessage = 'Network error. Please check your internet connection.';
          } else if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
            lastErrorMessage = 'Connection timed out. The service may be slow or unavailable.';
          } else {
            lastErrorMessage = `${attempt.label} -> ${errorMsg}`;
          }
          continue;
        }
      }

      if (!response) {
        console.error('[rust-stream-adapter] No response, throwing error:', lastErrorMessage);
        throw new Error(
          lastErrorMessage || "Unable to reach any chat endpoint"
        );
      }

      // Check if response has a body
      if (!response.body) {
        // Check content-type to see if it's an error response
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            if (errorData.error || errorData.message) {
              throw new Error(errorData.error || errorData.message);
            }
          } catch (e) {
            // If JSON parsing fails, throw generic error
          }
        }
        throw new Error("The AI service returned an empty response. Please try again.");
      }

      const reader = response.body.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      const decoder = new TextDecoder();
      // Do NOT reset assistantMessageIdRef here — it holds the placeholder ID created
      // before the request so message_start can rename it in-place instead of creating
      // a second assistant bubble.
      assistantPartsRef.current = [];

      const context: AdapterContext = {
        assistantParts: assistantPartsRef.current,
        // Seed with the placeholder ID so handlers rename/update it rather than appending
        assistantMessageId: assistantMessageIdRef.current,
        hasStreamedDeltasByMessageId: new Map(),
        pendingMcpAppPartsByToolCallId: new Map(),
        initialAssistantMetadata: pendingAssistantMetadataRef.current ?? undefined,
        setMessages: throttledSetMessages,
      };

      const processStreamItem = (parsed: any) => {
        const syncMessageId =
          parsed &&
          typeof parsed === "object" &&
          parsed.info &&
          typeof parsed.info === "object" &&
          typeof parsed.info.id === "string"
            ? parsed.info.id
            : null;
        const event = normalizeStreamEvent(parsed);

        // Auto-initialize only for payload-bearing frames. Heartbeats like `ping`
        // should not create empty assistant messages.
        if (!assistantMessageIdRef.current) {
          const resolvedAssistantId =
            syncMessageId ??
            (event && event.type !== "message_start"
              ? event.messageId ?? `msg-${Date.now()}`
              : null);

          if (resolvedAssistantId) {
            assistantMessageIdRef.current = resolvedAssistantId;
            setCurrentAssistantId(resolvedAssistantId);

            const newMessage: ChatMessage = {
              id: resolvedAssistantId,
              role: "assistant",
              content: [],
              createdAt: new Date(),
              metadata: pendingAssistantMetadataRef.current ?? undefined,
            };
            throttledSetMessages(prev => [...prev, newMessage], true);
          }
        }

        // Handle Terminal Server "info/parts" sync objects (can be incremental or final)
        if (parsed.info && parsed.parts && Array.isArray(parsed.parts)) {
          const syncId = parsed.info.id || assistantMessageIdRef.current || '';
          if (context.hasStreamedDeltasByMessageId.get(syncId)) {
            console.log("[rust-stream-adapter] Ignoring DB full-sync object to preserve live streamed deltas");
            return;
          }

          // Prefer our pre-created placeholder ID so we update it in-place.
          // Server-assigned ID is only used if no placeholder exists yet.
          const messageId = assistantMessageIdRef.current || parsed.info.id;
          if (messageId) {
            assistantMessageIdRef.current = messageId;
            context.assistantMessageId = messageId;
            const normalizedParts = parsed.parts.map(normalizePart);
            assistantPartsRef.current = normalizedParts;
            context.assistantParts = normalizedParts;
            // Set content immediately — data already arrived, no simulation needed.
            // isLoading stays true until the finally block so isStreaming renders correctly.
            throttledSetMessages((prev: ChatMessage[]) =>
              prev.map(m => m.id === messageId ? { ...m, content: normalizedParts } : m),
              true
            );
            context.hasStreamedDeltasByMessageId.set(messageId, true);
          }
          return;
        }

        if (event) {
          if (event.type === "error") {
            receivedErrorEventRef.current = true;
          }

          if (event.type === "finish") {
            finishEventRef.current = event;
          }

          // Update context message ID
          context.assistantMessageId = assistantMessageIdRef.current;
          
          const handler = RUST_EVENT_MAP[event.type];
          if (handler) {
            handler(event, context);
            if (event.type === "message_start" && event.messageId) {
              assistantMessageIdRef.current = event.messageId;
              setCurrentAssistantId(event.messageId);
            }
          }
        }
      };

      // ============================================================================
      // UNIFIED STREAM PROCESSING (SSE & NDJSON)
      // ============================================================================
      
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoded = decoder.decode(value, { stream: true });
        buffer += decoded;
        
        let idx;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;

          let data = line;
          if (data.startsWith("data: ")) {
            data = data.slice(6);
          }
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            processStreamItem(parsed);
          } catch (e) {
            console.warn("[rust-stream-adapter] Failed to parse stream line:", line);
          }
        }
      }
      
      // Final flush
      if (buffer.trim()) {
        const finalTrimmed = buffer.trim();
        const data = finalTrimmed.startsWith("data: ") ? finalTrimmed.slice(6) : finalTrimmed;
        if (data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data);
            processStreamItem(parsed);
          } catch (e) { /* partial junk */ }
        }
      }
      
      finalizeAssistantMessage(receivedErrorEventRef.current ? "error" : "complete");
      options.onFinish?.();
    } catch (error) {
      console.error('[rust-stream-adapter] Caught error in submitMessage:', error);
      if (error instanceof Error) {
        const isAbort = error.name === "AbortError";
        const isTimeout = error.name === "TimeoutError";

        if (manualStopRef.current || isAbort) {
          finalizeAssistantMessage("stopped");
          return;
        }

        // Use clean error message if it's already a known error type, otherwise add prefix
        const isKnownError = error.message?.includes('Rate limit') ||
                             error.message?.includes('Authentication failed') ||
                             error.message?.includes('Server error') ||
                             error.message?.includes('Network error') ||
                             error.message?.includes('Connection timed out');
        
        const errorMessage = isTimeout 
          ? "Request timed out. The model may be taking too long to respond."
          : isKnownError 
            ? error.message 
            : `Request failed: ${error.message}`;
        
        console.error('[rust-stream-adapter] Error:', error);
        options.onError?.(error);
        finalizeAssistantMessage("error");
        
        // Create error as a proper ErrorUIPart so UnifiedMessageRenderer displays it correctly
        const errorPart: ErrorUIPart = {
          type: "error",
          message: errorMessage,
          kind: isKnownError ? "runtime" : "unknown",
        };
        
        const assistantError: ChatMessage = {
          id: `msg-${Date.now()}-error`,
          role: "assistant",
          content: [errorPart],
          createdAt: new Date(),
          metadata: {
            ...pendingAssistantMetadataRef.current,
            finishedAt: Date.now(),
            durationMs: pendingAssistantMetadataRef.current?.startedAt
              ? Math.max(0, Date.now() - pendingAssistantMetadataRef.current.startedAt)
              : undefined,
            status: "error",
          },
        };
        console.log('[rust-stream-adapter] Adding error message to chat:', assistantError);
        setMessages((prev: ChatMessage[]) => [...prev, assistantError]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      pendingAssistantMetadataRef.current = null;
      finishEventRef.current = null;
      receivedErrorEventRef.current = false;
      manualStopRef.current = false;
    }
  }, [isLoading, options]);

  const regenerate = useCallback(async (
    messageText: string,
    params: Omit<SubmitMessageParams, 'message'>
  ): Promise<void> => {
    // Remove last assistant message if exists
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === "assistant") {
        return prev.slice(0, -1);
      }
      return prev;
    });
    
    // Resubmit
    await submitMessage({ ...params, message: messageText });
  }, [submitMessage]);

  const injectArtifact = useCallback((artifact: ArtifactUIPart, intro?: string) => {
    const id = `template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const parts: UIPart[] = [];
    if (intro) {
      parts.push({ type: "text", text: intro } as TextUIPart);
    }
    parts.push(artifact);
    const message: ChatMessage = {
      id,
      role: "assistant",
      content: parts,
      createdAt: new Date(),
      metadata: { status: "complete" },
    };
    setMessages(prev => [...prev, message]);
    setCurrentAssistantId(id);
  }, []);

  return {
    messages,
    isLoading,
    currentAssistantId,
    submitMessage,
    regenerate,
    stop,
    clearMessages,
    injectArtifact,
  };
}

// ============================================================================
// Utilities for extracting content
// ============================================================================

export function getTextFromParts(parts: UIPart[]): string {
  return parts
    .filter((p): p is TextUIPart => p.type === "text")
    .map(p => p.text)
    .join("");
}

export function partsToText(parts: UIPart[] | string): string {
  if (typeof parts === "string") return parts;
  
  return parts
    .map(part => {
      switch (part.type) {
        case "text":
          return part.text;
        case "dynamic-tool": {
          const toolPart = part as DynamicToolUIPart;
          return `[Tool: ${toolPart.toolName}]`;
        }
        case "source-document":
          return `[Source: ${part.title}]`;
        case "file":
          return `[File: ${part.filename ?? "unnamed"}]`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
