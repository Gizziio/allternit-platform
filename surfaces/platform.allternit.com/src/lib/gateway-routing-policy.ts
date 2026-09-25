/**
 * Provider routing policy + BYO route credentials client (gateway control plane).
 *
 * Endpoints (cmd/allternit-api/src/llm_gateway/admin_routes.rs):
 *   GET    /api/v1/gateway/provider-routing                    -> { tenant_id, policy, updated_at }
 *   PUT    /api/v1/gateway/provider-routing                    -> { tenant_id, policy } (validates before store)
 *   POST   /api/v1/gateway/provider-routing/resolve            -> ResolveAnswer (body: { model, provider? })
 *   GET    /api/v1/gateway/provider-routing/export/hermes      -> text/yaml Hermes config download
 *   GET    /api/v1/gateway/route-credentials                   -> { credentials } (masked fingerprints only)
 *   PUT    /api/v1/gateway/route-credentials                   -> { credentials } (validates when base_url is set)
 *   DELETE /api/v1/gateway/route-credentials/:provider_id      -> { deleted: provider_id }
 *
 * Policy shape (llm_gateway/provider_routing.rs): six flat keys
 * (sort/only/ignore/order/require_parameters/data_collection) plus a per-model
 * `models` override map. Unset keys fall through to the flat values at
 * resolution time. `only`/`ignore` must not overlap; slugs are lowercase
 * `[a-z0-9-_]`, 1-64 chars.
 *
 * Gating: provider-routing routes require org owner/admin when an
 * organization is active (403 otherwise); route-credentials are per-user and
 * available to any authenticated caller.
 */

import { api, AllternitApiError } from "@/lib/api-client";

export type ProviderRoutingSort = "price" | "throughput" | "latency";
export type DataCollection = "allow" | "deny";
export type PolicySource = "tenant" | "global" | "none";

/** Per-model override: same keys as the flat policy; unset fields fall through. */
export interface ModelRoutingOverride {
  sort?: ProviderRoutingSort;
  only: string[];
  ignore: string[];
  order: string[];
  require_parameters?: boolean;
  data_collection?: DataCollection;
}

/** Flat + per-model provider routing policy (one row per tenant). */
export interface ProviderRoutingPolicy {
  sort?: ProviderRoutingSort;
  only: string[];
  ignore: string[];
  order: string[];
  require_parameters?: boolean;
  data_collection?: DataCollection;
  /** Model id → override. Matching is spelling-tolerant (with/without provider prefixes). */
  models: Record<string, ModelRoutingOverride>;
}

export interface ProviderRoutingState {
  tenant_id: string | null;
  /** null when this tenant has no row (the platform-global row may still apply at resolve time). */
  policy: ProviderRoutingPolicy | null;
  updated_at: string | null;
}

export interface ResolveRoutingInput {
  /** Model name; a `provider/model` form splits into provider + model. */
  model: string;
  /** Optional explicit provider id. */
  provider?: string;
}

/** Answer to "which provider serves this model under current policy". */
export interface ResolveRoutingAnswer {
  /** The resolved wire `provider` object, or null when no policy applies. */
  provider: Record<string, unknown> | null;
  /** The exact `models` key that matched, if any. */
  matched_override: string | null;
  /** Which policy row supplied the answer: this tenant, the platform-global row, or none. */
  source: PolicySource;
}

/** What list responses carry — never the key itself. */
export interface RouteCredentialInfo {
  provider_id: string;
  base_url: string | null;
  label: string | null;
  /** `active` (validated against the provider) or `unvalidated` (stored without a probe). */
  status: string;
  /** Masked fingerprint, e.g. `sk-…4f9c`. */
  masked: string;
  last_validated_at: string | null;
}

export interface PutRouteCredentialInput {
  provider_id: string;
  api_key: string;
  /** When set, the key is probed against `{base_url}/models` before storing. */
  base_url?: string;
  label?: string;
}

export async function getProviderRouting(): Promise<ProviderRoutingState> {
  return api.get<ProviderRoutingState>("/api/v1/gateway/provider-routing");
}

export async function putProviderRouting(
  policy: ProviderRoutingPolicy
): Promise<ProviderRoutingState> {
  return api.put<ProviderRoutingState>("/api/v1/gateway/provider-routing", policy);
}

export async function resolveProviderRouting(
  input: ResolveRoutingInput
): Promise<ResolveRoutingAnswer> {
  return api.post<ResolveRoutingAnswer>("/api/v1/gateway/provider-routing/resolve", {
    model: input.model,
    ...(input.provider?.trim() ? { provider: input.provider.trim() } : {}),
  });
}

/** Download the effective policy as a Hermes-native `provider_routing` YAML section. */
export async function exportProviderRoutingHermes(): Promise<string> {
  const response = await api.raw("/api/v1/gateway/provider-routing/export/hermes");
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new AllternitApiError(
      errorData.error || errorData.message || `HTTP ${response.status}`,
      response.status,
      errorData.code,
      errorData.details
    );
  }
  return response.text();
}

export async function listRouteCredentials(): Promise<RouteCredentialInfo[]> {
  const data = await api.get<{ credentials: RouteCredentialInfo[] }>(
    "/api/v1/gateway/route-credentials"
  );
  return data.credentials ?? [];
}

export async function putRouteCredential(
  input: PutRouteCredentialInput
): Promise<RouteCredentialInfo[]> {
  const body: Record<string, unknown> = {
    provider_id: input.provider_id.trim(),
    api_key: input.api_key,
  };
  if (input.base_url?.trim()) body.base_url = input.base_url.trim();
  if (input.label?.trim()) body.label = input.label.trim();
  const data = await api.put<{ credentials: RouteCredentialInfo[] }>(
    "/api/v1/gateway/route-credentials",
    body
  );
  return data.credentials ?? [];
}

export async function deleteRouteCredential(providerId: string): Promise<void> {
  await api.delete(`/api/v1/gateway/route-credentials/${encodeURIComponent(providerId)}`);
}
