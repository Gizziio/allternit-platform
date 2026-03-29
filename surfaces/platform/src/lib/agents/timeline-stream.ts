export type AssistantBlockKind =
  | "text"
  | "reasoning"
  | "tool"
  | "artifact"
  | "citation";

export type StreamEvent =
  | {
      type: "run.started";
      runId: string;
      messageId: string;
      sessionId?: string;
      ts: number;
    }
  | {
      type: "assistant.block.open";
      runId: string;
      messageId: string;
      blockId: string;
      kind: AssistantBlockKind;
      ts: number;
    }
  | {
      type: "assistant.text.delta";
      runId: string;
      messageId: string;
      blockId: string;
      delta: string;
      ts: number;
    }
  | {
      type: "assistant.reasoning.delta";
      runId: string;
      messageId: string;
      blockId: string;
      delta: string;
      summary?: string;
      ts: number;
    }
  | {
      type: "tool.call.started";
      runId: string;
      messageId: string;
      blockId: string;
      toolCallId: string;
      toolName: string;
      input?: unknown;
      title?: string;
      ts: number;
    }
  | {
      type: "tool.call.progress";
      runId: string;
      messageId: string;
      blockId: string;
      toolCallId: string;
      statusText: string;
      ts: number;
    }
  | {
      type: "tool.call.result";
      runId: string;
      messageId: string;
      blockId: string;
      toolCallId: string;
      output: unknown;
      preview?: unknown;
      ts: number;
    }
  | {
      type: "tool.call.failed";
      runId: string;
      messageId: string;
      blockId: string;
      toolCallId: string;
      error: string;
      ts: number;
    }
  | {
      type: "artifact.created";
      runId: string;
      messageId: string;
      blockId: string;
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
      runId: string;
      messageId: string;
      blockId: string;
      citationId: string;
      title: string;
      url?: string;
      snippet?: string;
      ts: number;
    }
  | {
      type: "assistant.block.close";
      runId: string;
      messageId: string;
      blockId: string;
      ts: number;
    }
  | {
      type: "run.completed";
      runId: string;
      messageId: string;
      ts: number;
    }
  | {
      type: "run.failed";
      runId: string;
      messageId: string;
      error: string;
      ts: number;
    };

export type ToolLifecycleState = "queued" | "running" | "done" | "error";
export type RunStatus = "streaming" | "complete" | "error";

export interface TimelineCitation {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
}

export interface TextTimelineBlock {
  kind: "text";
  id: string;
  text: string;
  isOpen: boolean;
}

export interface ReasoningTimelineBlock {
  kind: "reasoning";
  id: string;
  text: string;
  summary?: string;
  isOpen: boolean;
}

export interface ToolTimelineBlock {
  kind: "tool";
  id: string;
  toolCallId: string;
  toolName: string;
  title?: string;
  state: ToolLifecycleState;
  input?: unknown;
  progressLines: string[];
  output?: unknown;
  outputPreview?: unknown;
  error?: string;
  isOpen: boolean;
  startedAt?: number;
  endedAt?: number;
}

