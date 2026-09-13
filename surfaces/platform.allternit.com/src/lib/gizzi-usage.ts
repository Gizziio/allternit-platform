/**
 * Gizzi Code (Allternit CLI) usage analytics client.
 *
 * Shape confirmed against cmd/allternit-api/src/analytics_routes.rs
 * `gizzi_code_usage` (mounted at /api/v1/admin/analytics/gizzi-code/usage):
 *   - Query: organization_id (required, must match the active org),
 *     start/end (required, inclusive/exclusive — YYYY-MM-DD works, see the
 *     handler test), granularity (hour|day|week|month, default day).
 *   - Requires an active organization AND the org owner/admin role
 *     (`admin_org`, analytics_routes.rs:65-82) — otherwise 403.
 *   - Response: { items: GizziCodeBucketRow[] } where each row is one time
 *     bucket. There is intentionally NO per-member breakdown — the SQL
 *     groups by bucket only (analytics_routes.rs:765-786).
 *
 * Telemetry is opt-in and env-gated client-side: gizzi-code only reports
 * when GIZZI_TELEMETRY=1 (cmd/gizzi-code/src/runtime/services/telemetry/
 * gizziUsageTelemetry.ts:8,85), so an empty items list is the expected
 * state for most orgs — pages must render an honest empty state, not zeros.
 */

import { api } from "@/lib/api-client";

export interface GizziCodeBucketRow {
  bucket: string;
  events: number;
  unique_users: number;
  unique_sessions: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_microdollars: number;
  tool_calls_accepted: number;
  tool_calls_rejected: number;
  lines_accepted: number;
}

export interface GizziCodeUsageResponse {
  items: GizziCodeBucketRow[];
}

export type GizziCodeGranularity = "day" | "week" | "month";

export async function getGizziCodeUsage(params: {
  organizationId: string;
  start: string;
  end: string;
  granularity?: GizziCodeGranularity;
}): Promise<GizziCodeUsageResponse> {
  const search = new URLSearchParams({
    organization_id: params.organizationId,
    start: params.start,
    end: params.end,
  });
  if (params.granularity) search.set("granularity", params.granularity);
  return api.get<GizziCodeUsageResponse>(
    `/api/v1/admin/analytics/gizzi-code/usage?${search.toString()}`
  );
}

/** YYYY-MM-DD for `daysAgo` before today (UTC). */
export function gizziDateDaysAgo(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/** Tomorrow, YYYY-MM-DD — matches the handler's exclusive `end`. */
export function gizziTomorrow(): string {
  return gizziDateDaysAgo(-1);
}
