/**
 * Browser-workflow verify API — typed client for the computer-use gateway's
 * network-traces surface (cu28; gateway/network_traces_router.py). Lives in
 * src/lib/ (cu29): consumed by the Fabric Transport view — the live
 * fabric-transport surface — not the legacy src/remote-control/ tree.
 *
 * Distilled shapes only: the gateway never sends raw HAR or step payload
 * values across this API, and neither do these types.
 *
 * Gateway contract:
 *   GET  /v1/browser-skills                              → { specs: WorkflowSpecSummary[] }
 *   GET  /v1/browser-skills/{skill_id}                   → { workflow: WorkflowSpecDetail }
 *   POST /v1/browser-skills/verify                       → { verify_id, status, poll }
 *        ({ workflow? | skill_id?, target_url?, wait? })    (canned self-check when empty)
 *   GET  /v1/browser-skills/verify/{verify_id}           → VerifyResult
 *   GET  /v1/browser-skills/verify/{verify_id}/receipt/check
 *                                                        → ReceiptCheck
 */

import { cloudApiUrl } from "@/lib/cloud-api";
import { getPlatformComputerUseBaseUrl } from "@/integration/computer-use-engine";

// ============================================================================
// Types (all distilled — no raw HAR, no step payload values)
// ============================================================================

export interface WorkflowSpecSummary {
  skill_id: string;
  source: string;
  valid: boolean;
  error: string | null;
  workflowId?: string;
  title?: string;
  provider?: string;
  stepCount?: number;
  hasNetworkTrace?: boolean;
  networkTraceEntries?: number;
}

export interface WorkflowSpecStep {
  id?: string;
  kind?: string;
  target?: string;
  reason?: string;
}

export interface NetworkTraceEntry {
  method: string;
  host: string;
  pathTemplate: string;
  payloadKeysHash: string | null;
  verifiable: boolean;
}

export interface NetworkTrace {
  version: number;
  entries: NetworkTraceEntry[];
}

export interface WorkflowSpecDetail {
  workflowId?: string;
  title?: string;
  provider?: string;
  schemaVersion?: string;
  sourceRunId?: string;
  inputCount?: number;
  steps: WorkflowSpecStep[];
  stepCount?: number;
  safety: {
    requiresApprovalFor: string[];
    redactionCount: number;
  };
  networkTrace: NetworkTrace | null;
}

export interface NetworkDeviation {
  kind: string;
  index: number;
  live_index: number | null;
  expected: Partial<NetworkTraceEntry>;
  actual: Partial<NetworkTraceEntry> | null;
}

export type A11ySummary =
  | { added: number; removed: number; modified: number }
  | { status: "unverifiable" };

export interface VerifyResult {
  verify_id: string;
  status: string;
  mode: string;
  workflow_id?: string;
  target_url?: string;
  network?: { status: string; deviations: NetworkDeviation[] };
  a11y?: A11ySummary;
  workflow_status?: string;
  approvals?: string[];
  grant_requests?: number;
  receipt_id?: string;
  receipt_hash?: string;
  trace?: NetworkTrace;
  error?: string | null;
}

export interface ReceiptCheck {
  verify_id: string;
  receipt_id?: string;
  valid: boolean;
  stored_hash: string;
  recomputed_hash: string;
  tampered: boolean;
}

export interface VerifyStart {
  verify_id: string;
  status: string;
  mode?: string;
  poll?: string;
}

// ============================================================================
// Transport (same conventions as api/recordings.ts)
// ============================================================================

export class WorkflowsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "WorkflowsApiError";
  }
}

function gatewayBase(): string {
  return getPlatformComputerUseBaseUrl().replace(/\/+$/, "");
}

/** Fetch a `/v1/browser-skills…` path. Default hits the local ACU gateway. */
export type WorkflowsFetch = (path: string, init?: RequestInit) => Promise<Response>;

export interface WorkflowsCallOptions {
  fetch?: WorkflowsFetch;
}

/**
 * Fabric Transport PWA transport: relay `/v1/browser-skills` through the
 * paired machine (desktop maps that path to the ACU gateway on :8760).
 */