export interface ArtifactTimelineBlock {
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

export interface CitationTimelineBlock {
  kind: "citation";
  id: string;
  items: TimelineCitation[];
  isOpen: boolean;
}

export type AssistantTimelineBlock =
  | TextTimelineBlock
  | ReasoningTimelineBlock
  | ToolTimelineBlock
  | ArtifactTimelineBlock
  | CitationTimelineBlock;

export interface AssistantTurn {
  id: string;
  runId: string;
  sessionId?: string;
  status: RunStatus;
  error?: string;
  startedAt: number;
  completedAt?: number;
  blocks: AssistantTimelineBlock[];
}

export interface ConversationTimelineState {
  runs: Record<string, AssistantTurn>;
  messageToRunId: Record<string, string>;
  orderedRunIds: string[];
}

export interface ProviderStreamAdapter<TChunk> {
  mapChunkToEvents(chunk: TChunk): StreamEvent[];
}

export function createConversationTimelineState(): ConversationTimelineState {
  return {
    runs: {},
    messageToRunId: {},
    orderedRunIds: [],
  };
}

export function reduceStreamEvent(
  state: ConversationTimelineState,
  event: StreamEvent,
): ConversationTimelineState {
  switch (event.type) {
    case "run.started":
      return openRun(state, event);
    case "assistant.block.open":
      return upsertBlock(state, event.runId, createBlock(event));
    case "assistant.text.delta":
      return updateBlock(state, event.runId, event.blockId, (block) =>
        block.kind === "text"
          ? { ...block, text: block.text + event.delta }
          : block,
      );
    case "assistant.reasoning.delta":
      return updateBlock(state, event.runId, event.blockId, (block) =>
        block.kind === "reasoning"
          ? {
              ...block,
              text: block.text + event.delta,
              summary: event.summary ?? block.summary,
            }
          : block,
      );
    case "tool.call.started":
      return updateBlock(state, event.runId, event.blockId, (block) =>
        block.kind === "tool"
          ? {
              ...block,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              title: event.title ?? block.title,
              input: event.input ?? block.input,
              state: "running",
              startedAt: event.ts,
              isOpen: true,
            }
          : block,
      );
    case "tool.call.progress":
      return updateBlock(state, event.runId, event.blockId, (block) =>
        block.kind === "tool"
          ? {
              ...block,
              state: "running",
              progressLines: [...block.progressLines, event.statusText],
            }
          : block,
      );
    case "tool.call.result":
      return updateBlock(state, event.runId, event.blockId, (block) =>
        block.kind === "tool"
          ? {
              ...block,
              state: "done",
              output: event.output,
              outputPreview: event.preview,
              endedAt: event.ts,
              isOpen: false,
            }
          : block,
      );
    case "tool.call.failed":
      return updateBlock(state, event.runId, event.blockId, (block) =>
        block.kind === "tool"
          ? {
              ...block,
              state: "error",
              error: event.error,
              endedAt: event.ts,
              isOpen: true,
            }
          : block,
      );
    case "artifact.created": {
      const withBlock = ensureBlock(
        state,
        event.runId,
        event.blockId,
        () => ({
          kind: "artifact",
          id: event.blockId,
          artifactId: event.artifactId,
          artifactType: event.artifactType,
          title: event.title,
          url: event.url,
          preview: event.inlinePreview,
          metadata: event.metadata,
          isOpen: true,
        }),
      );
      return updateBlock(withBlock, event.runId, event.blockId, (block) =>
        block.kind === "artifact"
          ? {
              ...block,
              artifactId: event.artifactId,
              artifactType: event.artifactType,
              title: event.title,
              url: event.url,
              preview: event.inlinePreview,
              metadata: event.metadata,
            }
          : block,
      );
    }
    case "citation.added": {
      const withBlock = ensureBlock(
        state,
        event.runId,
        event.blockId,
        () => ({
          kind: "citation",
          id: event.blockId,
          items: [],
          isOpen: false,
        }),
      );
      return updateBlock(withBlock, event.runId, event.blockId, (block) =>
        block.kind === "citation"
          ? {
              ...block,
              items: [
                ...block.items,
                {
                  id: event.citationId,
                  title: event.title,
                  url: event.url,
                  snippet: event.snippet,
                },
              ],
            }
          : block,
      );
    }
    case "assistant.block.close":
      return updateBlock(state, event.runId, event.blockId, (block) => ({
        ...block,
        isOpen: false,
      }));
    case "run.completed":
      return updateRun(state, event.runId, (run) => ({
        ...run,
        status: "complete",
        completedAt: event.ts,
      }));
    case "run.failed":
      return updateRun(state, event.runId, (run) => ({
        ...run,
        status: "error",
        error: event.error,
        completedAt: event.ts,
      }));
    default:
      return state;
  }
}

function openRun(
  state: ConversationTimelineState,
  event: Extract<StreamEvent, { type: "run.started" }>,
): ConversationTimelineState {
  const existing = state.runs[event.runId];
  const nextRun: AssistantTurn =
    existing ??
    {
      id: event.messageId,
      runId: event.runId,
      sessionId: event.sessionId,
      status: "streaming",
      startedAt: event.ts,
      blocks: [],
    };

  return {
    runs: {
      ...state.runs,
      [event.runId]: {
        ...nextRun,
        id: event.messageId,
        sessionId: event.sessionId ?? nextRun.sessionId,
        status: "streaming",
      },
    },
    messageToRunId: {
      ...state.messageToRunId,
      [event.messageId]: event.runId,
    },
    orderedRunIds: state.orderedRunIds.includes(event.runId)
      ? state.orderedRunIds
      : [...state.orderedRunIds, event.runId],
  };
}

function createBlock(
  event: Extract<StreamEvent, { type: "assistant.block.open" }>,
): AssistantTimelineBlock {
  switch (event.kind) {
    case "text":
      return { kind: "text", id: event.blockId, text: "", isOpen: true };
    case "reasoning":
      return {
        kind: "reasoning",
        id: event.blockId,
        text: "",
        isOpen: false,
      };
    case "tool":
      return {
        kind: "tool",
        id: event.blockId,
        toolCallId: event.blockId,
        toolName: "tool",
        state: "queued",
        progressLines: [],
        isOpen: true,
      };
    case "artifact":
      return {
        kind: "artifact",
        id: event.blockId,
        artifactId: event.blockId,
        artifactType: "artifact",
        title: "Artifact",
        isOpen: true,
      };
    case "citation":
      return {
        kind: "citation",
        id: event.blockId,
        items: [],
        isOpen: false,
      };
  }
}

function ensureBlock(
  state: ConversationTimelineState,
  runId: string,
  blockId: string,
  factory: () => AssistantTimelineBlock,
): ConversationTimelineState {
  const run = state.runs[runId];
  if (!run) return state;
  if (run.blocks.some((block) => block.id === blockId)) return state;
  return upsertBlock(state, runId, factory());
}

function upsertBlock(
  state: ConversationTimelineState,
  runId: string,
  nextBlock: AssistantTimelineBlock,
): ConversationTimelineState {
  return updateRun(state, runId, (run) => {
    const existingIndex = run.blocks.findIndex((block) => block.id === nextBlock.id);
    if (existingIndex === -1) {
      return { ...run, blocks: [...run.blocks, nextBlock] };
    }

    const blocks = [...run.blocks];
    blocks[existingIndex] = nextBlock;
    return { ...run, blocks };
  });
}

function updateBlock(
  state: ConversationTimelineState,
  runId: string,
  blockId: string,
  updater: (block: AssistantTimelineBlock) => AssistantTimelineBlock,
): ConversationTimelineState {
  return updateRun(state, runId, (run) => ({
    ...run,
    blocks: run.blocks.map((block) =>
      block.id === blockId ? updater(block) : block,
    ),
  }));
}

function updateRun(
  state: ConversationTimelineState,
  runId: string,
  updater: (run: AssistantTurn) => AssistantTurn,
): ConversationTimelineState {
  const run = state.runs[runId];
  if (!run) return state;
  return {
    ...state,
    runs: {
      ...state.runs,
      [runId]: updater(run),
    },
  };
}
