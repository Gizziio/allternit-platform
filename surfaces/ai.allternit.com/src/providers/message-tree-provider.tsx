"use client";

import React, { createContext, useContext, useCallback, useMemo, ReactNode, useRef, useState, useEffect } from "react";
import type { ChatMessage } from "@/lib/ai/types";
import { useChatId } from "./chat-id-provider";
import { useDataStream } from "./data-stream-provider";

interface MessageSiblingInfo {
  siblings: ChatMessage[];
  siblingIndex: number;
}

interface MessageTreeContextType {
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  getMessageSiblingInfo: (messageId: string) => MessageSiblingInfo | null;
  navigateToSibling: (messageId: string, direction: "prev" | "next") => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (messageId: string) => void;
  forkMessage: (messageId: string) => string | null;
  threadEpoch: number;
}

const MessageTreeContext = createContext<MessageTreeContextType | undefined>(undefined);

interface MessageTreeProviderProps {
  children: ReactNode;
  initialMessages?: ChatMessage[];
}

export function MessageTreeProvider({ children, initialMessages = [] }: MessageTreeProviderProps) {
  const { id: chatId, isPersisted } = useChatId();
  const { setDataStream } = useDataStream();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [threadEpoch, setThreadEpoch] = useState(0);
  const prevChatIdRef = useRef<string | null>(null);

  // Reset when chat changes - but preserve temp chat messages
  useEffect(() => {
    // Don't reset if we're just updating the same chat
    if (prevChatIdRef.current === chatId) return;
    prevChatIdRef.current = chatId || null;
    
    // Only reset for new persisted chats
    if (isPersisted) {
      setMessages(initialMessages);
      setThreadEpoch(0);
      setDataStream([]);
    }
    // For temp chats, keep existing messages until explicitly cleared
  }, [chatId, isPersisted, initialMessages, setDataStream]);

  // Build parent->children mapping
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, ChatMessage[]>();
    for (const message of messages) {
      const parentId = message.metadata?.parentMessageId || null;
      if (!map.has(parentId)) {
        map.set(parentId, []);
      }
      map.get(parentId)?.push(message);
    }
    // Sort siblings by createdAt
    for (const siblings of map.values()) {
      siblings.sort(
        (a, b) =>
          new Date(a.metadata?.createdAt || 0).getTime() -
          new Date(b.metadata?.createdAt || 0).getTime()
      );
    }
    return map;
  }, [messages]);

  const getMessageSiblingInfo = useCallback(
    (messageId: string): MessageSiblingInfo | null => {
      const message = messages.find((m) => m.id === messageId);
      if (!message) return null;

      const siblings = childrenMap.get(message.metadata?.parentMessageId || null) || [];
      const siblingIndex = siblings.findIndex((s) => s.id === messageId);

      return { siblings, siblingIndex };
    },
    [messages, childrenMap]
  );

  const navigateToSibling = useCallback(
    (messageId: string, direction: "prev" | "next") => {
      const siblingInfo = getMessageSiblingInfo(messageId);
      if (!siblingInfo || siblingInfo.siblings.length <= 1) return;

      const { siblings, siblingIndex } = siblingInfo;
      const nextIndex =
        direction === "next"
          ? (siblingIndex + 1) % siblings.length
          : (siblingIndex - 1 + siblings.length) % siblings.length;

      const targetSibling = siblings[nextIndex];
      
      // Build thread from this sibling to leaf
      const buildThreadFromLeaf = (leafId: string): ChatMessage[] => {
        const result: ChatMessage[] = [];
        const visited = new Set<string>();
        
        const findPath = (currentId: string): boolean => {
          if (visited.has(currentId)) return false;
          visited.add(currentId);
          
          const msg = messages.find((m) => m.id === currentId);
          if (!msg) return false;
          
          result.unshift(msg);
          
          if (!msg.metadata?.parentMessageId) return true;
          return findPath(msg.metadata.parentMessageId);
        };
        
        findPath(leafId);
        return result;
      };

      const newThread = buildThreadFromLeaf(targetSibling.id);
      setMessages(newThread);
      setThreadEpoch((e) => e + 1);
      setDataStream([]);
    },
    [getMessageSiblingInfo, messages, setDataStream]
  );

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, ...updates } : m))
    );
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const forkMessage = useCallback(
    (messageId: string): string | null => {
      const message = messages.find((m) => m.id === messageId);
      if (!message) return null;

      const forkId = `fork-${Date.now()}`;
      const fork: ChatMessage = {
        ...message,
        id: forkId,
        metadata: {
          ...message.metadata,
          parentMessageId: message.metadata?.parentMessageId,
          createdAt: new Date().toISOString(),
        },
      };

      addMessage(fork);
      return forkId;
    },
    [messages, addMessage]
  );

  const value = useMemo(
    () => ({
      messages,
      setMessages,
      getMessageSiblingInfo,
      navigateToSibling,
      addMessage,
      updateMessage,
      deleteMessage,
      forkMessage,
      threadEpoch,
    }),
    [
      messages,
      getMessageSiblingInfo,
      navigateToSibling,
      addMessage,
      updateMessage,
      deleteMessage,
      forkMessage,
      threadEpoch,
    ]
  );

  return (
    <MessageTreeContext.Provider value={value}>
      {children}
    </MessageTreeContext.Provider>
  );
}

export function useMessageTree() {
  const context = useContext(MessageTreeContext);
  if (!context) {
    throw new Error("useMessageTree must be used within a MessageTreeProvider");
  }
  return context;
}
