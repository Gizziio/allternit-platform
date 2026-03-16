"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  runtimeApi,
  type BackendRuntimeExecutionMode,
  type RuntimeExecutionMode,
} from "@/lib/agents/native-agent-api";

export interface RuntimeExecutionModeStatus {
  mode: RuntimeExecutionMode;
  updatedAt: string;
  supportedModes: RuntimeExecutionMode[];
}

export interface UseRuntimeExecutionModeResult {
  executionMode: RuntimeExecutionModeStatus | null;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setMode: (mode: RuntimeExecutionMode) => Promise<RuntimeExecutionModeStatus>;
}

function normalizeExecutionMode(
  payload: BackendRuntimeExecutionMode,
): RuntimeExecutionModeStatus {
  return {
    mode: payload.mode,
    updatedAt: payload.updated_at,
    supportedModes: payload.supported_modes,
  };
}

export function useRuntimeExecutionMode(): UseRuntimeExecutionModeResult {
  const [executionMode, setExecutionMode] =
    useState<RuntimeExecutionModeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasAttemptedRef = useRef(false); // Track if we've already attempted to fetch

  const refetch = useCallback(async () => {
    // Skip if already loading or previously attempted (to prevent repeated 404s)
    if (isLoading || hasAttemptedRef.current) return;
    
    hasAttemptedRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const payload = await runtimeApi.getExecutionMode();
      setExecutionMode(normalizeExecutionMode(payload));
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch execution mode"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    void refetch();
  }, []); // Empty deps - only fetch once on mount

  const setMode = useCallback(
    async (mode: RuntimeExecutionMode): Promise<RuntimeExecutionModeStatus> => {
      setIsSaving(true);
      setError(null);

      try {
        const payload = await runtimeApi.setExecutionMode(mode);
        const nextMode = normalizeExecutionMode(payload);
        setExecutionMode(nextMode);
        return nextMode;
      } catch (err) {
        const normalizedError =
          err instanceof Error
            ? err
            : new Error("Failed to update execution mode");
        setError(normalizedError);
        throw normalizedError;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  return {
    executionMode,
    isLoading,
    isSaving,
    error,
    refetch,
    setMode,
  };
}
