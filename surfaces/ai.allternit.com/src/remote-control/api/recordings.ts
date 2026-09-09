/**
 * Session Replay API — typed client for the computer-use gateway.
 *
 * Remote-control surface's own integration layer for the recordings /
 * replay / browser-skills surface of the ACU gateway
 * (default http://127.0.0.1:8760, see getPlatformComputerUseBaseUrl).
 *
 * Gateway contract (domains/computer-use, read-only for this surface):
 *   GET  /v1/computer-use/recordings            → { recordings: RecordingListItem[] }
 *   GET  /v1/computer-use/recordings/{id}       → detail { manifest, steps, gif_url? } (when present)
 *   GET  /v1/computer-use/recordings/{id}/file  → raw JSONL (fallback when no detail route)
 *   GET  /v1/computer-use/recordings/{id}/gif   → GIF bytes (when present)
 *   POST /v1/computer-use/replay                → { run_id, status } (deviation_threshold)
 *   GET  /v1/computer-use/runs/{run_id}         → run status (poll)
 *   POST /v1/computer-use/runs/{run_id}/approve → { decision: 'approve' | 'deny' }
 *   POST /v1/browser-skills/run                 → { run_id, status } ({ skill_id })
 *
 * Detail/file/gif routes are optional in the current gateway; every method
 * degrades gracefully and the UI reflects what is actually available.
 */

import { getPlatformComputerUseBaseUrl } from "@/integration/computer-use-engine";

// ============================================================================
// Types
// ============================================================================

export interface RecordingListItem {
  recording_id: string;
  task: string;
  status: string;
  started_at: string;
  total_steps: number;
  path?: string;
}

export interface RecordingManifest {
  recording_id: string;
  task: string;
  session_id: string;
  run_id: string;
  started_at: string;
  completed_at?: string | null;
  total_steps: number;
  status: string;
  gif_path?: string | null;
}

export interface RecordedStep {
  step: number;
  timestamp: string;
  action_type: string;
  action_target: string;
  action_params: Record<string, unknown>;
  reasoning: string;
  action_succeeded: boolean;
  risk_level: string;
}

export interface RecordingDetail {
  manifest: RecordingManifest;
  steps: RecordedStep[];
  /** Browser-usable object URL when the gateway serves the GIF, else null. */
  gifUrl: string | null;
}

export interface RunRef {
  run_id: string;
  status?: string;
}

export interface RunStatusView {
  run_id: string;
  status: string;
  summary?: string;
  completed: boolean;
}

// ============================================================================
// Errors
// ============================================================================

export class RecordingsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "RecordingsApiError";
  }
}

/** Raised when no gateway route can serve a recording's steps. */
export class RecordingDetailUnavailableError extends RecordingsApiError {
  constructor(recordingId: string) {
    super(
      `Recording ${recordingId} steps are not available — the gateway does not expose a recordings detail or file route yet.`,
      404,
    );
    this.name = "RecordingDetailUnavailableError";
  }
}

/** Raised by runCompiledWorkflow when the skill has not been compiled yet. */
export class WorkflowNotCompiledError extends RecordingsApiError {
  constructor(skillId: string) {
    super(
      `No compiled workflow found for "${skillId}". Compile this recording first (POST /v1/browser-skills/from-recording), then run it as a workflow.`,
      404,
    );
    this.name = "WorkflowNotCompiledError";
  }
}

// ============================================================================
// Transport
// ============================================================================

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
    throw new RecordingsApiError(await readErrorMessage(response), response.status);
  }
  return (await response.json()) as T;
}

// ============================================================================
// JSONL parsing (recording files are newline-delimited JSON: manifest + frames)
// ============================================================================

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function parseRecordingJsonl(text: string): RecordingDetail {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new RecordingsApiError("Recording file is empty", 0);
  }
  const manifestData = asRecord(JSON.parse(lines[0]));
  const manifest: RecordingManifest = {
    recording_id: asString(manifestData.recording_id),
    task: asString(manifestData.task),
    session_id: asString(manifestData.session_id),
    run_id: asString(manifestData.run_id),
    started_at: asString(manifestData.started_at),
    completed_at: typeof manifestData.completed_at === "string" ? manifestData.completed_at : null,
    total_steps: typeof manifestData.total_steps === "number" ? manifestData.total_steps : 0,
    status: asString(manifestData.status, "unknown"),
    gif_path: typeof manifestData.gif_path === "string" ? manifestData.gif_path : null,
  };
  const steps: RecordedStep[] = lines.slice(1).map((line, index) => {
    const data = asRecord(JSON.parse(line));
    return {
      step: typeof data.step === "number" ? data.step : index + 1,
      timestamp: asString(data.timestamp),
      action_type: asString(data.action_type),
      action_target: asString(data.action_target),
      action_params: asRecord(data.action_params),
      reasoning: asString(data.reasoning),
      action_succeeded: data.action_succeeded !== false,
      risk_level: asString(data.risk_level, "low"),
    };
  });
  return { manifest, steps, gifUrl: null };
}

// ============================================================================
// Recordings API
// ============================================================================

export async function listRecordings(): Promise<RecordingListItem[]> {
  const body = await requestJson<{ recordings?: RecordingListItem[] }>(
    "/v1/computer-use/recordings",
  );
  return Array.isArray(body.recordings) ? body.recordings : [];
}

