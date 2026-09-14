/**
 * Browser-workflow verify API — typed client for the computer-use gateway's
 * network-traces surface (cu28; gateway/network_traces_router.py).
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

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${gatewayBase()}${path}`, {
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

export async function listWorkflowSpecs(): Promise<WorkflowSpecSummary[]> {
  const body = await requestJson<{ specs?: WorkflowSpecSummary[] }>("/v1/browser-skills");
  return Array.isArray(body.specs) ? body.specs : [];
}

export async function getWorkflowSpecDetail(skillId: string): Promise<WorkflowSpecDetail> {
  const body = await requestJson<{ workflow?: WorkflowSpecDetail }>(
    `/v1/browser-skills/${encodeURIComponent(skillId)}`,
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

export async function startWorkflowVerify(options: StartVerifyOptions): Promise<VerifyStart> {
  const body: Record<string, unknown> = {};
  if (options.skillId) body.skill_id = options.skillId;
  if (options.workflow) body.workflow = options.workflow;
  if (options.targetUrl) body.target_url = options.targetUrl;
  return requestJson<VerifyStart>("/v1/browser-skills/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getVerifyResult(verifyId: string): Promise<VerifyResult> {
  return requestJson<VerifyResult>(`/v1/browser-skills/verify/${encodeURIComponent(verifyId)}`);
}

export async function checkVerifyReceipt(verifyId: string): Promise<ReceiptCheck> {
  return requestJson<ReceiptCheck>(
    `/v1/browser-skills/verify/${encodeURIComponent(verifyId)}/receipt/check`,
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
  } = {},
): Promise<VerifyResult> {
  const intervalMs = options.intervalMs ?? 2000;
  const maxPolls = options.maxPolls ?? 90;
  let last = await getVerifyResult(verifyId);
  options.onUpdate?.(last);

  for (let i = 0; i < maxPolls; i += 1) {
    if (isTerminalVerifyStatus(last.status)) return last;
    if (options.signal?.aborted) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    if (options.signal?.aborted) return last;
    last = await getVerifyResult(verifyId);
    options.onUpdate?.(last);
  }
  return last;
}
