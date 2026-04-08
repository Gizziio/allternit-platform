import { useMemo } from "react";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import {
  useConversationReplies,
  useConversationTurns,
  useNativeAgentStore,
  useSessionStreamingState,
  useUserMessages,
  type ConversationTurn,
  type NativeMessage,
} from "./native-agent.store";

export interface LiveSessionState {
  messages: NativeMessage[];
  userMessages: NativeMessage[];
  turns: ConversationTurn[];
  canvasIds: string[];
  isStreaming: boolean;
  streamingError: string | null;
  replies: ReturnType<typeof useConversationReplies>;
}

export function useLiveSessionState(
  sessionId: string | undefined | null,
): LiveSessionState {
  const normalizedSessionId = sessionId ?? undefined;
  const messages = useStoreWithEqualityFn(
    useNativeAgentStore,
    (state) =>
      normalizedSessionId ? (state.messages[normalizedSessionId] ?? []) : [],
    shallow,
  );
  const canvasIds = useStoreWithEqualityFn(
    useNativeAgentStore,
    (state) =>
      normalizedSessionId
        ? (state.sessionCanvases[normalizedSessionId] ?? [])
        : [],
    shallow,
  );
  const { isStreaming, error } = useSessionStreamingState(
    normalizedSessionId ?? "",
  );
  const replies = useConversationReplies(normalizedSessionId);
  const userMessages = useUserMessages(normalizedSessionId);
  const turns = useConversationTurns(normalizedSessionId);

  return useMemo(
    () => ({
      messages,
      userMessages,
      turns,
      canvasIds,
      isStreaming,
      streamingError: error,
      replies,
    }),
    [canvasIds, error, isStreaming, messages, replies, turns, userMessages],
  );
}
