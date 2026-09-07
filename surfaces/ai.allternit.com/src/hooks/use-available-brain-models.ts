"use client";

import { useEffect, useMemo, useState } from "react";
import { useModelDiscovery } from "@/integration/api-client";
import type { ModelOption } from "@/components/prompt-kit/prompt-model-selector";
import { operatorProviderDiscoveryUrl } from "@/lib/operator-gateway";
import { allternitCloudOrigin } from "@/lib/cloud-api";
import { buildAuthHeaders } from "@/lib/agents/api-config";

// Terminal Server URL for fetching real models
declare const __TERMINAL_SERVER_URL__: string | undefined;

/**
 * Backends can return `capabilities` as either a string[] of tags or a rich
 * capability object. The UI only needs a flat list of capability tags, so
 * normalize both shapes here.
 */
function normalizeCapabilities(capabilities: unknown): string[] | undefined {
  if (Array.isArray(capabilities)) {
    return capabilities.filter((c): c is string => typeof c === "string");
  }
  if (capabilities && typeof capabilities === "object") {
    const caps = capabilities as Record<string, unknown>;
    const tags: string[] = [];
    if (caps.tool_call === true || caps.toolcall === true) tags.push("tools");
    if (caps.vision === true) tags.push("vision");
    if (caps.reasoning === true) tags.push("reasoning");
    if (caps.attachment === true) tags.push("attachments");
    if (typeof caps.default_model === "string" && caps.default_model) {
      tags.push(caps.default_model);
    }
    return tags.length > 0 ? tags : undefined;
  }
  return undefined;
}

function getProviderDiscoveryUrl(): string {
  if (typeof window === "undefined") return "/api/v1/providers";
  try {
    const stored = window.localStorage.getItem("allternit.runtime-backend.snapshot");
    if (stored) {
      const snap = JSON.parse(stored) as { resolved_gateway_url?: string };
      return operatorProviderDiscoveryUrl(snap?.resolved_gateway_url);
    }
  } catch {
    // storage unavailable
  }
  return "/api/v1/providers";
}

async function fetchRegisteredProviders(signal: AbortSignal): Promise<Response> {
  const sidecar = typeof window !== "undefined" ? window.allternitSidecar : undefined;
  if (sidecar && typeof sidecar.getApiUrl === "function") {
    try {
      const apiUrl = await Promise.race([
        sidecar.getApiUrl(),
        new Promise<undefined>((_, reject) => {
          const ms = 1500;
          const timer = setTimeout(() => reject(new Error("sidecar getApiUrl timeout")), ms);
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(signal.reason ?? new Error("aborted"));
            },
            { once: true },
          );
        }),
      ]);
      if (apiUrl) {
        return fetch(`${apiUrl.replace(/\/$/, "")}/provider`, {
          signal,
        });
      }
    } catch {
      // Sidecar URL probe hung or failed — fall through to the operator gateway.
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

async function fetchAllternitCloudModels(signal: AbortSignal): Promise<ModelOption[]> {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${allternitCloudOrigin()}/v1/models`, { signal, headers });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{ id?: string; name?: string; extra?: { name?: string } }>;
    };
    const models: ModelOption[] = [];
    for (const item of json.data ?? []) {
      const id = item.id?.trim();
      if (!id) continue;
      models.push({
        id: `allternit/${id}`,
        name: item.name || item.extra?.name || id,
        providerId: "allternit",
        providerName: "Allternit Cloud",
        description: "Allternit Cloud",
      });
    }
    return models;
  } catch {
    return [];
  }
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
  const { discoveryResult, fetchProviders, realModels, providers } = useModelDiscovery();

  const cachedProviderModels = useMemo(() => readProviderDiscoveryCache(), []);
  const [terminalModels, setTerminalModels] = useState<ModelOption[]>(cachedProviderModels ?? []);
  const [terminalModelsLoading, setTerminalModelsLoading] = useState(cachedProviderModels === null);
  const [localModels, setLocalModels] = useState<ModelOption[]>([]);
  const [localModelsLoading, setLocalModelsLoading] = useState(true);
  const [cloudModels, setCloudModels] = useState<ModelOption[]>([]);

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
    async function loadCloudModels() {
      try {
        const models = await fetchAllternitCloudModels(AbortSignal.timeout(8000));
        if (!cancelled) setCloudModels(models);
      } catch {
        // catalog is best-effort; picker still shows CLI/local
      }
    }
    void loadCloudModels();
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

    // Build a set of providers that are actually reachable/credentialed so we
    // do not present registry models for providers the user has not installed
    // or authenticated.
    const activeProviderIds = new Set<string>();
    providers.forEach((p) => {
      if (p.authenticated || p.status === "ok" || p.status === "not_required") {
        activeProviderIds.add(p.provider_id);
      }
    });
    (realModels || []).forEach((provider: any) => {
      if (
        provider.status === "active" ||
        provider.status === "ready_no_models" ||
        provider.status === "missing_key" ||
        provider.api_key_set === true ||
        provider.provider_type === "subprocess"
      ) {
        activeProviderIds.add(provider.id);
      }
    });

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

    // 3) Registry models from Allternit Brain / Gizzi provider catalog.
    //    Only include models for providers that are installed, authenticated,
    //    or have an API key set so the picker does not show fake availability.
    //    Model IDs are normalized to `{providerId}/{modelId}` so the same short
    //    model id from different providers (e.g. anthropic vs claude-cli) does
    //    not collide and end up under the wrong runtime row.
    (realModels || []).forEach((provider: any) => {
      if (!activeProviderIds.has(provider.id)) return;
      const providerId = provider.id;
      if (!providerId) return;
      const modelsList = Array.isArray(provider.models)
        ? provider.models
        : provider.models
          ? Object.entries(provider.models as Record<string, any>).map(([id, data]) => ({ id, ...data }))
          : [];
      modelsList.forEach((model: any) => {
        if (!model?.id) return;
        const shortId = model.id.includes("/")
          ? model.id.split("/").slice(1).join("/")
          : model.id;
        const fullId = `${providerId}/${shortId}`;
        const existing = modelMap.get(fullId);
        const enriched: ModelOption = {
          ...model,
          id: fullId,
          providerId,
          providerName: provider.name,
          capabilities: normalizeCapabilities(model.capabilities),
        };
        modelMap.set(
          fullId,
          existing
            ? {
                ...existing,
                ...enriched,
                name: enriched.name || existing.name,
                description: enriched.description ?? existing.description,
                capabilities: enriched.capabilities ?? existing.capabilities,
              }
            : enriched
        );
      });
    });

    // 4) Provider-specific discovery result (lowest priority, fills gaps).
    //    These come back as short ids; skip them if the registry already
    //    supplied the same provider/model pair.
    cloudModels.forEach((model) => {
      if (!model?.id) return;
      if (!modelMap.has(model.id)) modelMap.set(model.id, model);
    });

    (discoveryResult?.models || []).forEach((model: any) => {
      if (!model?.id) return;
      const shortId = model.id.includes("/")
        ? model.id.split("/").slice(1).join("/")
        : model.id;
      // We do not know the queried provider here, so keep the short id as a
      // fallback key. If it overlaps with a normalized registry model it is
      // ignored.
      if (modelMap.has(shortId)) return;
      modelMap.set(shortId, {
        ...model,
        capabilities: normalizeCapabilities(model.capabilities),
      });
    });

    return Array.from(modelMap.values());
  }, [cloudModels, discoveryResult, localModels, providers, realModels, terminalModels]);

  return {
    models: availableModels,
    isLoading: terminalModelsLoading || localModelsLoading,
    terminalModels,
    localModels,
  };
}
