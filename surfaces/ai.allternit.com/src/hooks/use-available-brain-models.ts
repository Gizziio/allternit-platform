"use client";

import { useEffect, useMemo, useState } from "react";
import { useModelDiscovery } from "@/integration/api-client";
import type { ModelOption } from "@/components/prompt-kit/prompt-model-selector";

// Terminal Server URL for fetching real models
declare const __TERMINAL_SERVER_URL__: string | undefined;

/// Normalize backend capability payloads (array of strings or object of booleans)
/// into a string[] suitable for the model picker badges.
function normalizeCapabilities(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
  }
  return undefined;
}

function getProviderDiscoveryUrl(): string {
  if (typeof window === "undefined") return "/api/v1/providers";
  try {
    const stored = window.localStorage.getItem("allternit.runtime-backend.snapshot");
    if (stored) {
      const snap = JSON.parse(stored) as { resolved_gateway_url?: string };
      const gw = snap?.resolved_gateway_url ?? "";
      if (gw && !/^https?:\/\/(?:127\.0\.0\.1|localhost)/.test(gw)) return `${gw}/api/v1/providers`;
    }
  } catch {
    // storage unavailable
  }
  return "/api/v1/providers";
}

async function fetchRegisteredProviders(signal: AbortSignal): Promise<Response> {
  const sidecar = typeof window !== "undefined" ? window.allternitSidecar : undefined;
  if (sidecar && typeof sidecar.getApiUrl === "function") {
    const apiUrl = await sidecar.getApiUrl();
    if (apiUrl) {
      return fetch(`${apiUrl.replace(/\/$/, "")}/provider`, {
        signal,
      });
    }
  }
  return fetch(getProviderDiscoveryUrl(), { signal });
}

// Provider discovery is slow (~2-5s) and the composer remounts whenever the
// code-mode canvas swaps sessions, which left the model pill stuck on
// "Loading..." after every session switch. Cache the discovery payload in
// memory + localStorage (10 min TTL) so remounts render models instantly and
// refresh silently in the background.
const PROVIDER_DISCOVERY_CACHE_KEY = "allternit-provider-discovery-cache-v2";
const PROVIDER_DISCOVERY_TTL_MS = 10 * 60 * 1000;
let providerDiscoveryMemoryCache: ModelOption[] | null = null;

async function fetchLocalModels(signal: AbortSignal): Promise<ModelOption[]> {
  const models: ModelOption[] = [];
  try {
    // Ollama-backed local models (Local Brain and any manually pulled models).
    const ollamaRes = await fetch("/api/provider/ollama/models", { signal });
    if (ollamaRes.ok) {
      const data = (await ollamaRes.json()) as { models?: Array<{ name: string; size?: number }> };
      (data.models || []).forEach((m) => {
        if (!m?.name) return;
        models.push({
          id: `ollama/${m.name}`,
          name: m.name,
          providerId: "ollama",
          providerName: "Ollama",
          description: "Local Ollama model",
        });
      });
    }
  } catch {
    // Ollama not running or endpoint unavailable.
  }
  try {
    // Sidecar-installed local models (HuggingFace GGUFs, etc.).
    const localRes = await fetch("/api/local-brain/models", { signal });
    if (localRes.ok) {
      const data = (await localRes.json()) as { models?: Array<{ tag: string; sizeBytes?: number }> };
      (data.models || []).forEach((m) => {
        if (!m?.tag) return;
        models.push({
          id: `allternit-sidecar/${m.tag}`,
          name: m.tag,
          providerId: "allternit-sidecar",
          providerName: "Allternit Sidecar",
          description: "Local sidecar model",
        });
      });
    }
  } catch {
    // Local-brain sidecar unavailable.
  }
  return models;
}

function readProviderDiscoveryCache(): ModelOption[] | null {
  if (providerDiscoveryMemoryCache) return providerDiscoveryMemoryCache;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROVIDER_DISCOVERY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts?: number; models?: ModelOption[] };
    if (!parsed?.models?.length) return null;
    if (typeof parsed.ts === "number" && Date.now() - parsed.ts > PROVIDER_DISCOVERY_TTL_MS) return null;
    providerDiscoveryMemoryCache = parsed.models;
    return parsed.models;
  } catch {
    return null;
  }
}

function writeProviderDiscoveryCache(models: ModelOption[]): void {
  providerDiscoveryMemoryCache = models;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROVIDER_DISCOVERY_CACHE_KEY, JSON.stringify({ ts: Date.now(), models }));
  } catch {
    // storage unavailable
  }
}

/**
 * Loads the union of brain models available to the current session:
 * 1. Runtime-discovered models from the terminal server / gateway providers.
 * 2. Registry models from the Allternit Brain / Gizzi provider catalog.
 * 3. Provider-specific discovery result (lowest priority, fills gaps).
 *
 * This is the single discovery source for brain/model selection.
 */
