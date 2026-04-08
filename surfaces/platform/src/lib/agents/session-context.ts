import { useMemo } from "react";

import type {
  ConversationTurn,
  NativeMessage,
  NativeSession,
} from "./native-agent.store";
import {
  useConversationReplies,
  useConversationTurns,
  useNativeAgentStore,
  useSessionStreamingState,
  useUserMessages,
} from "./native-agent.store";
import type {
  ConversationReplyState,
  Reply,
  ToolCallReplyItem,
} from "./replies-stream";
import type {
  AgentSessionDescriptor,
} from "./session-metadata";
import { getAgentSessionDescriptor } from "./session-metadata";
import type { SessionProjectionCache } from "./session-ledger";

export interface SessionContextSnapshot {
  conversationId?: string;
  session: NativeSession | null;
  descriptor: AgentSessionDescriptor;
  userMessages: NativeMessage[];
  turns: ConversationTurn[];
  replyState?: ConversationReplyState;
  latestReply?: Reply;
  latestToolCalls: ToolCallReplyItem[];
  projection?: SessionProjectionCache;
  isStreaming: boolean;
  streamingError: string | null;
}

function selectSessionById(
  sessions: NativeSession[],
  conversationId: string | undefined,
): NativeSession | null {
  if (!conversationId) return null;
  return sessions.find((session) => session.id === conversationId) ?? null;
}

function getLatestReply(
  replyState: ConversationReplyState | undefined,
): Reply | undefined {
  if (!replyState || replyState.orderedReplyIds.length === 0) {
    return undefined;
  }

  const latestReplyId =
    replyState.orderedReplyIds[replyState.orderedReplyIds.length - 1];

  return latestReplyId ? replyState.replies[latestReplyId] : undefined;
}

function getLatestToolCalls(reply: Reply | undefined): ToolCallReplyItem[] {
  if (!reply) return [];

  return reply.items.filter(
    (item): item is ToolCallReplyItem => item.kind === "tool_call",
  );
}

export function useSessionContextSnapshot(
  conversationId: string | undefined,
): SessionContextSnapshot {
  const sessions = useNativeAgentStore((state) => state.sessions);
  const projection = useNativeAgentStore((state) =>
    conversationId ? state.projectionsBySession[conversationId] : undefined,
  );
  const userMessages = useUserMessages(conversationId);
  const turns = useConversationTurns(conversationId);
  const replyState = useConversationReplies(conversationId);
  const streamingState = useSessionStreamingState(conversationId ?? "");

  const session = useMemo(
    () => selectSessionById(sessions, conversationId),
    [conversationId, sessions],
  );
  const descriptor = useMemo(
    () => getAgentSessionDescriptor(session?.metadata),
    [session?.metadata],
  );
  const latestReply = useMemo(() => getLatestReply(replyState), [replyState]);
  const latestToolCalls = useMemo(
    () => getLatestToolCalls(latestReply),
    [latestReply],
  );

  return {
    conversationId,
    session,
    descriptor,
    userMessages,
    turns,
    replyState,
    latestReply,
    latestToolCalls,
    projection,
    isStreaming: conversationId ? streamingState.isStreaming : false,
    streamingError: conversationId ? streamingState.error : null,
  };
}

export function useActiveSessionContextSnapshot(): SessionContextSnapshot {
  const activeSessionId = useNativeAgentStore((state) => state.activeSessionId);
  return useSessionContextSnapshot(activeSessionId ?? undefined);
}