async function fetchRecordingGif(recordingId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${gatewayBase()}/v1/computer-use/recordings/${encodeURIComponent(recordingId)}/gif`,
    );
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function normalizeDetailPayload(
  recordingId: string,
  body: Record<string, unknown>,
): RecordingDetail {
  const manifestData = asRecord(body.manifest ?? body);
  const manifest: RecordingManifest = {
    recording_id: asString(manifestData.recording_id, recordingId),
    task: asString(manifestData.task),
    session_id: asString(manifestData.session_id),
    run_id: asString(manifestData.run_id),
    started_at: asString(manifestData.started_at),
    completed_at: typeof manifestData.completed_at === "string" ? manifestData.completed_at : null,
    total_steps: typeof manifestData.total_steps === "number" ? manifestData.total_steps : 0,
    status: asString(manifestData.status, "unknown"),
    gif_path: typeof manifestData.gif_path === "string" ? manifestData.gif_path : null,
  };
  const rawSteps = Array.isArray(body.steps) ? body.steps : Array.isArray(body.frames) ? body.frames : [];
  const steps: RecordedStep[] = rawSteps.map((raw, index) => {
    const data = asRecord(raw);
    return {
      step: typeof data.step === "number" ? data.step : index + 1,
      timestamp: asString(data.timestamp),
      action_type: asString(data.action_type),
      action_target: asString(data.action_target),
      action_params: asRecord(data.action_params),
      reasoning: asString(data.reasoning),
      action_succeeded: data.action_succeeded !== false,
      risk_level: asString(data.risk_level, "low"),
    };
  });
  const gifUrl = typeof body.gif_url === "string" && body.gif_url ? body.gif_url : null;
  return { manifest, steps, gifUrl };
}

/**
 * Load a recording's steps. Prefers the detail endpoint; falls back to the
 * raw JSONL file route; throws RecordingDetailUnavailableError when neither
 * exists on the gateway.
 */
export async function getRecordingDetail(recordingId: string): Promise<RecordingDetail> {
  const encoded = encodeURIComponent(recordingId);

  let detailResponse: Response | null = null;
  try {
    detailResponse = await fetch(`${gatewayBase()}/v1/computer-use/recordings/${encoded}`);
  } catch {
    detailResponse = null;
  }
  if (detailResponse && detailResponse.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = asRecord(await detailResponse.json());
    } catch {
      body = {};
    }
    const detail = normalizeDetailPayload(recordingId, body);
    detail.gifUrl = detail.gifUrl ?? (await fetchRecordingGif(recordingId));
    return detail;
  }

  try {
    const fileResponse = await fetch(`${gatewayBase()}/v1/computer-use/recordings/${encoded}/file`);
    if (fileResponse.ok) {
      const detail = parseRecordingJsonl(await fileResponse.text());
      detail.gifUrl = await fetchRecordingGif(recordingId);
      return detail;
    }
  } catch {
    // fall through to unavailable
  }

  throw new RecordingDetailUnavailableError(recordingId);
}

// ============================================================================
// Replay / workflow / run-control API
// ============================================================================

export async function replayRecording(
  recordingId: string,
  deviationThreshold: number,
): Promise<RunRef> {
  return requestJson<RunRef>("/v1/computer-use/replay", {
    method: "POST",
    body: JSON.stringify({
      recording_id: recordingId,
      deviation_threshold: deviationThreshold,
    }),
  });
}

export async function runCompiledWorkflow(skillId: string): Promise<RunRef> {
  try {
    return await requestJson<RunRef>("/v1/browser-skills/run", {
      method: "POST",
      body: JSON.stringify({ skill_id: skillId }),
    });
  } catch (error) {
    if (error instanceof RecordingsApiError && error.status === 404) {
      throw new WorkflowNotCompiledError(skillId);
    }
    throw error;
  }
}

export async function getRunStatus(runId: string): Promise<RunStatusView> {
  const body = await requestJson<Record<string, unknown>>(
    `/v1/computer-use/runs/${encodeURIComponent(runId)}`,
  );
  return {
    run_id: asString(body.run_id, runId),
    status: asString(body.status, "unknown"),
    summary: typeof body.summary === "string" ? body.summary : undefined,
    completed: body.completed === true,
  };
}

export type ApprovalDecision = "approve" | "deny";

export async function resolveRunApproval(
  runId: string,
  decision: ApprovalDecision,
  comment?: string,
): Promise<RunRef> {
  return requestJson<RunRef>(`/v1/computer-use/runs/${encodeURIComponent(runId)}/approve`, {
    method: "POST",
    body: JSON.stringify({ decision, ...(comment ? { comment } : {}) }),
  });
}

// ============================================================================
// Polling
// ============================================================================

export const TERMINAL_RUN_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "abandoned",
  "error",
]);

export function isTerminalRunStatus(status: string): boolean {
  return TERMINAL_RUN_STATUSES.has(status) || status.startsWith("complet");
}

/**
 * Poll a run until it reaches a terminal status. Invokes onUpdate with each
 * poll result. Stops when isTerminalRunStatus(status) or completed is true.
 * Returns the last observed status.
 */
export async function pollRunUntilTerminal(
  runId: string,
  options: {
    intervalMs?: number;
    signal?: AbortSignal;
    onUpdate?: (status: RunStatusView) => void;
  } = {},
): Promise<RunStatusView> {
  const intervalMs = options.intervalMs ?? 2000;
  let last = await getRunStatus(runId);
  options.onUpdate?.(last);

  while (!last.completed && !isTerminalRunStatus(last.status)) {
    if (options.signal?.aborted) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    if (options.signal?.aborted) break;
    last = await getRunStatus(runId);
    options.onUpdate?.(last);
  }

  return last;
}
