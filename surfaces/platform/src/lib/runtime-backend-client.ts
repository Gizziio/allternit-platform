"use client";

import type { RuntimeBackendResponse } from "@/api/infrastructure/runtime-backend";

const DEFAULT_GATEWAY_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_A2R_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    "http://127.0.0.1:8013",
);

const SNAPSHOT_STORAGE_KEY = "a2r.runtime-backend.snapshot";
const SNAPSHOT_EVENT = "a2r:runtime-backend-changed";
const SNAPSHOT_TTL_MS = 15_000;

export interface ClientRuntimeBackendSnapshot extends RuntimeBackendResponse {
  resolved_gateway_url: string;
  resolved_gateway_ws_url: string;
  fetched_at: string;
}

let inflightSnapshotPromise: Promise<ClientRuntimeBackendSnapshot> | null = null;

function normalizeBaseUrl(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .replace(/\/api\/v1\/?$/i, "")
    .replace(/\/+$/g, "");
}

function toWsBaseUrl(value: string | null | undefined): string {
  return normalizeBaseUrl(value)
    .replace(/^http:\/\//i, "ws://")
    .replace(/^https:\/\//i, "wss://");
}

function buildDefaultSnapshot(): ClientRuntimeBackendSnapshot {
  return {
    mode: "local",
    fallback_mode: "local",
    source: "default",
    gateway_url: null,
    gateway_ws_url: null,
    active_backend: null,
    available_backends: [],
    resolved_gateway_url: DEFAULT_GATEWAY_BASE_URL,
    resolved_gateway_ws_url: toWsBaseUrl(DEFAULT_GATEWAY_BASE_URL),
    fetched_at: new Date(0).toISOString(),
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readStoredSnapshot(): ClientRuntimeBackendSnapshot | null {
  if (!isBrowser()) return null;

  const win = window as unknown as Window & Record<string, unknown>;
  const windowSnapshot = win.__A2R_RUNTIME_BACKEND__;
  if (windowSnapshot && typeof windowSnapshot === "object") {
    return windowSnapshot as ClientRuntimeBackendSnapshot;
  }

  try {
    const stored = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ClientRuntimeBackendSnapshot;
  } catch {
    return null;
  }
}

function persistSnapshot(snapshot: ClientRuntimeBackendSnapshot): ClientRuntimeBackendSnapshot {
  if (!isBrowser()) return snapshot;

  const win = window as unknown as Window & Record<string, unknown>;
  win.__A2R_RUNTIME_BACKEND__ = snapshot;
  win.__A2R_GATEWAY_URL__ = snapshot.resolved_gateway_url;
  win.__A2R_GATEWAY_URL = snapshot.resolved_gateway_url;
  win.__A2R_API_URL = `${snapshot.resolved_gateway_url}/api/v1`;

  try {
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota/runtime errors.
  }

  window.dispatchEvent(
    new CustomEvent(SNAPSHOT_EVENT, {
      detail: snapshot,
    }),
  );

  return snapshot;
}

export function applyRuntimeBackendSnapshot(
  runtimeBackend: RuntimeBackendResponse | null | undefined,
): ClientRuntimeBackendSnapshot {
  const fallback = readStoredSnapshot() ?? buildDefaultSnapshot();
  const resolvedGatewayUrl = normalizeBaseUrl(
    runtimeBackend?.gateway_url || fallback.resolved_gateway_url || DEFAULT_GATEWAY_BASE_URL,
  );
  const resolvedGatewayWsUrl = normalizeBaseUrl(
    runtimeBackend?.gateway_ws_url || toWsBaseUrl(resolvedGatewayUrl),
  );

  return persistSnapshot({
    ...(runtimeBackend ?? fallback),
    resolved_gateway_url: resolvedGatewayUrl,
    resolved_gateway_ws_url: resolvedGatewayWsUrl,
    fetched_at: new Date().toISOString(),
  });
}

export function getRuntimeBackendSnapshotSync(): ClientRuntimeBackendSnapshot {
  return readStoredSnapshot() ?? buildDefaultSnapshot();
}

export function getRuntimeGatewayBaseUrlSync(): string {
  return getRuntimeBackendSnapshotSync().resolved_gateway_url;
}

export function getRuntimeGatewayWsBaseUrlSync(): string {
  return getRuntimeBackendSnapshotSync().resolved_gateway_ws_url;
}

export async function loadRuntimeBackendSnapshot(
  options: { force?: boolean } = {},
): Promise<ClientRuntimeBackendSnapshot> {
  const cached = getRuntimeBackendSnapshotSync();
  const fetchedAt = Date.parse(cached.fetched_at);

  if (
    !options.force &&
    Number.isFinite(fetchedAt) &&
    Date.now() - fetchedAt < SNAPSHOT_TTL_MS
  ) {
    return cached;
  }

  if (inflightSnapshotPromise && !options.force) {
    return inflightSnapshotPromise;
  }

  if (!isBrowser()) {
    return cached;
  }

  inflightSnapshotPromise = fetch("/api/v1/runtime/backend", {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load runtime backend snapshot");
      }

      const payload = (await response.json()) as RuntimeBackendResponse;
      return applyRuntimeBackendSnapshot(payload);
    })
    .catch(() => cached)
    .finally(() => {
      inflightSnapshotPromise = null;
    });

  return inflightSnapshotPromise;
}

export async function getRuntimeGatewayBaseUrl(): Promise<string> {
  const snapshot = await loadRuntimeBackendSnapshot();
  return snapshot.resolved_gateway_url;
}

export async function getRuntimeGatewayWsBaseUrl(): Promise<string> {
  const snapshot = await loadRuntimeBackendSnapshot();
  return snapshot.resolved_gateway_ws_url;
}

export function subscribeRuntimeBackendSnapshot(
  listener: (snapshot: ClientRuntimeBackendSnapshot) => void,
): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ClientRuntimeBackendSnapshot>).detail;
    if (detail) {
      listener(detail);
    }
  };

  window.addEventListener(SNAPSHOT_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(SNAPSHOT_EVENT, handler as EventListener);
  };
}
