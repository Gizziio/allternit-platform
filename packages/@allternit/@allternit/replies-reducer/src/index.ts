// =============================================================================
// @allternit/replies-reducer — Pure reducer for ConversationReplyState
//
// No side effects. No framework deps. Only depends on @allternit/replies-contract.
// =============================================================================

import type {
  ConversationReplyState,
  Reply,
  ReplyEvent,
  ReplyItem,
  ReplyItemKind,
} from "@allternit/replies-contract";

export type {
  ConversationReplyState,
  Reply,
  ReplyEvent,
  ReplyItem,
  ReplyItemKind,
} from "@allternit/replies-contract";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createConversationReplyState(): ConversationReplyState {
  return { replies: {}, orderedReplyIds: [] };
}

// ---------------------------------------------------------------------------
// Reducer — pure, no side effects
// ---------------------------------------------------------------------------

export function reduceReplyEvent(
  state: ConversationReplyState,
  event: ReplyEvent,
): ConversationReplyState {
  switch (event.type) {
    case "reply.started":
      return openReply(state, event);
    case "reply.item.added":
      return upsertItem(state, event.replyId, createItem(event));
    case "reply.text.delta":
      return updateItem(state, event.replyId, event.itemId, (item) =>
        item.kind === "text"
          ? { ...item, text: item.text + event.delta }
          : item,
      );
    case "reply.reasoning.delta":
      return updateItem(state, event.replyId, event.itemId, (item) =>
        item.kind === "reasoning"
          ? { ...item, text: item.text + event.delta, summary: event.summary ?? item.summary }
          : item,
      );
    case "tool_call.started":
      return updateItem(state, event.replyId, event.itemId, (item) =>
        item.kind === "tool_call"
          ? {
              ...item,
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              title: event.title ?? item.title,
              input: event.input ?? item.input,
              state: "running",
              startedAt: event.ts,
              isOpen: true,
            }
          : item,
      );
    case "tool_call.progress":
      return updateItem(state, event.replyId, event.itemId, (item) =>
        item.kind === "tool_call"
          ? { ...item, state: "running", progressLines: [...item.progressLines, event.statusText] }
          : item,
      );
    case "tool_call.completed":
      return updateItem(state, event.replyId, event.itemId, (item) =>
        item.kind === "tool_call"
          ? {
              ...item,
              state: "done",
              output: event.output,
              outputPreview: event.preview,
              endedAt: event.ts,
              isOpen: false,
            }
          : item,
      );
    case "tool_call.failed":
      return updateItem(state, event.replyId, event.itemId, (item) =>
        item.kind === "tool_call"
          ? { ...item, state: "error", error: event.error, endedAt: event.ts, isOpen: true }
          : item,
      );
    case "artifact.created": {
      const withItem = ensureItem(
        state,
        event.replyId,
        event.itemId,
        () => ({
          kind: "artifact",
          id: event.itemId,
          artifactId: event.artifactId,
          artifactType: event.artifactType,
          title: event.title,
          url: event.url,
          preview: event.inlinePreview,
          metadata: event.metadata,
          isOpen: true,
        }),
      );
      return updateItem(withItem, event.replyId, event.itemId, (item) =>
        item.kind === "artifact"
          ? {
              ...item,
              artifactId: event.artifactId,
              artifactType: event.artifactType,
              title: event.title,
              url: event.url,
              preview: event.inlinePreview,
              metadata: event.metadata,
            }
          : item,
      );
    }
    case "citation.added": {
      const withItem = ensureItem(
        state,
        event.replyId,
        event.itemId,
        () => ({ kind: "citation", id: event.itemId, items: [], isOpen: false }),
      );
      return updateItem(withItem, event.replyId, event.itemId, (item) =>
        item.kind === "citation"
          ? {
              ...item,
              items: [
                ...item.items,
                { id: event.citationId, title: event.title, url: event.url, snippet: event.snippet },
              ],
            }
          : item,
      );
    }
    case "reply.item.done":
      return updateItem(state, event.replyId, event.itemId, (item) => ({
        ...item,
        isOpen: false,
      }));
    case "reply.completed":
      return updateReply(state, event.replyId, (reply) => ({
        ...reply,
        status: "complete",
        completedAt: event.ts,
      }));
    case "reply.failed":
      return updateReply(state, event.replyId, (reply) => ({
        ...reply,
        status: "failed",
        error: event.error,
        completedAt: event.ts,
      }));
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function openReply(
  state: ConversationReplyState,
  event: Extract<ReplyEvent, { type: "reply.started" }>,
): ConversationReplyState {
  const existing = state.replies[event.replyId];
  const nextReply: Reply = existing ?? {
    id: event.replyId,
    runId: event.runId,
    conversationId: event.conversationId,
    status: "streaming",
    startedAt: event.ts,
    items: [],
  };

  return {
    replies: {
      ...state.replies,
      [event.replyId]: {
        ...nextReply,
        runId: event.runId,
        conversationId: event.conversationId ?? nextReply.conversationId,
        status: "streaming",
      },
    },
    orderedReplyIds: state.orderedReplyIds.includes(event.replyId)
      ? state.orderedReplyIds
      : [...state.orderedReplyIds, event.replyId],
  };
}

function createItem(
  event: Extract<ReplyEvent, { type: "reply.item.added" }>,
): ReplyItem {
  switch (event.kind as ReplyItemKind) {
    case "text":
      return { kind: "text", id: event.itemId, text: "", isOpen: true };
    case "reasoning":
      return { kind: "reasoning", id: event.itemId, text: "", isOpen: false };
    case "tool_call":
      return {
        kind: "tool_call",
        id: event.itemId,
        toolCallId: event.itemId,
        toolName: "tool",
        state: "queued",
        progressLines: [],
        isOpen: true,
      };
    case "artifact":
      return {
        kind: "artifact",
        id: event.itemId,
        artifactId: event.itemId,
        artifactType: "artifact",
        title: "Artifact",
        isOpen: true,
      };
    case "citation":
      return { kind: "citation", id: event.itemId, items: [], isOpen: false };
  }
}

function ensureItem(
  state: ConversationReplyState,
  replyId: string,
  itemId: string,
  factory: () => ReplyItem,
): ConversationReplyState {
  const reply = state.replies[replyId];
  if (!reply) return state;
  if (reply.items.some((item) => item.id === itemId)) return state;
  return upsertItem(state, replyId, factory());
}

function upsertItem(
  state: ConversationReplyState,
  replyId: string,
  nextItem: ReplyItem,
): ConversationReplyState {
  return updateReply(state, replyId, (reply) => {
    const existingIndex = reply.items.findIndex((item) => item.id === nextItem.id);
    if (existingIndex === -1) {
      return { ...reply, items: [...reply.items, nextItem] };
    }
    const items = [...reply.items];
    items[existingIndex] = nextItem;
    return { ...reply, items };
  });
}

function updateItem(
  state: ConversationReplyState,
  replyId: string,
  itemId: string,
  updater: (item: ReplyItem) => ReplyItem,
): ConversationReplyState {
  return updateReply(state, replyId, (reply) => ({
    ...reply,
    items: reply.items.map((item) =>
      item.id === itemId ? updater(item) : item,
    ),
  }));
}

function updateReply(
  state: ConversationReplyState,
  replyId: string,
  updater: (reply: Reply) => Reply,
): ConversationReplyState {
  const reply = state.replies[replyId];
  if (!reply) return state;
  return {
    ...state,
    replies: { ...state.replies, [replyId]: updater(reply) },
  };
}
