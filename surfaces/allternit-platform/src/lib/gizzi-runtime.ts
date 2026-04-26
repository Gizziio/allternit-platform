import { getAuth } from "@/lib/server-auth";
import {
  resolveRuntimeBackendForAuthUserId,
  toGatewayAuthorizationHeader,
} from "@/lib/runtime-backend";
import fs from "fs";
import path from "path";
import os from "os";

const LOCAL_GIZZI_BASE = (
  process.env.TERMINAL_SERVER_URL ?? "http://127.0.0.1:4096"
).replace(/\/+$/, "");

function shouldPreferLocalDesktopRuntime(): boolean {
  return (
    process.env.ALLTERNIT_DESKTOP_AUTH_ENABLED === "1" ||
    process.env.NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH === "1"
  );
}

export class GizziRuntimeError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "GizziRuntimeError";
  }
}

type GizziCandidate = {
  base: string;
  authorization?: string;
};

type GizziDevSession = {
  gizziUrl?: string;
  gizziPassword?: string;
  writtenAt?: number;
};

// Read gizzi credentials from the dev session file written by Electron when running in dev mode.
// The file is at ~/.allternit/gizzi-dev-session.json and is created by the Electron main process
// so it can pass the per-session gizzi password to the external Next.js dev server.
function readDevSessionCredentials(): GizziDevSession | null {
  try {
    const filePath = path.join(os.homedir(), ".allternit", "gizzi-dev-session.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as GizziDevSession;
    // Reject stale credentials older than 24 hours
    if (parsed.writtenAt && Date.now() - parsed.writtenAt > 86_400_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getGizziBasicAuthHeader(): string | undefined {
  const username =
    process.env.GIZZI_USERNAME ??
    process.env.NEXT_PUBLIC_GIZZI_USERNAME ??
    "gizzi";
  const password =
    process.env.GIZZI_PASSWORD ??
    process.env.NEXT_PUBLIC_GIZZI_PASSWORD ??
    readDevSessionCredentials()?.gizziPassword;

  if (!password) {
    return undefined;
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function getRuntimeCandidate(): Promise<GizziCandidate> {
  if (shouldPreferLocalDesktopRuntime()) {
    return {
      base: LOCAL_GIZZI_BASE,
      authorization: getGizziBasicAuthHeader(),
    };
  }

  const authState = await getAuth();
  const authUserId = authState.userId ?? "local-user";
  const resolvedRuntime = await resolveRuntimeBackendForAuthUserId(authUserId)
    .catch(() => null);

  if (resolvedRuntime?.mode === "byoc-vps" && resolvedRuntime.gatewayUrl) {
    return {
      base: resolvedRuntime.gatewayUrl.replace(/\/+$/, ""),
      authorization: toGatewayAuthorizationHeader(
        resolvedRuntime.gatewayToken,
      ) ?? undefined,
    };
  }

  return {
    base: LOCAL_GIZZI_BASE,
    authorization: getGizziBasicAuthHeader(),
  };
}

function buildHeaders(
  candidate: GizziCandidate,
  headers?: HeadersInit,
): Headers {
  const merged = new Headers(headers);

  if (!merged.has("Authorization") && candidate.authorization) {
    merged.set("Authorization", candidate.authorization);
  }

  return merged;
}

async function parseError(response: Response): Promise<GizziRuntimeError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = await response.text().catch(() => null);
  }

  const normalized =
    payload && typeof payload === "object"
      ? (payload as {
          error?: {
            code?: string;
            message?: string;
            details?: unknown;
          };
          message?: string;
        })
      : null;

  return new GizziRuntimeError(
    normalized?.error?.message ??
      normalized?.message ??
      `Runtime request failed with HTTP ${response.status}`,
    response.status,
    normalized?.error?.code,
    normalized?.error?.details ?? payload,
  );
}

export async function requestGizziJson<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & {
    body?: BodyInit | Record<string, unknown> | null;
    timeoutMs?: number;
  },
): Promise<T> {
  const candidate = await getRuntimeCandidate();
  const body =
    init?.body &&
    typeof init.body === "object" &&
    !(init.body instanceof ArrayBuffer) &&
    !(init.body instanceof Uint8Array) &&
    !(typeof Blob !== "undefined" && init.body instanceof Blob) &&
    !(typeof FormData !== "undefined" && init.body instanceof FormData)
      ? JSON.stringify(init.body)
      : (init?.body as BodyInit | null | undefined);

  const headers = buildHeaders(candidate, init?.headers);
  if (body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(`${candidate.base}${path}`, {
    ...init,
    headers,
    body: body ?? undefined,
    signal: AbortSignal.timeout(init?.timeoutMs ?? 15_000),
    // @ts-expect-error Next.js fetch typing does not include duplex yet.
    duplex: body ? "half" : undefined,
  }).catch((error: unknown) => {
    throw new GizziRuntimeError(
      error instanceof Error ? error.message : "Runtime backend is unavailable",
      503,
      "RUNTIME_UNAVAILABLE",
    );
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = (await response.json()) as { data?: T };
  return (payload?.data ?? payload) as T;
}

export async function openGizziEventStream(path: string): Promise<Response> {
  const candidate = await getRuntimeCandidate();
  const headers = buildHeaders(candidate, {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  });

  const response = await fetch(`${candidate.base}${path}`, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(15_000),
  }).catch((error: unknown) => {
    throw new GizziRuntimeError(
      error instanceof Error ? error.message : "Runtime backend is unavailable",
      503,
      "RUNTIME_UNAVAILABLE",
    );
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response;
}
