/**
 * LLM gateway analytics data access — the `/api/v1/gateway/*` admin routes
 * and the tag/key pickers the Analytics console pages filter by.
 *
 * All shapes confirmed against the Rust handlers:
 * - GET  /api/v1/gateway/usage    — llm_gateway/admin_routes.rs `get_usage`
 * - GET  /api/v1/gateway/logs     — llm_gateway/admin_routes.rs `get_logs`
 * - GET  /api/v1/gateway/caching  — llm_gateway/admin_routes.rs `get_caching`
 * - GET  /api/v1/gateway/keys     — llm_gateway/keys.rs `list_keys`
 * - GET  /api/v1/tags             — tag_routes.rs `list_tags`
 * - GET+PUT /api/v1/admin/rate-limits — admin_rate_limit_routes.rs
 */

import { api } from "@/lib/api-client";

// ─── GET /api/v1/gateway/usage ────────────────────────────────────────────────

export interface UsageDayRow {
  day: string;
  provider_id: string;
  model_id: string;
  virtual_key_id: string;
  key_prefix: string | null;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  spend_microdollars: number;
  cost_mismatches: number;
}

export interface UsageTagRow {
  tag_key: string;
  tag_value: string;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  spend_microdollars: number;
  cost_mismatches: number;
}

export interface UsageTotals {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  spend_microdollars: number;
}

export interface UsageResponse {
  from: string;
  to: string;
  group_by: "day" | "tag";
  usage: Array<UsageDayRow | UsageTagRow>;
  totals: UsageTotals;
}

export async function getGatewayUsage(params: {
  from?: string;
  to?: string;
  groupBy?: "tag";
}): Promise<UsageResponse> {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.groupBy) search.set("group_by", params.groupBy);
  const query = search.toString();
  return api.get<UsageResponse>(
    `/api/v1/gateway/usage${query ? `?${query}` : ""}`
  );
}

// ─── GET /api/v1/gateway/logs ─────────────────────────────────────────────────

export interface GatewayLogRow {
  id: string;
  created_at: string;
  status: string;
  error_type: string | null;
  policy: string | null;
  provider_id: string | null;
  model_id: string | null;
  fallback_from: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  cost_microdollars: number;
  recomputed_cost_microdollars: number | null;
  cost_mismatch: boolean;
  latency_ms: number;
  ttft_ms: number | null;
  gizzi_session_id: string | null;
  key_prefix: string | null;
  tags: Record<string, string> | null;
  batch_id: string | null;
  context_cache_id: string | null;
}

export interface GatewayLogsResponse {
  logs: GatewayLogRow[];
  /** `created_at|id` of the last row; present when another page exists. */
  next_cursor: string | null;
}

export async function getGatewayLogs(params: {
  limit?: number;
  cursor?: string;
  status?: string;
  tag?: string;
}): Promise<GatewayLogsResponse> {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.status) search.set("status", params.status);
  if (params.tag) search.set("tag", params.tag);
  const query = search.toString();
  return api.get<GatewayLogsResponse>(
    `/api/v1/gateway/logs${query ? `?${query}` : ""}`
  );
}

// ─── GET /api/v1/gateway/caching ──────────────────────────────────────────────

export interface CachingByModelRow {
  provider_id: string;
  model_id: string;
  cached_tokens: number;
  /** Present only when the models.dev cache prices this model. */
  estimated_savings_microdollars: number | null;
}

export interface ContextCacheStats {
  id: string;
  name: string | null;
  hits: number;
  last_used_at: string | null;
  message_count: number;
  size_bytes: number;
  created_at: string;
  expires_at: string | null;
}

export interface PromptCacheStats {
  id: string;
  name: string | null;
  hits: number;
  last_used_at: number | null;
  tokens: number;
  created_at: number;
  expires_at: number;
}

export interface CachingResponse {
  period: string;
  totals: {
    requests: number;
    requests_with_context_cache: number;
    context_cache_hits: number;
    prompt_cache_hits: number;
    cached_tokens: number;
    estimated_savings_microdollars: number;
    savings_unpriced_models: number;
  };
  savings_estimate_basis: string;
  by_model: CachingByModelRow[];
  context_caches: ContextCacheStats[];
  prompt_caches: PromptCacheStats[];
}

export async function getGatewayCaching(period: string): Promise<CachingResponse> {
  return api.get<CachingResponse>(
    `/api/v1/gateway/caching?period=${encodeURIComponent(period)}`
  );
}

// ─── GET /api/v1/gateway/keys (picker) ───────────────────────────────────────

export interface GatewayKeyRef {
  id: string;
  key_prefix: string | null;
  name: string | null;
  revoked: boolean;
}

export async function listGatewayKeys(): Promise<GatewayKeyRef[]> {
  const data = await api.get<{ keys: GatewayKeyRef[] }>("/api/v1/gateway/keys");
  return data.keys ?? [];
}

// ─── GET /api/v1/tags (picker) ────────────────────────────────────────────────

export interface ResourceTag {
  id: string;
  resource_type: string;
  resource_id: string;
  key: string;
  value: string;
  created_at: string;
}

export async function listTags(): Promise<ResourceTag[]> {
  const data = await api.get<{ tags?: ResourceTag[] } | ResourceTag[]>(
    "/api/v1/tags"
  );
  return Array.isArray(data) ? data : data.tags ?? [];
}

// ─── GET+PUT /api/v1/admin/rate-limits ───────────────────────────────────────

export interface AdminRateLimits {
  org_id: string;
  /** null = inherit the platform default (600 RPM). */
  api_rate_limit_rpm: number | null;
  /** null = no org-level gateway cap. */
  gateway_rate_limit_rpm: number | null;
  defaults: {
    api_rate_limit_rpm: number | null;
    gateway_rate_limit_rpm: number | null;
  };
  semantics: {
    api_rate_limit_rpm: string;
    gateway_rate_limit_rpm: string;
  };
}

export async function getAdminRateLimits(): Promise<AdminRateLimits> {
  return api.get<AdminRateLimits>("/api/v1/admin/rate-limits");
}

export async function putAdminRateLimits(body: {
  api_rate_limit_rpm?: number | null;
  gateway_rate_limit_rpm?: number | null;
}): Promise<AdminRateLimits> {
  return api.put<AdminRateLimits>("/api/v1/admin/rate-limits", body);
}

// ─── Shared formatting / CSV helpers ─────────────────────────────────────────

export function microdollarsToUsd(microdollars: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(microdollars / 1_000_000);
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toLocaleString();
}

/** YYYY-MM-DD for `daysAgo` before today (UTC). */
export function dateDaysAgo(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return date.toISOString().slice(0, 10);
}

/** Tomorrow, YYYY-MM-DD — matches the usage handler's exclusive `to` default. */
export function tomorrowDate(): string {
  return dateDaysAgo(-1);
}

/** Client-side CSV download (Anthropic parity — export from the fetched rows). */
export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const escape = (value: string | number) => {
    const raw = String(value);
    return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
