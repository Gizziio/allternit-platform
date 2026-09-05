/**
 * Cloud Console API client
 *
 * Typed wrappers around the Allternit Cloud customer control plane:
 * Fabric resources, credits, resource classes, and Private Fabric node
 * enrollment.
 */

import { api, type AllternitApiError } from '@/integration/api-client';
import { allternitCloudOrigin, cloudApiFetch } from '@/lib/cloud-api';
import { buildAuthHeaders } from '@/lib/agents/api-config';
import { getProviderMeta } from '@/lib/providers/provider-registry';

// ============================================================================
// Types
// ============================================================================

export type CloudConsoleApiError = AllternitApiError;

export interface ResourceClass {
  id: string;
  kind: string;
  class: string;
  display_name: string;
  vcpu: number;
  memory_mib: number;
  gpu_vram_mib: number;
  reliability_tier: string;
  retail_price_per_hour_cents: number;
}

export interface FabricResourcePlacement {
  id: string;
  provider_kind: string;
  provider_resource_id: string | null;
  region: string | null;
  retail_price_per_hour_cents: number;
  provider_cost_per_hour_cents: number;
  started_at: string;
  ended_at: string | null;
}

export interface FabricResource {
  id: string;
  organization_id: string;
  kind: string;
  class: string;
  display_name: string | null;
  status: string;
  provider_kind: string | null;
  provider_resource_id: string | null;
  region: string | null;
  requested_at: string;
  provisioned_at: string | null;
  terminated_at: string | null;
  placement?: FabricResourcePlacement | null;
}

export interface CreateResourceRequest {
  class: string;
  kind?: string;
  display_name?: string;
}

export interface CreateResourceResponse {
  resource_id: string;
  provider_kind: string;
  provider_resource_id: string | null;
  region: string | null;
  instance_type: string | null;
  ipv4: string | null;
  endpoint: string | null;
  status: string;
}

export interface CreditBalance {
  organization_id: string;
  balance_cents: number;
  currency: string;
  plan?: string;
  planLabel?: string;
  monthToDateUsageUsd?: number;
}

export interface CreditTransaction {
  id: string;
  organization_id: string;
  transaction_type: string;
  amount_cents: number;
  currency: string;
  reference_id: string | null;
  idempotency_key: string | null;
  created_at: string;
}

export interface CreditTransactionsResponse {
  transactions: CreditTransaction[];
}

export interface EnrollmentToken {
  id: string;
  organization_id: string;
  display_name: string | null;
  status: string;
  token?: string;
  node_id: string | null;
  created_at: string;
  used_at: string | null;
}

export interface EnrollmentTokenListResponse {
  tokens: EnrollmentToken[];
}

export interface FabricNode {
  id: string;
  organization_id: string;
  display_name: string | null;
  status: string;
  region: string | null;
  labels: Record<string, string>;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  last_heartbeat_at: string | null;
}

export interface FabricNodeListResponse {
  nodes: FabricNode[];
}

// ============================================================================
// Resource classes
// ============================================================================

export async function listResourceClasses(): Promise<ResourceClass[]> {
  const result = await api.get<{ classes: ResourceClass[] }>('/api/v1/fabric/resource-classes');
  return result.classes ?? [];
}

// ============================================================================
// Resources
// ============================================================================

export async function createResource(
  request: CreateResourceRequest,
): Promise<CreateResourceResponse> {
  return api.post<CreateResourceResponse>('/api/v1/fabric/resources', request);
}

export async function getResource(id: string): Promise<FabricResource> {
  return api.get<FabricResource>(`/api/v1/fabric/resources/${encodeURIComponent(id)}`);
}

export async function terminateResource(id: string): Promise<{ id: string; status: string }> {
  return api.post<{ id: string; status: string }>(
    `/api/v1/fabric/resources/${encodeURIComponent(id)}/terminate`,
  );
}

// ============================================================================
// Credits
// ============================================================================

interface MeUsagePayload {
  plan?: string;
  label?: string;
  credits?: number | null;
  monthToDateUsageUsd?: number | null;
  recentTransactions?: Array<{
    amount_usd?: number;
    amountUsd?: number;
    source?: string;
    created_at?: string;
    createdAt?: string;
  }>;
}

export type BillingSubscription = {
  plan_id: string;
  label: string;
  plan_tier: string;
  status: string;
};

export async function getBillingSubscription(): Promise<BillingSubscription | null> {
  try {
    const headers = (await buildAuthHeaders()) ?? {};
    const res = await fetch(`${allternitCloudOrigin()}/api/v1/billing/subscription`, { headers });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<BillingSubscription>;
    if (!json.plan_id) return null;
    return {
      plan_id: json.plan_id,
      label: json.label || json.plan_id,
      plan_tier: json.plan_tier || 'free',
      status: json.status || 'none',
    };
  } catch {
    return null;
  }
}

export async function getCreditBalance(): Promise<CreditBalance> {
  const usage = await api.get<MeUsagePayload>('/api/v1/me/usage');
  const credits = typeof usage.credits === 'number' ? usage.credits : 0;
  return {
    organization_id: usage.plan || 'allternit',
    balance_cents: Math.round(credits * 100),
    currency: 'USD',
    plan: usage.plan,
    planLabel: usage.label,
    monthToDateUsageUsd: typeof usage.monthToDateUsageUsd === 'number' ? usage.monthToDateUsageUsd : undefined,
  };
}

