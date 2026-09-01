export interface HostedRuntimeEntitlement {
  planTierId: string;
  planDisplayName: string;
  canCreateHostedRuntime: boolean;
  maxHostedRuntimes: number;
  maxMemoryMb: number;
  maxHoursMonthly: number;
  usedSecondsMonthly: number;
  remainingSecondsMonthly: number;
  estimatedCostUsdMonthly: number;
  activeInstances: number;
  idleTimeoutMinutes: number;
  allowedRegions: string[];
  upgradeUrl: string;
  billingPortalUrl: string;
}

export interface HostedRuntime {
  id: string;
  name: string;
  region: string;
  status:
    | "creating"
    | "starting"
    | "running"
    | "stopping"
    | "stopped"
    | "destroying"
    | "error";
  runtimeDeviceId?: string | null;
  cpus: number;
  memoryMb: number;
  idleTimeoutMinutes: number;
  lastActivityAt?: string | null;
  stopReason?: string | null;
  monthlyUsageSeconds: number;
  monthlyEstimatedCostUsd: number;
  createdAt: string;
  startedAt?: string | null;
  stoppedAt?: string | null;
}

function baseUrl() {
  return String(
    import.meta.env.VITE_ALLTERNIT_CLOUD_API_URL || "https://allternit-cloud-api.fly.dev",
  ).replace(/\/$/, "");
}

async function request<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const controller = new AbortController();
  const timeoutMs = Number(import.meta.env.VITE_ALLTERNIT_API_TIMEOUT_MS || 15000);
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers,
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeoutId));
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload.message ||
        payload.error ||
        `Hosted compute request failed (${response.status})`,
    );
  }
  return payload as T;
}

export function getHostedEntitlement(token: string) {
  return request<HostedRuntimeEntitlement>(
    token,
    "/api/v1/hosted-runtimes/entitlement",
  );
}

export function listHostedRuntimes(token: string) {
  return request<HostedRuntime[]>(token, "/api/v1/hosted-runtimes");
}

export function createHostedRuntime(
  token: string,
  input: { name?: string; region?: string; memoryMb?: number } = {},
) {
  return request<HostedRuntime>(token, "/api/v1/hosted-runtimes", {
    method: "POST",
    body: JSON.stringify({ region: "lax", memoryMb: 1024, ...input }),
  });
}

export function startHostedRuntime(token: string, id: string) {
  return request<HostedRuntime>(
    token,
    `/api/v1/hosted-runtimes/${encodeURIComponent(id)}/start`,
    { method: "POST" },
  );
}

export function stopHostedRuntime(token: string, id: string) {
  return request<HostedRuntime>(
    token,
    `/api/v1/hosted-runtimes/${encodeURIComponent(id)}/stop`,
    { method: "POST" },
  );
}

export async function destroyHostedRuntime(token: string, id: string) {
  const response = await fetch(
    `${baseUrl()}/api/v1/hosted-runtimes/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload.message ||
        payload.error ||
        `Unable to destroy hosted runtime (${response.status})`,
    );
  }
}
