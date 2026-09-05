"use client";

import React from "react";
import { createContext, useContext, useState, useCallback, ReactNode, useMemo, useRef, useEffect } from "react";
import type { ModelSelection } from "@/components/model-picker";
import type { ModelOption } from "@/components/prompt-kit/prompt-model-selector";
import { usePendingChatModelStore } from "@/stores/pending-chat-model.store";
import { useAvailableBrainModels } from "@/hooks/use-available-brain-models";
import { useModelDiscovery } from "@/integration/api-client";
import {
  isMistakenAutoDefault,
  persistModelSelection,
  pickDefaultBrain,
  readPersistedModelSelection,
  shouldKeepPersistedSelection,
  type AllternitPlan,
} from "@/lib/default-brain";
import { getBillingSubscription } from "@/lib/cloud-console-api";

interface ModelSelectionContextType {
  // Current selection
  selection: ModelSelection | null;

  // Available models from discovery
  availableModels: ModelOption[];
  isLoading: boolean;

  // Selection state
  isSelecting: boolean;

  // Actions
  selectModel: (selection: ModelSelection) => void;
  clearSelection: () => void;
  startSelection: () => void;
  cancelSelection: () => void;
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
  const [selection, setSelection] = useState<ModelSelection | null>(
    () => defaultSelection ?? readPersistedModelSelection(),
  );
  const [isSelecting, setIsSelecting] = useState(false);
  const hasAppliedDefault = useRef(Boolean(defaultSelection));
  const { models: availableModels, isLoading } = useAvailableBrainModels();
  const { authenticatedProviders, fetchProviders } = useModelDiscovery();
  const [authStatusKnown, setAuthStatusKnown] = useState(false);
  const [plan, setPlan] = useState<AllternitPlan | null>(null);
  const authedIds = useMemo(
    () => authenticatedProviders.map((p) => p.provider_id),
    [authenticatedProviders],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchProviders().then((result) => {
      // Failed/timed-out auth must not look like "nobody is signed in".
      if (!cancelled && result) setAuthStatusKnown(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchProviders]);

  useEffect(() => {
    let cancelled = false;
    void getBillingSubscription().then((sub) => {
      if (cancelled || !sub) return;
      setPlan({
        id: sub.plan_id,
        label: sub.label,
        plan_tier: sub.plan_tier,
        status: sub.status,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const keepPersisted = shouldKeepPersistedSelection(selection, authedIds, authStatusKnown, plan);

  // Restore a signed-in CLI after discovery. Wait until models are loaded
  // so an empty first paint cannot replace the persisted pick.
  useEffect(() => {
    if (!authStatusKnown) return;
    if (isLoading) return;
    if (keepPersisted) return;
    if (availableModels.length === 0) return;
    const picked =
      pickDefaultBrain(availableModels, authedIds, plan) ??
      (defaultSelection && !isMistakenAutoDefault(defaultSelection) ? defaultSelection : null);
    if (!picked) {
      if (selection && !keepPersisted) {
        setSelection(null);
        persistModelSelection(null);
      }
      return;
    }
    hasAppliedDefault.current = true;
    setSelection(picked);
    persistModelSelection(picked);
  }, [authStatusKnown, availableModels, authedIds, defaultSelection, isLoading, keepPersisted, plan, selection]);

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

  const selectModel = useCallback((newSelection: ModelSelection) => {
    const pinned = { ...newSelection, modelAuto: false };
    setSelection(pinned);
    persistModelSelection(pinned);
    setIsSelecting(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    persistModelSelection(null);
  }, []);

  const startSelection = useCallback(() => {
    setIsSelecting(true);
  }, []);

  const cancelSelection = useCallback(() => {
    setIsSelecting(false);
  }, []);

  const value = useMemo(() => ({
    selection,
    availableModels,
    isLoading,
    isSelecting,
    selectModel,
    clearSelection,
    startSelection,
    cancelSelection,
  }), [
    selection,
    availableModels,
    isLoading,
    isSelecting,
    selectModel,
    clearSelection,
    startSelection,
    cancelSelection,
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
