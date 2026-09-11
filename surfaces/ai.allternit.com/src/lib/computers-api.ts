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
  owner_type: 'user' | 'org' | 'bot' | 'session';
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
  idle_timeout_secs?: number | null;
  last_activity_at?: string | null;
  group_id?: string | null;
  /** Camel-case alias populated by list/get/update. */
  groupId?: string | null;
  /** 'user' or 'golden' (template build holder; hidden unless include_roles=1). */
  role?: string;
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
  /** Curated `system/...` template ref; exactly one of template_id/template_ref. */
  template_ref?: string;
  session_id?: string;
  persistence?: 'ephemeral' | 'session' | 'persistent';
  /** Substrate hint: incus (Linux/Windows) or tart (macOS). */
  provider?: string;
}

export interface CreateComputerResponse {
  owner_type?: 'user' | 'org' | 'bot' | 'session';
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
  groupId?: string;
  group_id?: string;
  /** Include non-user roles (e.g. golden template-build holders). */
  include_roles?: boolean;
}): Promise<Computer[]> {
  const params = new URLSearchParams();
  if (filters?.bot_id) params.set('bot_id', filters.bot_id);
  if (filters?.kind) params.set('kind', filters.kind);
  const groupId = filters?.groupId ?? filters?.group_id;
  if (groupId) params.set('group_id', groupId);
  if (filters?.include_roles) params.set('include_roles', '1');
  const query = params.toString();
  const result = await api.get<ListComputersResponse>(
    `/api/v1/computers${query ? `?${query}` : ''}`,
  );
  return (result.computers ?? []).map(normalizeComputer);
}

export async function getComputer(id: string): Promise<Computer> {
  return normalizeComputer(await api.get<Computer>(`/api/v1/computers/${encodeURIComponent(id)}`));
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

export async function sessionEndComputer(id: string, approvalId?: string): Promise<ComputerLifecycleResponse> {
  return api.post<ComputerLifecycleResponse>(computerPath(id, 'session-end', approvalId));
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

export async function dragComputer(
  id: string,
  input: { x: number; y: number; end_x: number; end_y: number },
  approvalId?: string,
): Promise<{ success: boolean }> {
  return sendComputerMouse(id, { action: 'drag', ...input }, approvalId);
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


function normalizeComputer(computer: Computer): Computer {
  return { ...computer, groupId: computer.group_id ?? null };
}

export type ResizeComputerInput = Pick<CreateComputerInput, 'cpu_cores' | 'memory_mb' | 'disk_mb'>;
export interface ResizeComputerResponse {
  id: string;
  status: ComputerStatus;
  cpu_cores: number | null;
  memory_mb: number | null;
  disk_mb: number | null;
}
export async function resizeComputer(id: string, input: ResizeComputerInput): Promise<ResizeComputerResponse> {
  return api.patch(computerPath(id, 'resize'), input);
}
export async function cloneComputer(id: string, name?: string): Promise<CreateComputerResponse> {
  return api.post(computerPath(id, 'clone'), { name });
}
export interface UpdateComputerInput { idle_timeout_secs: number | null }
export async function updateComputer(id: string, input: UpdateComputerInput): Promise<Computer> {
  return normalizeComputer(await api.patch<Computer>(`/api/v1/computers/${encodeURIComponent(id)}`, input));
}
export interface ComputerGroup {
  id: string;
  owner_type: 'user' | 'org';
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  member_count: number;
}
export interface ListComputerGroupsResponse { groups: ComputerGroup[] }
export interface ComputerGroupMembershipResponse {
  computer_id: string;
  group_id: string | null;
  moved_from?: string;
}
function groupPath(id: string, computerId?: string): string {
  return `/api/v1/computer-groups/${encodeURIComponent(id)}${computerId === undefined ? '' : `/computers/${encodeURIComponent(computerId)}`}`;
}
export async function listComputerGroups(): Promise<ComputerGroup[]> {
  return (await api.get<ListComputerGroupsResponse>('/api/v1/computer-groups')).groups;
}
export async function createComputerGroup(name: string): Promise<ComputerGroup> {
  return api.post('/api/v1/computer-groups', { name });
}
export async function getComputerGroup(id: string): Promise<ComputerGroup> {
  return api.get(groupPath(id));
}
export async function renameComputerGroup(id: string, name: string): Promise<ComputerGroup> {
  return api.patch(groupPath(id), { name });
}
export async function deleteComputerGroup(id: string): Promise<void> {
  await computerRaw(groupPath(id), { method: 'DELETE' });
}
export async function attachComputerToGroup(id: string, computerId: string): Promise<ComputerGroupMembershipResponse> {
  return api.post(groupPath(id, computerId));
}
export async function detachComputerFromGroup(id: string, computerId: string): Promise<ComputerGroupMembershipResponse> {
  return api.delete(groupPath(id, computerId));
}
