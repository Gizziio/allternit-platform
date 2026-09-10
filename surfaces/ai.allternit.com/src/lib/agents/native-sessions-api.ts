import { buildAuthHeaders } from "@/lib/agents/api-config";
import { getActiveRuntimeId, getRuntimeExecutionTarget } from "@/lib/runtime-target";
import { getCloudApiBaseUrl, isAgentSessionsApiEnabled, isDesktopOperatorShell } from "@/lib/env";

function getGatewayOrigin(): string {
  if (typeof window === "undefined") return "";
  if (getRuntimeExecutionTarget() === "cloud" && getActiveRuntimeId()) return "";
  const win = window as unknown as Record<string, unknown>;
  const fromWin = typeof win.__ALLTERNIT_GATEWAY_URL__ === "string" ? (win.__ALLTERNIT_GATEWAY_URL__ as string) : "";
  if (fromWin && !/^https?:\/\/(?:127\.0\.0\.1|localhost)/.test(fromWin)) return fromWin;
  return "";
}

/**
 * Same control-plane split as `native-agent-api.getAgentSessionBase`:
 * web with the agent-sessions flag talks to cloud-api (Clerk → node relay);
 * the desktop operator shell talks to local :8013. The catalog contract is
 * 8013 → gizzi `/v1/native-session/*`; cloud-api does not reshape it.
 */
function getNativeSessionsBase(): string {
  if (isAgentSessionsApiEnabled() && !isDesktopOperatorShell()) {
    return `${getCloudApiBaseUrl()}/api/v1/native-sessions`;
  }
  return `${getGatewayOrigin()}/api/v1/native-sessions`;
}

function getAgentSessionsBase(): string {
  if (isAgentSessionsApiEnabled() && !isDesktopOperatorShell()) {
    return `${getCloudApiBaseUrl()}/api/v1/agent-sessions`;
  }
  return `${getGatewayOrigin()}/api/v1/agent-sessions`;
}

const getBase = () => getNativeSessionsBase();

const STALE_BACKEND_MESSAGE =
  "Native sessions aren't supported by this backend yet. Update Allternit Desktop (or the backend) to a version that includes the native-sessions API.";

const DISABLED_MESSAGE =
  "Native session catalog is disabled in this deployment (set NEXT_PUBLIC_ALLTERNIT_AGENT_SESSIONS_API=1 where the control plane is reachable).";

/** Gizzi Session.Info.surface is a fixed enum; `bot` is a frontend origin. */
function gizziPickupSurface(
  surface?: "chat" | "cowork" | "bot" | "code" | "browser" | "design",
): "chat" | "cowork" | "code" | "browser" | "design" | undefined {
  if (!surface) return undefined;
  if (surface === "bot") return "chat";
  return surface;
}

function assertCatalogEnabled(): void {
  if (!isAgentSessionsApiEnabled() && !isDesktopOperatorShell()) {
    throw new Error(DISABLED_MESSAGE);
  }
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = await buildAuthHeaders();
  return fetch(url, {
    ...options,
    headers: { ...authHeaders, ...options.headers },
  });
}

/** Parse a JSON response body, translating the SPA-HTML fallback (stale backend
 *  serving index.html with 200) and other non-JSON bodies into actionable errors. */
async function readJson<T>(res: Response, what: string): Promise<T> {
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error(`${what}: ${STALE_BACKEND_MESSAGE}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${what}: expected JSON but got an unreadable response. ${STALE_BACKEND_MESSAGE}`);
  }
}

export interface NativeHarnessInfo {
  id: string;
  label: string;
  reader: string;
  projectable: boolean;
  resumeHint: string;
  home: string;
  present: boolean;
}

export interface NativeCatalogSession {
  harness: string;
  sessionId: string;
  path: string;
  cwd?: string;
  title?: string;
  updatedAt: number;
  createdAt?: number;
  fingerprint: string;
  lastEventId?: string;
  installed: boolean;
  reader: string;
  projectable: boolean;
}

export interface NativeSourceRef {
  harness: string;
  sessionId: string;
  path: string;
  snapshotHash: string;
  snapshotAt: number;
  eventId?: string;
  nativeHash?: string;
  fetchedHash?: string;
}

export interface PickupResult {
  session: { id: string; title?: string; directory?: string; sourceRef?: NativeSourceRef };
  source: NativeSourceRef;
  warnings: { code: string; message: string }[];
  eventCount: number;
}

export interface FetchOriginResult {
  divergence: "clean" | "native_ahead" | "missing";
  fetched: number;
  events: Array<{ kind: string; role?: string; text?: string }>;
}

export const nativeSessionsApi = {
  async listHarnesses(): Promise<NativeHarnessInfo[]> {
    assertCatalogEnabled();
    const res = await authFetch(`${getBase()}/harnesses`);
    if (!res.ok) throw new Error(`native harnesses failed: ${res.status}`);
    const data = await readJson<{ harnesses: NativeHarnessInfo[] }>(res, "native harnesses");
    return data.harnesses ?? [];
  },

  async list(opts: { cwd?: string; harness?: string } = {}): Promise<NativeCatalogSession[]> {
    assertCatalogEnabled();
    const params = new URLSearchParams();
    if (opts.cwd) params.set("cwd", opts.cwd);
    if (opts.harness) params.set("harness", opts.harness);
    const qs = params.toString();
    const res = await authFetch(`${getBase()}${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error(`native catalog failed: ${res.status}`);
    const data = await readJson<{ sessions: NativeCatalogSession[] }>(res, "native catalog");
    return data.sessions ?? [];
  },

  async show(harness: string, id: string, cwd?: string) {
    assertCatalogEnabled();
    const params = new URLSearchParams();
    if (cwd) params.set("cwd", cwd);
    const qs = params.toString();
    const res = await authFetch(`${getBase()}/${encodeURIComponent(harness)}/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error(`native show failed: ${res.status}`);
    return readJson(res, "native show");
  },

  async pickup(input: {
    harness: string;
    sessionId: string;
    surface?: "chat" | "cowork" | "bot" | "code" | "browser" | "design";
    cwd?: string;
  }): Promise<PickupResult> {
    assertCatalogEnabled();
    const res = await authFetch(`${getBase()}/pickup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        harness: input.harness,
        sessionId: input.sessionId,
        surface: gizziPickupSurface(input.surface),
        cwd: input.cwd,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `pickup failed: ${res.status}`);
    }
    return readJson<PickupResult>(res, "pickup");
  },

  async exportNative(sessionId: string, harness?: string): Promise<{
    harness: string
    sessionId: string
    path: string
    resumeHint: string
    at: number
  }> {
    assertCatalogEnabled();
    const res = await authFetch(`${getAgentSessionsBase()}/${encodeURIComponent(sessionId)}/export-native`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ harness }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `export-native failed: ${res.status}`);
    }
    return readJson(res, "export-native");
  },

  async fetchOrigin(sessionId: string): Promise<FetchOriginResult> {
    assertCatalogEnabled();
    const res = await authFetch(`${getAgentSessionsBase()}/${encodeURIComponent(sessionId)}/fetch-origin`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`fetch-origin failed: ${res.status}`);
    return readJson<FetchOriginResult>(res, "fetch-origin");
  },
};

export function sourceRefFromMetadata(metadata: Record<string, unknown> | undefined): NativeSourceRef | undefined {
  const raw = metadata?.sourceRef;
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.harness !== "string" || typeof rec.sessionId !== "string") return undefined;
  return rec as unknown as NativeSourceRef;
}
