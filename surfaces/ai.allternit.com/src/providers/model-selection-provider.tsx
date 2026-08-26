"use client";

import React from "react";
import { createContext, useContext, useState, useCallback, ReactNode, useMemo, useRef, useEffect } from "react";
import type { ModelSelection } from "@/components/model-picker";
import type { ModelOption } from "@/components/prompt-kit/prompt-model-selector";
import { usePendingChatModelStore } from "@/stores/pending-chat-model.store";

interface ModelSelectionContextType {
  // Current selection
  selection: ModelSelection | null;

  // Selection state
  isSelecting: boolean;

  // Actions
  selectModel: (selection: ModelSelection) => void;
  clearSelection: () => void;
  startSelection: () => void;
  cancelSelection: () => void;

  // Available models from the current discovery source
  availableModels: ModelOption[];

  // Helper to create a brain session with current selection
  getBrainSessionConfig: () => {
    brain_profile_id: string;
    source: "chat";
    runtime_overrides?: { model_id: string };
  } | null;
}

const ModelSelectionContext = createContext<ModelSelectionContextType | undefined>(undefined);

interface ModelSelectionProviderProps {
  children: ReactNode;
  defaultSelection?: ModelSelection | null;
}

export function ModelSelectionProvider({ 
  children, 
  defaultSelection = null 
}: ModelSelectionProviderProps) {
  const [selection, setSelection] = useState<ModelSelection | null>(defaultSelection);
  const [isSelecting, setIsSelecting] = useState(false);
  const hasAppliedDefault = useRef(false);

  // Sync with defaultSelection when it becomes available (e.g. after onboarding completes)
  useEffect(() => {
    if (defaultSelection && !hasAppliedDefault.current) {
      hasAppliedDefault.current = true;
      setSelection(defaultSelection);
    }
  }, [defaultSelection]);

  // Apply a model selection requested from outside the chat surface (e.g. Model Lab).
  // This runs on mount and whenever a new pending request arrives.
  useEffect(() => {
    const pending = usePendingChatModelStore.getState().pending;
    if (pending) {
      setSelection(pending);
      usePendingChatModelStore.getState().setPending(null);
    }

    const unsubscribe = usePendingChatModelStore.subscribe((state, prevState) => {
      if (state.pending && state.pending !== prevState.pending) {
        setSelection(state.pending);
        usePendingChatModelStore.getState().setPending(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Persist the selection so non-React code (e.g. the session store building
  // the agent-chat payload) can resolve the current provider/model.
  useEffect(() => {
    try {
      if (selection) {
        window.localStorage.setItem('allternit:model-selection', JSON.stringify(selection));
      }
    } catch { /* storage unavailable */ }
  }, [selection]);

  const selectModel = useCallback((newSelection: ModelSelection) => {
    setSelection(newSelection);
    setIsSelecting(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const startSelection = useCallback(() => {
    setIsSelecting(true);
  }, []);

  const cancelSelection = useCallback(() => {
    setIsSelecting(false);
  }, []);

  const getBrainSessionConfig = useCallback(() => {
    if (!selection) return null;

    return {
      brain_profile_id: selection.profileId,
      source: "chat" as const,
      runtime_overrides: selection.modelId ? { model_id: selection.modelId } : undefined,
    };
  }, [selection]);

  const value = useMemo(() => ({
    selection,
    isSelecting,
    selectModel,
    clearSelection,
    startSelection,
    cancelSelection,
    availableModels: [] as ModelOption[],
    getBrainSessionConfig,
  }), [
    selection,
    isSelecting,
    selectModel,
    clearSelection,
    startSelection,
    cancelSelection,
    getBrainSessionConfig,
  ]);

  return (
    <ModelSelectionContext.Provider value={value}>
      {children}
    </ModelSelectionContext.Provider>
  );
}

export function useModelSelection() {
  const context = useContext(ModelSelectionContext);
  if (!context) {
    throw new Error("useModelSelection must be used within a ModelSelectionProvider");
  }
  return context;
}

export default ModelSelectionProvider;
