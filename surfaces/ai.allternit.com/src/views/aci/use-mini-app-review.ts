/**
 * Data layer for the internal miniapp review console. React-free so it can
 * be exercised with plain node against the registry admin API.
 *
 * All admin endpoints require `Authorization: Bearer <admin token>`. The
 * reviewer token and actor name are cached in localStorage so the reviewer
 * only types them once per browser profile.
 */

/** Storage keys shared with the review console gate screen. */
export const REVIEW_TOKEN_STORAGE_KEY = "allternit.miniapp-review.admin-token";
export const REVIEW_ACTOR_STORAGE_KEY = "allternit.miniapp-review.actor";

/**
 * Resolve the Allternit miniapp registry base URL. Extracted from
 * `use-mini-app-catalog.ts` so the public catalog and the review console
 * agree on the same registry; returns null when none is configured.
 */
export function resolveRegistryBase(): string | null {
  if (typeof window === "undefined") return null;
  const configured = (window as unknown as Record<string, unknown>)
    .__ALLTERNIT_MINIAPP_REGISTRY_URL__;
  return typeof configured === "string" && configured.trim()
    ? configured.replace(/\/$/, "")
    : null;
}

// ─── Token / actor storage ──────────────────────────────────────────────────

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // localStorage can throw in private mode; treat as unavailable.
    return null;
  }
}

export function loadReviewToken(): string | null {
  return storage()?.getItem(REVIEW_TOKEN_STORAGE_KEY) ?? null;
}

export function saveReviewToken(token: string): void {
  storage()?.setItem(REVIEW_TOKEN_STORAGE_KEY, token);
}

export function clearReviewToken(): void {
  storage()?.removeItem(REVIEW_TOKEN_STORAGE_KEY);
}

export function loadReviewActor(): string | null {
  return storage()?.getItem(REVIEW_ACTOR_STORAGE_KEY) ?? null;
}

export function saveReviewActor(actor: string): void {
  storage()?.setItem(REVIEW_ACTOR_STORAGE_KEY, actor);
}

// ─── Contract types ─────────────────────────────────────────────────────────

export interface ReviewQueueItem {
  versionId: number;
  miniappId: string;
  name: string;
  publisherId: string;
  version: string;
  /** RFC3339 timestamp. */
  submittedAt: string;
  signed: boolean;
  intakeStatus: string | null;
  scanFailures: number;
  scanWarnings: number;
}

export interface ReviewQueuePage {
  items: ReviewQueueItem[];
  nextCursor?: string;
}

export interface ReviewVersionInfo {
  version: string;
  status: string;
  manifest: unknown;
  signature: string | null;
  publisherKey: string | null;
  publisherKeyFingerprint: string | null;
  /** Unix seconds. */
  submittedAt: number;
  changelog: string | null;
}

export interface ReviewIntakeJob {
  id: string;
  miniappId: string;
  versionId: number;
  status: string;
  claimedBy: string | null;
  /** RFC3339 timestamp. */
  claimedAt: string | null;
  attempts: number;
  lastError: string | null;
  /** RFC3339 timestamp. */
  createdAt: string;
  /** RFC3339 timestamp. */
  updatedAt: string;
}

export interface ReviewScanReport {
  id: string;
  miniappId: string;
  versionId: number | null;
  stage: string | null;
  scanner: string;
  status: "pass" | "warn" | "fail";
  summary: unknown;
  storageKey: string | null;
  /** RFC3339 timestamp. */
  createdAt: string;
  downloadUrl?: string;
}

export interface ReviewAsset {
  id: number;
  kind: string;
  sha256: string;
  sizeBytes: number;
  mime: string;
  quarantined: boolean;
  downloadUrl?: string;
  /** Unix seconds. */
  expiresAt?: number;
}

export interface ReviewAuditEntry {
  id: number;
  miniappId: string;
  versionId: number | null;
  actor: string;
  action: string;
  notes: string | null;
  /** RFC3339 timestamp. */
  createdAt: string;
}

export interface ReviewInstallEvent {
  id: number;
  miniappId: string;
  version: string;
  event: string;
  platform: string | null;
  clientVersion: string | null;
  /** RFC3339 timestamp. */
  createdAt: string;
}

export interface ReviewRating {
  average: number;
  count: number;
}

