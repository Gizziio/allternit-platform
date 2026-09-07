"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  runtimeApi,
  type BackendRuntimeExecutionMode,
  type RuntimeExecutionMode,
} from "@/lib/agents/native-agent-api";
import { isRuntimeApiEnabled } from "@/lib/env";

const RUNTIME_API_DISABLED_MESSAGE =
  "Runtime API is disabled in this deployment (set NEXT_PUBLIC_ALLTERNIT_RUNTIME_API=1 where the gateway is reachable).";

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
  /** True when the runtime API is disabled by flag — no backend to call. */
  disabled: boolean;
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
  const disabled = !isRuntimeApiEnabled();
  const [executionMode, setExecutionMode] =
    useState<RuntimeExecutionModeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasAttemptedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (isLoading) return;

    hasAttemptedRef.current = true;

    // `/api/v1/runtime/*` is served only by the Rust allternit-api, which is
    // not publicly reachable from this deployment — fail closed with a
    // deliberate error instead of probing an endpoint that 404s.
    if (disabled) {
      setExecutionMode(null);
      setError(new Error(RUNTIME_API_DISABLED_MESSAGE));
      return;
    }

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
  }, [isLoading, disabled]);

  useEffect(() => {
    if (!hasAttemptedRef.current) {
      void refetch();
    }
  }, [refetch]);

  const setMode = useCallback(
    async (mode: RuntimeExecutionMode): Promise<RuntimeExecutionModeStatus> => {
      if (disabled) {
        throw new Error(RUNTIME_API_DISABLED_MESSAGE);
      }
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
    [disabled],
  );

  return {
    executionMode,
    isLoading,
    isSaving,
    error,
    disabled,
    refetch,
    setMode,
  };
}