export function useAvailableBrainModels() {
  const { discoveryResult, fetchProviders, realModels } = useModelDiscovery();

  const cachedProviderModels = useMemo(() => readProviderDiscoveryCache(), []);
  const [terminalModels, setTerminalModels] = useState<ModelOption[]>(cachedProviderModels ?? []);
  const [terminalModelsLoading, setTerminalModelsLoading] = useState(cachedProviderModels === null);
  const [localModels, setLocalModels] = useState<ModelOption[]>([]);
  const [localModelsLoading, setLocalModelsLoading] = useState(true);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    // The web client already loads the provider registry through
    // useModelDiscovery below. A second eager GET here duplicated the same
    // request on every composer mount and doubled the console/network noise
    // when a runtime was offline. Keep this path only for Electron's sidecar,
    // whose /provider response is a distinct local source.
    if (!window.allternitSidecar) {
      setTerminalModelsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchTerminalModels() {
      try {
        const response = await fetchRegisteredProviders(AbortSignal.timeout(5000));
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const allModels: ModelOption[] = [];
        if (data.all && Array.isArray(data.all)) {
          // Normalize two backend shapes:
          // - Gizzi runtime: { all: [...], connected: ['id', ...] }
          // - allternit-api: { all: [...] } with per-provider status field
          const connected = Array.isArray(data.connected) ? new Set<string>(data.connected) : null;
          const registeredProviders = data.all.filter((provider: any) => {
            if (provider.id === "echo") return false;
            if (connected?.size) return connected.has(provider.id);
            return provider.status === "active";
          });
          registeredProviders.forEach((provider: any) => {
            if (!provider.models) return;
            const entries = Array.isArray(provider.models)
              ? provider.models.map((m: string) => [m, { name: m }] as const)
              : Object.entries(provider.models);
            entries.forEach(([modelId, modelData]: [string, any]) => {
              allModels.push({
                id: `${provider.id}/${modelId}`,
                name: modelData?.name || modelId,
                providerId: provider.id,
                providerName: provider.name || provider.id,
                description: modelData?.description,
                capabilities: normalizeCapabilities(modelData?.capabilities),
                context_window: modelData?.context_window ?? modelData?.context,
              });
            });
          });
        }
        if (!cancelled && allModels.length > 0) {
          setTerminalModels(allModels);
          writeProviderDiscoveryCache(allModels);
        }
      } catch {
        // provider discovery failed; leave cache as-is
      } finally {
        if (!cancelled) setTerminalModelsLoading(false);
      }
    }
    void fetchTerminalModels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadLocalModels() {
      try {
        const models = await fetchLocalModels(AbortSignal.timeout(3000));
        if (!cancelled) setLocalModels(models);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLocalModelsLoading(false);
      }
    }
    void loadLocalModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableModels = useMemo<ModelOption[]>(() => {
    const modelMap = new Map<string, ModelOption>();

    // 1) Runtime-discovered models (e.g. terminal server / gateway providers)
    terminalModels.forEach((model) => {
      if (!model?.id) return;
      modelMap.set(model.id, model);
    });

    // 2) Local models (Ollama / Local Brain)
    localModels.forEach((model) => {
      if (!model?.id) return;
      modelMap.set(model.id, model);
    });

    // 3) Registry models from Allternit Brain / Gizzi provider catalog
    (realModels || []).forEach((provider: any) => {
      let modelsList: Array<{ id: string; name?: string; description?: string; capabilities?: string[]; context_window?: number }> = [];
      if (Array.isArray(provider.models)) {
        modelsList = provider.models.map((m: string | Record<string, any>) =>
          typeof m === 'string' ? { id: m, name: m } : m
        );
      } else if (provider.models) {
        modelsList = Object.entries(provider.models as Record<string, any>).map(([id, data]) =>
          typeof data === 'string' ? { id, name: data } : { id, ...data }
        );
      }
      modelsList.forEach((model) => {
        if (!model?.id) return;
        const existing = modelMap.get(model.id);
        const enriched = {
          ...model,
          providerId: provider.id,
          providerName: provider.name,
          capabilities: normalizeCapabilities(model.capabilities ?? existing?.capabilities),
        };
        modelMap.set(model.id, existing ? { ...existing, ...enriched } : enriched);
      });
    });

    // 4) Provider-specific discovery result (lowest priority, fills gaps)
    (discoveryResult?.models || []).forEach((model: any) => {
      if (!model?.id || modelMap.has(model.id)) return;
      modelMap.set(model.id, {
        ...model,
        capabilities: normalizeCapabilities(model.capabilities),
      });
    });

    return Array.from(modelMap.values());
  }, [discoveryResult, localModels, realModels, terminalModels]);

  return {
    models: availableModels,
    isLoading: terminalModelsLoading || localModelsLoading,
    terminalModels,
    localModels,
  };
}
