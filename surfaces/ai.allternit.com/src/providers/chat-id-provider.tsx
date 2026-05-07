"use client";

import React, { createContext, useContext, ReactNode } from "react";

interface ChatIdContextType {
  id: string | null;
  isPersisted: boolean;
  source: "local" | "share" | "project";
}

const ChatIdContext = createContext<ChatIdContextType | undefined>(undefined);

interface ChatIdProviderProps {
  children: ReactNode;
  chatId: string | null;
  isPersisted?: boolean;
  source?: "local" | "share" | "project";
}

export function ChatIdProvider({
  children,
  chatId,
  isPersisted = false,
  source = "local",
}: ChatIdProviderProps) {
  return (
    <ChatIdContext.Provider value={{ id: chatId, isPersisted, source }}>
      {children}
    </ChatIdContext.Provider>
  );
}

export function useChatId() {
  const context = useContext(ChatIdContext);
  if (context === undefined) {
    throw new Error("useChatId must be used within a ChatIdProvider");
  }
  return context;
}
