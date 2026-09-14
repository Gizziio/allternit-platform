"use client";

import React, { createContext, useContext, ReactNode, useMemo } from "react";

export interface ChatModelItem {
  id: string;
  name: string;
  provider: string;
  providerId?: string;
  runtimeType?: "api" | "cli" | "local";
}

interface ChatModelsContextType {
  models: ChatModelItem[];
  getModelById: (id: string) => ChatModelItem | undefined;
  defaultModel: string;
  modelGroups: { title: string; models: ChatModelItem[] }[];
}

const ChatModelsContext = createContext<ChatModelsContextType | undefined>(undefined);

interface ChatModelsProviderProps {
  children: ReactNode;
  models?: ChatModelItem[];
  defaultModel?: string;
}

export function ChatModelsProvider({
  children,
  models = [],
  defaultModel = "kimi/kimi-for-coding",
}: ChatModelsProviderProps) {
  const getModelById = (id: string) => models.find((m) => m.id === id);

  const modelGroups = useMemo(() => {
    const apiModels = models.filter((m) => m.runtimeType === "api" || !m.runtimeType);
    const cliModels = models.filter((m) => m.runtimeType === "cli");
    const localModels = models.filter((m) => m.runtimeType === "local");

    return [
      { title: "Cloud Models", models: apiModels },
      { title: "CLI Agents", models: cliModels },
      { title: "Local Models", models: localModels },
    ].filter((g) => g.models.length > 0);
  }, [models]);

  const value = useMemo(
    () => ({
      models,
      getModelById,
      defaultModel,
      modelGroups,
    }),
    [models, defaultModel, modelGroups]
  );

  return (
    <ChatModelsContext.Provider value={value}>
      {children}
    </ChatModelsContext.Provider>
  );
}

export function useChatModels() {
  const context = useContext(ChatModelsContext);
  if (!context) {
    throw new Error("useChatModels must be used within a ChatModelsProvider");
  }
  return context;
}

export default ChatModelsProvider;
