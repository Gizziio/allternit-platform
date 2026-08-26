/**
 * Desktop Cloud API client
 *
 * Typed wrappers around the Allternit Desktop-as-a-Service control plane.
 * Uses the canonical API singleton so auth, gateway URL resolution, and
 * error handling are consistent with the rest of the platform.
 */

import { api, type AllternitApiError } from '@/integration/api-client';
import type { Agent } from '@/lib/agents/agent.types';

// ============================================================================
// Types
// ============================================================================

export interface DesktopTemplate {
  id: string;
  org_id?: string | null;
  user_id: string;
  name: string;
  description?: string | null;
  os: string;
  image: string;
  cpu_millis: number;
  memory_mib: number;
  disk_mib: number;
  network_enabled: boolean;
  env: Record<string, string>;
  packages: string[];
  tags: string[];
  public: boolean;
}

export interface CapacitySnapshot {
  provider: string;
  host: string;
  healthy: boolean;
  active_executions: number;
  total_cpu_millis: number;
  total_memory_mib: number;
  available_cpu_millis: number;
  available_memory_mib: number;
  scaled_at: string;
}

export interface CapacityStatus {
  snapshots: CapacitySnapshot[];
  scale_up_recommended: boolean;
  scale_up_reason?: string | null;
}

export interface UsageRow {
  bot_id: string;
  sandbox_id: string;
  provider: string;
  started_at: string;
  ended_at?: string | null;
  minutes?: number | null;
  cost: number;
  currency: string;
}

export interface UsageSummary {
  total_minutes: number;
  total_cost: number;
  currency: string;
  rows: number;
}

export interface DesktopSandboxSummary {
  bot_id: string;
  sandbox_id: string;
  provider: string;
  host?: string | null;
  status: string;
  os: string;
}

export interface ProvisionDesktopResponse {
  sandbox_id: string;
  status: string;
  provider: string;
  host?: string | null;
}

export interface LifecycleDesktopResponse {
  sandbox_id: string;
  status: string;
}

export type DesktopCloudApiError = AllternitApiError;

// ============================================================================
// Agents / bots
// ============================================================================

export async function listAgents(): Promise<Agent[]> {
  const result = await api.get<{ agents: Agent[] }>('/api/v1/agents');
  return result.agents ?? [];
}

// ============================================================================
// Templates
// ============================================================================

export async function listTemplates(filters?: { os?: string; tag?: string }): Promise<DesktopTemplate[]> {
  const params = new URLSearchParams();
  if (filters?.os) params.set('os', filters.os);
  if (filters?.tag) params.set('tag', filters.tag);
  const query = params.toString();
  const result = await api.get<{ templates: DesktopTemplate[] }>(`/api/v1/desktop-templates${query ? `?${query}` : ''}`);
  return result.templates ?? [];
}

// ============================================================================
// Capacity
// ============================================================================

export async function getCapacity(): Promise<CapacityStatus> {
  return api.get<CapacityStatus>('/api/v1/desktop-capacity');
}

// ============================================================================
// Usage
// ============================================================================

export async function getUsageSummary(range?: { start?: string; end?: string }): Promise<UsageSummary> {
  const params = new URLSearchParams();
  if (range?.start) params.set('start', range.start);
  if (range?.end) params.set('end', range.end);
  const query = params.toString();
  return api.get<UsageSummary>(`/api/v1/desktop-usage/summary${query ? `?${query}` : ''}`);
}

export async function listUsage(range?: { start?: string; end?: string }): Promise<UsageRow[]> {
  const params = new URLSearchParams();
  if (range?.start) params.set('start', range.start);
  if (range?.end) params.set('end', range.end);
  const query = params.toString();
  const result = await api.get<{ usage: UsageRow[] }>(`/api/v1/desktop-usage${query ? `?${query}` : ''}`);
  return result.usage ?? [];
}

// ============================================================================
// Global sandboxes
// ============================================================================

export async function listSandboxes(): Promise<DesktopSandboxSummary[]> {
  const result = await api.get<{ sandboxes: DesktopSandboxSummary[] }>('/api/v1/desktop-sandboxes');
  return result.sandboxes ?? [];
}

// ============================================================================
// Bot desktop lifecycle
// ============================================================================

export async function provisionDesktop(
  botId: string,
  templateId?: string
): Promise<ProvisionDesktopResponse> {
  const params = new URLSearchParams();
  if (templateId) params.set('template_id', templateId);
  const query = params.toString();
  return api.post<ProvisionDesktopResponse>(
    `/api/v1/bots/${encodeURIComponent(botId)}/desktop/provision${query ? `?${query}` : ''}`
  );
}

export async function startDesktop(botId: string): Promise<LifecycleDesktopResponse> {
  return api.post<LifecycleDesktopResponse>(`/api/v1/bots/${encodeURIComponent(botId)}/desktop/start`);
}

export async function stopDesktop(botId: string): Promise<LifecycleDesktopResponse> {
  return api.post<LifecycleDesktopResponse>(`/api/v1/bots/${encodeURIComponent(botId)}/desktop/stop`);
}

export async function deprovisionDesktop(botId: string): Promise<LifecycleDesktopResponse | void> {
  return api.post<LifecycleDesktopResponse>(`/api/v1/bots/${encodeURIComponent(botId)}/desktop/deprovision`);
}
