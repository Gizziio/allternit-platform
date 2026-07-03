"use client";

import { useEffect, useMemo, useState } from "react";
import { setupApi } from "@/services/setup-api";
import type { ModelSelection } from "@/components/model-picker";

/**
 * Loads the user's configured default brain from the backend and returns it in
 * the shape expected by `<ModelSelectionProvider>`.
 *
 * This lets every surface (chat, cowork, code, browser, design) reflect the
 * brain that was configured via the onboarding wizard or the Gizzi runtime
 * config, even when local UI state is empty.
 */
export function useDefaultModelSelection(): ModelSelection | null {
  const [backendDefaultModel, setBackendDefaultModel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setupApi
      .getConfig()
      .then((config) => {
        if (cancelled) return;
        const model = config.user.defaultModel;
        if (model) setBackendDefaultModel(model);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    if (!backendDefaultModel) return null;
    const sep = backendDefaultModel.indexOf("/");
    if (sep > 0) {
      const providerId = backendDefaultModel.slice(0, sep);
      const modelId = backendDefaultModel.slice(sep + 1);
      return { providerId, profileId: providerId, modelId, modelName: modelId };
    }
    return { providerId: backendDefaultModel, profileId: backendDefaultModel, modelId: "", modelName: "" };
  }, [backendDefaultModel]);
}
