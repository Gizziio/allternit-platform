/**
 * Agent Cloud API client.
 *
 * Typed wrappers around the Agent Cloud runtime endpoints:
 * - POST /api/v1/agents/:id/runtime/provision
 * - POST /api/v1/agents/:id/runtime/terminate
 */

import { api } from '@/integration/api-client';

// ============================================================================
// Types
// ============================================================================

export interface AgentRuntimeProvisionRequest {
  class?: string;
  display_name?: string;
}

export interface AgentRuntimeProvisionResponse {
  agent_id: string;
  resource_id: string;
  provider_kind: string;
  provider_resource_id: string | null;
  region: string | null;
  instance_type: string | null;
  ipv4: string | null;
  endpoint: string | null;
  status: string;
  runtime_status: string;
}

export interface AgentRuntimeTerminateResponse {
  agent_id: string;
  status: string;
}

// ============================================================================
// API calls
// ============================================================================

export async function provisionAgentRuntime(
  agentId: string,
  request: AgentRuntimeProvisionRequest = {},
): Promise<AgentRuntimeProvisionResponse> {
  return api.post<AgentRuntimeProvisionResponse>(
    `/api/v1/agents/${encodeURIComponent(agentId)}/runtime/provision`,
    request,
  );
}

export async function terminateAgentRuntime(
  agentId: string,
): Promise<AgentRuntimeTerminateResponse> {
  return api.post<AgentRuntimeTerminateResponse>(
    `/api/v1/agents/${encodeURIComponent(agentId)}/runtime/terminate`,
    {},
  );
}
