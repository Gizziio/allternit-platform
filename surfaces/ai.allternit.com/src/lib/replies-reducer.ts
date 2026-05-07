/**
 * Replies Reducer - Event-sourced state machine for conversation replies.
 * Extracted from the private @allternit/replies-reducer package.
 */

import type {
  ReplyEvent,
  ConversationReplyState,
  Reply,
  ReplyItem,
  TextReplyItem,
  ReasoningReplyItem,
  ToolCallReplyItem,
  ReplyStatus,
} from '@/types/replies-contract';

export function createConversationReplyState(): ConversationReplyState {
  return {
    replies: {},
    orderedReplyIds: [],
  };
}

function getOrCreateReply(state: ConversationReplyState, replyId: string): Reply {
  if (!state.replies[replyId]) {
    const now = Date.now();
    state.replies[replyId] = {
      id: replyId,
      status: 'streaming',
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    state.orderedReplyIds.push(replyId);
  }
  return state.replies[replyId];
}

function updateReplyTimestamp(state: ConversationReplyState, replyId: string) {
  if (state.replies[replyId]) {
    state.replies[replyId].updatedAt = Date.now();
  }
}

export function reduceReplyEvent(
  state: ConversationReplyState,
  event: ReplyEvent,
): ConversationReplyState {
  const reply = getOrCreateReply(state, event.replyId);

  switch (event.type) {
    case 'text:start':
      reply.status = 'streaming';
      break;

    case 'text:delta': {
      const data = event.data as { content?: string } | undefined;
      const content = data?.content ?? '';
      const lastItem = reply.items[reply.items.length - 1];
      if (lastItem && lastItem.kind === 'text') {
        (lastItem as TextReplyItem).content += content;
      } else {
        reply.items.push({
          kind: 'text',
          content,
          timestamp: event.timestamp ?? Date.now(),
        });
      }
      break;
    }

    case 'text:end':
      updateReplyTimestamp(state, event.replyId);
      break;

    case 'reasoning:start':
      break;

    case 'reasoning:delta': {
      const data = event.data as { content?: string } | undefined;
      const content = data?.content ?? '';
      const lastItem = reply.items[reply.items.length - 1];
      if (lastItem && lastItem.kind === 'reasoning') {
        (lastItem as ReasoningReplyItem).content += content;
      } else {
        reply.items.push({
          kind: 'reasoning',
          content,
          timestamp: event.timestamp ?? Date.now(),
        });
      }
      break;
    }

    case 'reasoning:end':
      updateReplyTimestamp(state, event.replyId);
      break;

    case 'tool_call:start': {
      const data = event.data as { toolName?: string; input?: unknown } | undefined;
      reply.items.push({
        kind: 'tool_call',
        toolName: data?.toolName ?? 'unknown',
        input: data?.input,
        state: 'queued',
        timestamp: event.timestamp ?? Date.now(),
      });
      break;
    }

    case 'tool_call:running': {
      const lastToolCall = [...reply.items].reverse().find((i): i is ToolCallReplyItem => i.kind === 'tool_call');
      if (lastToolCall) {
        lastToolCall.state = 'running';
      }
      break;
    }

    case 'tool_call:end': {
      const data = event.data as { output?: string; duration?: number } | undefined;
      const lastToolCall = [...reply.items].reverse().find((i): i is ToolCallReplyItem => i.kind === 'tool_call');
      if (lastToolCall) {
        lastToolCall.state = 'done';
        lastToolCall.output = data?.output;
        lastToolCall.duration = data?.duration;
      }
      break;
    }

    case 'tool_call:error': {
      const lastToolCall = [...reply.items].reverse().find((i): i is ToolCallReplyItem => i.kind === 'tool_call');
      if (lastToolCall) {
        lastToolCall.state = 'error';
      }
      break;
    }

    case 'reply:complete':
      reply.status = 'completed';
      break;

    case 'reply:error': {
      const data = event.data as { error?: string } | undefined;
      reply.status = 'error';
      if (data?.error) {
        reply.items.push({
          kind: 'text',
          content: `Error: ${data.error}`,
          timestamp: event.timestamp ?? Date.now(),
        });
      }
      break;
    }

    default:
      // Unknown event type, ignore for forward compatibility
      break;
  }

  return { ...state };
}
