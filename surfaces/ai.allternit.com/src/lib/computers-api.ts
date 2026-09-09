/**
 * Unified Computers API client.
 *
 * Typed lifecycle, desktop control, file transfer and snapshot endpoints.
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
  owner_type: 'user' | 'org' | 'bot';
  owner_id: string;
  bot_id?: string | null;
  session_id?: string | null;
  name: string;
  os?: string | null;
  cpu_cores?: number | null;
  memory_mb?: number | null;
  disk_mb?: number | null;
  /** Only returned at create; resolution is persisted through guest environment. */
  resolution?: string | null;
  region?: string | null;
  host?: string | null;
  native_id?: string | null;
  template_id?: string | null;
  billing_source: string;
  created_at: string;
  updated_at: string;
}

export interface CreateComputerInput {
  owner_type?: 'user' | 'org' | 'bot' | 'session';
  owner_id?: string;
  cpu_cores?: 2 | 4 | 8;
  memory_mb?: 4096 | 8192 | 16384 | 32768 | 65536;
  disk_mb?: 20480 | 40960 | 81920;
  resolution?: '1280x720' | '1920x1080' | '2560x1440';
  kind: ComputerKind;
  bot_id?: string;
  name?: string;
  os?: string;
  template_id?: string;
  session_id?: string;
  persistence?: 'ephemeral' | 'session' | 'persistent';
  /** Substrate hint: incus (Linux/Windows) or tart (macOS). */
  provider?: string;
}

export interface CreateComputerResponse {
  owner_type?: 'user' | 'org' | 'bot';
  owner_id?: string;
  cpu_cores?: number;
  memory_mb?: number;
  disk_mb?: number;
  /** Guest environment setting; echoed at create, not persisted in the row. */
  resolution?: string | null;
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
  await computerRaw(computerPath(id, 'delete'), { method: 'POST' });
}

export async function getDesktopUsageSummary(): Promise<DesktopUsageSummary> {
  return api.get<DesktopUsageSummary>('/api/v1/desktop-usage/summary');
}

export type ComputerMouseInput =
  | { action: 'move' | 'click' | 'rightclick' | 'doubleclick' | 'mousedown' | 'mouseup'; x?: number; y?: number; button?: 'left' | 'middle' | 'right' }
  | { action: 'drag'; x: number; y: number; end_x: number; end_y: number }
  | { action: 'scroll'; button?: 'up' | 'down'; amount?: number };

export type ComputerKeyboardInput =
  | { action: 'type'; text: string }
  | { action: 'key'; key: string };

export interface ComputerShellInput {
  command: string[];
  env?: Record<string, string>;
  timeout?: number;
}

export interface ComputerShellResponse {
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
}

export interface ComputerSnapshot {
  id: string;
  created_at: string;
  stateful: boolean;
}

export interface ComputerSnapshotActionResponse {
  success: boolean;
  snapshot_id: string;
}

function computerPath(id: string, suffix: string, approvalId?: string, path?: string): string {
  const params = new URLSearchParams();
  if (approvalId) params.set('approval_id', approvalId);
  if (path !== undefined) params.set('path', path);
  const query = params.toString();
  return `/api/v1/computers/${encodeURIComponent(id)}/${suffix}${query ? `?${query}` : ''}`;
}

export async function restartComputer(id: string): Promise<ComputerLifecycleResponse> {
  return api.post<ComputerLifecycleResponse>(computerPath(id, 'restart'));
}

export async function screenshotComputer(id: string): Promise<Blob> {
  const response = await computerRaw(computerPath(id, 'screenshot'));
  return response.blob();
}

export async function sendComputerMouse(id: string, input: ComputerMouseInput, approvalId?: string): Promise<{ success: boolean }> {
  return api.post(computerPath(id, 'mouse', approvalId), input);
}

export async function sendComputerKeyboard(id: string, input: ComputerKeyboardInput, approvalId?: string): Promise<{ success: boolean }> {
  return api.post(computerPath(id, 'keyboard', approvalId), input);
}

export async function runComputerShell(id: string, input: ComputerShellInput, approvalId?: string): Promise<ComputerShellResponse> {
  return api.post(computerPath(id, 'shell', approvalId), input);
}

export async function uploadComputerFile(id: string, path: string, bytes: Blob | ArrayBuffer, approvalId?: string): Promise<{ success: boolean }> {
  const response = await computerRaw(computerPath(id, 'files/upload', approvalId, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
  return response.json();
}

export async function downloadComputerFile(id: string, path: string): Promise<Blob> {
  const response = await computerRaw(computerPath(id, 'files/download', undefined, path));
  return response.blob();
}

export async function listComputerSnapshots(id: string): Promise<ComputerSnapshot[]> {
  const response = await api.get<{ snapshots: ComputerSnapshot[] }>(computerPath(id, 'snapshots'));
  return response.snapshots;
}

export async function createComputerSnapshot(id: string, stateful = false): Promise<ComputerSnapshotActionResponse> {
  return api.post(computerPath(id, 'snapshots'), { stateful });
}

export async function restoreComputerSnapshot(id: string, snapshotId: string): Promise<ComputerSnapshotActionResponse> {
  return api.post(computerPath(id, `snapshots/${encodeURIComponent(snapshotId)}/restore`));
}

export async function deleteComputerSnapshot(id: string, snapshotId: string): Promise<ComputerSnapshotActionResponse> {
  return api.delete(computerPath(id, `snapshots/${encodeURIComponent(snapshotId)}`));
}

async function computerRaw(path: string, options?: RequestInit): Promise<Response> {
  const response = await api.raw(path, options);
  if (!response.ok) {
    throw new Error(`Computer API returned ${response.status}: ${await response.text()}`);
  }
  return response;
}
