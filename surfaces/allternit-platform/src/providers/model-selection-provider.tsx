"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from "react";
import type { ModelSelection } from "@/components/model-picker";

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
