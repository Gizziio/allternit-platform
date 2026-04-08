"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from "react";
import type { ModelData } from "@/lib/ai/types";
import { ALL_MODELS, DEFAULT_MODEL, getModelById } from "@/lib/ai/models";

interface ChatModelsContextType {
  models: ModelData[];
  getModelById: (id: string) => ModelData | undefined;
  defaultModel: string;
  modelGroups: { title: string; models: ModelData[] }[];
}

const ChatModelsContext = createContext<ChatModelsContextType | undefined>(undefined);

interface ChatModelsProviderProps {
  children: ReactNode;
  models?: ModelData[];
  defaultModel?: string;
}

export function ChatModelsProvider({
  children,
  models = ALL_MODELS,
  defaultModel = DEFAULT_MODEL,
}: ChatModelsProviderProps) {
  const getModelByIdCallback = useCallback(
    (id: string) => getModelById(id),
    []
  );

  // Group models by runtime type for UI organization
  const modelGroups = useMemo(() => {
    const apiModels = models.filter(m => m.runtimeType === "api");
    const cliModels = models.filter(m => m.runtimeType === "cli");
    const localModels = models.filter(m => m.runtimeType === "local");
    
    return [
      { title: "Cloud Models", models: apiModels },
      { title: "CLI Agents", models: cliModels },
      { title: "Local Models", models: localModels },
    ].filter(g => g.models.length > 0);
  }, [models]);

  const value = useMemo(
    () => ({
      models,
      getModelById: getModelByIdCallback,
      defaultModel,
      modelGroups,
    }),
    [models, getModelByIdCallback, defaultModel, modelGroups]
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