export function createFabricWorkflowsFetch(
  runtimeId: string,
  getToken: () => Promise<string | null>,
): WorkflowsFetch {
  return async (path, init) => {
    const token = await getToken();
    if (!token) {
      return new Response(JSON.stringify({ detail: "Sign in required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const method = (init?.method ?? "GET").toUpperCase();
    const rawBody = init?.body;
    const body = typeof rawBody === "string" ? rawBody : rawBody ? String(rawBody) : "";
    return fetch(cloudApiUrl(`/api/v1/runtime-devices/${encodeURIComponent(runtimeId)}/proxy`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method,
        path,
        body,
        bodyEncoding: "utf8",
      }),
      signal: init?.signal,
    });
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown; message?: unknown; error?: unknown };
    const raw = body.detail ?? body.message ?? body.error;
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object") return JSON.stringify(raw);
  } catch {
    // fall through
  }
  return `HTTP ${response.status}`;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  options?: WorkflowsCallOptions,
): Promise<T> {
  const doFetch = options?.fetch ?? ((p, i) => fetch(`${gatewayBase()}${p}`, i));
  const response = await doFetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new WorkflowsApiError(await readErrorMessage(response), response.status);
  }
  return (await response.json()) as T;
}

// ============================================================================
// API
// ============================================================================

export async function listWorkflowSpecs(
  options?: WorkflowsCallOptions,
): Promise<WorkflowSpecSummary[]> {
  const body = await requestJson<{ specs?: WorkflowSpecSummary[] }>(
    "/v1/browser-skills",
    {},
    options,
  );
  return Array.isArray(body.specs) ? body.specs : [];
}

export async function getWorkflowSpecDetail(
  skillId: string,
  options?: WorkflowsCallOptions,
): Promise<WorkflowSpecDetail> {
  const body = await requestJson<{ workflow?: WorkflowSpecDetail }>(
    `/v1/browser-skills/${encodeURIComponent(skillId)}`,
    {},
    options,
  );
  return (
    body.workflow ?? {
      steps: [],
      safety: { requiresApprovalFor: [], redactionCount: 0 },
      networkTrace: null,
    }
  );
}

export interface StartVerifyOptions {
  /** Skill package id; the inspected spec is read server-side. */
  skillId?: string;
  /** Explicit spec object (server validates + distills). */
  workflow?: Record<string, unknown>;
  /** Absolute http(s) URL. Omit for the canned deterministic self-check. */
  targetUrl?: string;
}

export async function startWorkflowVerify(
  options: StartVerifyOptions,
  call?: WorkflowsCallOptions,
): Promise<VerifyStart> {
  const body: Record<string, unknown> = {};
  if (options.skillId) body.skill_id = options.skillId;
  if (options.workflow) body.workflow = options.workflow;
  if (options.targetUrl) body.target_url = options.targetUrl;
  return requestJson<VerifyStart>(
    "/v1/browser-skills/verify",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    call,
  );
}

export async function getVerifyResult(
  verifyId: string,
  call?: WorkflowsCallOptions,
): Promise<VerifyResult> {
  return requestJson<VerifyResult>(
    `/v1/browser-skills/verify/${encodeURIComponent(verifyId)}`,
    {},
    call,
  );
}

export async function checkVerifyReceipt(
  verifyId: string,
  call?: WorkflowsCallOptions,
): Promise<ReceiptCheck> {
  return requestJson<ReceiptCheck>(
    `/v1/browser-skills/verify/${encodeURIComponent(verifyId)}/receipt/check`,
    {},
    call,
  );
}

export const TERMINAL_VERIFY_STATUSES = new Set(["completed", "failed"]);

export function isTerminalVerifyStatus(status: string): boolean {
  return TERMINAL_VERIFY_STATUSES.has(status);
}

/**
 * Poll a verify until it reaches a terminal status. The canned self-check
 * drives a real Playwright chain (record → teach → batch → verify), so the
 * default budget is generous; give up with the last observed status rather
 * than hanging forever.
 */
export async function pollVerifyUntilTerminal(
  verifyId: string,
  options: {
    intervalMs?: number;
    maxPolls?: number;
    signal?: AbortSignal;
    onUpdate?: (result: VerifyResult) => void;
    fetch?: WorkflowsFetch;
  } = {},
): Promise<VerifyResult> {
  const intervalMs = options.intervalMs ?? 2000;
  const maxPolls = options.maxPolls ?? 90;
  const call = options.fetch ? { fetch: options.fetch } : undefined;
  let last = await getVerifyResult(verifyId, call);
  options.onUpdate?.(last);

  for (let i = 0; i < maxPolls; i += 1) {
    if (isTerminalVerifyStatus(last.status)) return last;
    if (options.signal?.aborted) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    if (options.signal?.aborted) return last;
    last = await getVerifyResult(verifyId, call);
    options.onUpdate?.(last);
  }
  return last;
}
