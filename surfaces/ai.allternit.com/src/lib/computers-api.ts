/**
 * Unified Computers API client.
 *
 * Thin typed wrapper around `/api/v1/computers`. Phase 1 covers the unified
 * list/create/start/stop/delete surface; later phases add screenshot/mouse/
 * keyboard/shell/file/console tools.
 */

import { api } from '@/integration/api-client';

export type ComputerKind =
  | 'local'
  | 'byo_vps'
  | 'managed'
  | 'byoc'
  | 'cloud_desktop';

export type ComputerStatus =
  | 'creating'
  | 'running'
  | 'stopped'
  | 'error'
  | 'deleted';

export interface Computer {
  id: string;
  kind: ComputerKind;
  provider: string;
  status: ComputerStatus;
  owner_type: string;
  owner_id: string;
  bot_id?: string | null;
  session_id?: string | null;
  name: string;
  os?: string | null;
  cpu_cores?: number | null;
  memory_mb?: number | null;
  disk_mb?: number | null;
  region?: string | null;
  host?: string | null;
  native_id?: string | null;
  template_id?: string | null;
  billing_source: string;
  created_at: string;
  updated_at: string;
}

export interface CreateComputerInput {
  kind: ComputerKind;
  bot_id?: string;
  name?: string;
  os?: string;
  template_id?: string;
  session_id?: string;
  persistence?: 'ephemeral' | 'session' | 'persistent';
}

export interface CreateComputerResponse {
  id: string;
  sandbox_id?: string;
  status: string;
  provider?: string;
  host?: string | null;
  persistence?: 'ephemeral' | 'session' | 'persistent';
}

export interface ComputerLifecycleResponse {
  id: string;
  status: string;
  sandbox_id?: string;
}

export interface ListComputersResponse {
  computers: Computer[];
}

export interface DesktopUsageSummary {
  total_minutes: number;
  total_cost: number;
  currency: string;
  rows: number;
}

export async function listComputers(filters?: {
  bot_id?: string;
  kind?: ComputerKind;
}): Promise<Computer[]> {
  const params = new URLSearchParams();
  if (filters?.bot_id) params.set('bot_id', filters.bot_id);
  if (filters?.kind) params.set('kind', filters.kind);
  const query = params.toString();
  const result = await api.get<ListComputersResponse>(
    `/api/v1/computers${query ? `?${query}` : ''}`,
  );
  return result.computers ?? [];
}

export async function getComputer(id: string): Promise<Computer> {
  return api.get<Computer>(`/api/v1/computers/${id}`);
}

export async function createComputer(
  input: CreateComputerInput,
): Promise<CreateComputerResponse> {
  return api.post<CreateComputerResponse>('/api/v1/computers', input);
}

export async function startComputer(id: string): Promise<ComputerLifecycleResponse> {
  return api.post<ComputerLifecycleResponse>(`/api/v1/computers/${id}/start`);
}

export async function stopComputer(id: string): Promise<ComputerLifecycleResponse> {
  return api.post<ComputerLifecycleResponse>(`/api/v1/computers/${id}/stop`);
}

export async function deleteComputer(id: string): Promise<void> {
  await api.post<void>(`/api/v1/computers/${id}/delete`);
}

export async function getDesktopUsageSummary(): Promise<DesktopUsageSummary> {
  return api.get<DesktopUsageSummary>('/api/v1/desktop-usage/summary');
}