export async function listCreditTransactions(): Promise<CreditTransaction[]> {
  const usage = await api.get<MeUsagePayload>('/api/v1/me/usage');
  return (usage.recentTransactions ?? []).map((row, index) => {
    const amount = row.amountUsd ?? row.amount_usd ?? 0;
    return {
      id: `${row.source || 'txn'}-${index}`,
      organization_id: usage.plan || 'allternit',
      transaction_type: row.source || 'usage',
      amount_cents: Math.round(amount * 100),
      currency: 'USD',
      reference_id: row.source || null,
      idempotency_key: null,
      created_at: row.createdAt || row.created_at || new Date().toISOString(),
    };
  });
}

// ============================================================================
// Private Fabric — enrollment tokens
// ============================================================================

export async function createEnrollmentToken(
  displayName?: string,
): Promise<EnrollmentToken> {
  return api.post<EnrollmentToken>('/api/v1/admin/fabric/nodes/enrollment-token', {
    display_name: displayName,
  });
}

export async function listEnrollmentTokens(): Promise<EnrollmentToken[]> {
  try {
    const result = await api.get<EnrollmentTokenListResponse>(
      '/api/v1/admin/fabric/nodes/enrollment-tokens',
    );
    return result.tokens ?? [];
  } catch (err) {
    const status = (err as AllternitApiError)?.statusCode;
    if (status === 401 || status === 403 || status === 404) return [];
    throw err;
  }
}

// ============================================================================
// Private Fabric — nodes
// ============================================================================

export async function listFabricNodes(): Promise<FabricNode[]> {
  try {
    const result = await api.get<FabricNodeListResponse>('/api/v1/admin/fabric/nodes');
    return result.nodes ?? [];
  } catch (err) {
    const status = (err as AllternitApiError)?.statusCode;
    if (status === 401 || status === 403 || status === 404) return [];
    throw err;
  }
}

export async function approveFabricNode(id: string): Promise<{ id: string; status: string }> {
  return api.post<{ id: string; status: string }>(
    `/api/v1/admin/fabric/nodes/${encodeURIComponent(id)}/approve`,
  );
}

export async function rejectFabricNode(id: string): Promise<{ id: string; status: string }> {
  return api.post<{ id: string; status: string }>(
    `/api/v1/admin/fabric/nodes/${encodeURIComponent(id)}/reject`,
  );
}

// ============================================================================
// Cloud / local provider accounts
// ============================================================================
//
// Local kernel `/api/v1/providers/auth/status` is device-token-safe (operator
// data plane). Cloud BYOK keys live on api.allternit.com and require a Clerk
// session or scoped API token — a desktop device token 401s, which we surface
// as `cloud_auth_required` instead of hanging the shell. Pasting a key copies
// it onto this desktop via `/api/v1/onboarding/provider`.

export type CloudAccountSource = 'local' | 'cloud';

export interface CloudAccount {
  provider_id: string;
  name: string;
  source: CloudAccountSource;
  authenticated: boolean;
  status: string;
  masked?: string | null;
  model_count?: number;
  provider_type?: string;
}

export interface CloudInferenceKeysResult {
  keys: CloudAccount[];
  status: number;
  error: string | null;
}

interface ProviderAuthStatusPayload {
  providers?: Array<{
    provider_id: string;
    status: string;
    authenticated: boolean;
    details?: {
      provider_type?: string;
      api_key_set?: boolean;
      model_count?: number;
    };
  }>;
}

export async function listLocalCloudAccounts(): Promise<CloudAccount[]> {
  const result = await api.get<ProviderAuthStatusPayload>('/api/v1/providers/auth/status');
  return (result.providers ?? [])
    .filter((provider) => getProviderMeta(provider.provider_id).kind === 'api')
    .filter((provider) => provider.authenticated || Boolean(provider.details?.api_key_set))
    .map((provider) => ({
      provider_id: provider.provider_id,
      name: provider.provider_id,
      source: 'local',
      authenticated: Boolean(provider.authenticated),
      status: provider.status,
      model_count: provider.details?.model_count,
      provider_type: provider.details?.provider_type,
    }));
}

export async function listCloudInferenceKeys(): Promise<CloudInferenceKeysResult> {
  try {
    const response = await cloudApiFetch('/api/v1/inference/keys', { cache: 'no-store' });
    if (response.status === 401 || response.status === 403) {
      return { keys: [], status: response.status, error: 'cloud_auth_required' };
    }
    if (response.status === 503) {
      return { keys: [], status: 503, error: 'inference_keys_not_configured' };
    }
    if (!response.ok) {
      return { keys: [], status: response.status, error: `cloud_keys_unavailable_${response.status}` };
    }
    const payload = (await response.json().catch(() => [])) as
      | Array<{ provider_id: string; masked?: string; status?: string }>
      | { keys?: Array<{ provider_id: string; masked?: string; status?: string }> };
    const rows = Array.isArray(payload) ? payload : payload.keys ?? [];
    return {
      keys: rows.map((row) => ({
        provider_id: row.provider_id,
        name: row.provider_id,
        source: 'cloud',
        authenticated: (row.status ?? 'active') === 'active',
        status: row.status ?? 'active',
        masked: row.masked ?? null,
      })),
      status: 200,
      error: null,
    };
  } catch {
    return { keys: [], status: 0, error: 'cloud_keys_unreachable' };
  }
}

export async function saveLocalCloudAccount(
  providerId: string,
  apiKey: string,
): Promise<{ success: boolean; provider: string }> {
  return api.post<{ success: boolean; provider: string }>('/api/v1/onboarding/provider', {
    provider: providerId,
    name: providerId,
    apiKey,
    authType: 'api_key',
    setDefault: false,
  });
}

export async function saveCloudInferenceKey(providerId: string, apiKey: string): Promise<void> {
  const response = await cloudApiFetch('/api/v1/inference/keys', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider_id: providerId, api_key: apiKey }),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('cloud_auth_required');
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `Failed to save cloud key (${response.status})`);
  }
}
