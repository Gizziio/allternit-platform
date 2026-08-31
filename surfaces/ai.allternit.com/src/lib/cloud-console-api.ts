/**
 * Cloud Console API client
 *
 * Typed wrappers around the Allternit Cloud customer control plane:
 * Fabric resources, credits, resource classes, and Private Fabric node
 * enrollment.
 */

import { api, type AllternitApiError } from '@/integration/api-client';

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

export async function getCreditBalance(): Promise<CreditBalance> {
  return api.get<CreditBalance>('/api/v1/credits/balance');
}

export async function listCreditTransactions(): Promise<CreditTransaction[]> {
  const result = await api.get<CreditTransactionsResponse>('/api/v1/credits/transactions');
  return result.transactions ?? [];
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
  const result = await api.get<EnrollmentTokenListResponse>(
    '/api/v1/admin/fabric/nodes/enrollment-tokens',
  );
  return result.tokens ?? [];
}

// ============================================================================
// Private Fabric — nodes
// ============================================================================

export async function listFabricNodes(): Promise<FabricNode[]> {
  const result = await api.get<FabricNodeListResponse>('/api/v1/admin/fabric/nodes');
  return result.nodes ?? [];
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