export interface ReviewDetail {
  miniappId: string;
  name: string;
  publisher: string;
  status: string;
  reviewNotes: string | null;
  /** Unix seconds. */
  reviewedAt: number | null;
  reviewedBy: string | null;
  candidate: ReviewVersionInfo;
  previousVerified: ReviewVersionInfo | null;
  intakeJob: ReviewIntakeJob | null;
  scanReports: ReviewScanReport[];
  assets: ReviewAsset[];
  reviews: ReviewAuditEntry[];
  installEvents: ReviewInstallEvent[];
  rating: ReviewRating;
  killSwitched: boolean;
}

export type ReviewAction =
  | "approve"
  | "reject"
  | "request_changes"
  | "revoke"
  | "quarantine";

export interface ReviewSubmission {
  status: ReviewAction;
  notes?: string;
  version?: string;
  actor?: string;
}

export interface KillSwitchRow {
  scope: string;
  enabled: boolean;
  reason: string | null;
  actor: string;
  /** RFC3339 timestamp. */
  createdAt: string;
  /** RFC3339 timestamp. */
  updatedAt: string;
}

export interface KillSwitchEvent {
  id: number;
  scope: string;
  enabled: boolean;
  reason: string | null;
  actor: string;
  /** RFC3339 timestamp. */
  createdAt: string;
}

export interface KillSwitchState {
  switches: KillSwitchRow[];
  events: KillSwitchEvent[];
}

export interface KillSwitchSubmission {
  scope: string;
  enabled: boolean;
  reason?: string;
  actor?: string;
}

// ─── HTTP plumbing ──────────────────────────────────────────────────────────

/** Error raised for any non-2xx registry response; carries the HTTP status. */
export class RegistryApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RegistryApiError";
    this.status = status;
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return "";
    try {
      const payload = JSON.parse(text) as {
        error?: unknown;
        message?: unknown;
      };
      const detail =
        typeof payload.error === "string"
          ? payload.error
          : typeof payload.message === "string"
            ? payload.message
            : text;
      return `: ${detail}`;
    } catch {
      return `: ${text}`;
    }
  } catch {
    return "";
  }
}

async function requestJson<T>(
  method: "GET" | "POST",
  url: string,
  token: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new RegistryApiError(0, `Registry unreachable: ${reason}`);
  }
  if (!response.ok) {
    const detail = await readErrorDetail(response);
    if (response.status === 401) {
      throw new RegistryApiError(
        401,
        `Unauthorized (401): the admin token was rejected${detail}`,
      );
    }
    throw new RegistryApiError(
      response.status,
      `Registry request failed (${response.status})${detail}`,
    );
  }
  return (await response.json()) as T;
}

// ─── Admin API ──────────────────────────────────────────────────────────────

/** FIFO review queue, oldest submissions first. */
export async function fetchReviewQueue(
  base: string,
  token: string,
  cursor?: string,
  limit = 25,
): Promise<ReviewQueuePage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return requestJson<ReviewQueuePage>(
    "GET",
    `${base}/v1/admin/review-queue?${params.toString()}`,
    token,
  );
}

/** Full reviewer dossier for one miniapp version. */
export async function fetchReviewDetail(
  base: string,
  token: string,
  id: string,
  version?: string,
): Promise<ReviewDetail> {
  const params = new URLSearchParams();
  if (version) params.set("version", version);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return requestJson<ReviewDetail>(
    "GET",
    `${base}/v1/admin/miniapps/${encodeURIComponent(id)}/review-detail${suffix}`,
    token,
  );
}

/** Submit a review verdict; resolves with the updated listing. */
export async function postReview(
  base: string,
  token: string,
  id: string,
  body: ReviewSubmission,
): Promise<unknown> {
  return requestJson<unknown>(
    "POST",
    `${base}/v1/miniapps/${encodeURIComponent(id)}/review`,
    token,
    body,
  );
}

/** Current kill switches plus the recent toggle event log. */
export async function fetchKillSwitches(
  base: string,
  token: string,
): Promise<KillSwitchState> {
  return requestJson<KillSwitchState>(
    "GET",
    `${base}/v1/admin/kill-switches`,
    token,
  );
}

/** Enable or disable a kill switch; resolves with the updated switch row. */
export async function postKillSwitch(
  base: string,
  token: string,
  body: KillSwitchSubmission,
): Promise<KillSwitchRow> {
  return requestJson<KillSwitchRow>(
    "POST",
    `${base}/v1/admin/kill-switches`,
    token,
    body,
  );
}
