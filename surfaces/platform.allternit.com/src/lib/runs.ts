import { api } from "@/lib/api-client";

export type RunMode = "local" | "remote" | "cloud";
export type RunStatus =
  | "pending"
  | "planning"
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunSummary {
  id: string;
  name: string;
  mode: RunMode;
  status: RunStatus;
  completed_steps: number;
  total_steps: number | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceLimits {
  memory_mb?: number;
  cpu_cores?: number;
  disk_gb?: number;
  timeout_seconds?: number;
}

export interface RunConfig {
  working_dir?: string;
  env?: Record<string, string>;
  command?: string;
  args?: string[];
  resource_limits?: ResourceLimits;
  sync?: {
    enabled: boolean;
    watch_patterns: string[];
    ignore_patterns: string[];
    bidirectional: boolean;
  };
  [key: string]: unknown;
}

export interface Run extends RunSummary {
  description?: string | null;
  step_cursor?: string | null;
  config: RunConfig;
  owner_id?: string | null;
  tenant_id?: string | null;
  runtime_id?: string | null;
  runtime_type?: string | null;
  schedule_id?: string | null;
  region_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  error_details?: Record<string, unknown> | null;
}

export interface CreateRunRequest {
  name: string;
  description?: string;
  mode: RunMode;
  config: RunConfig;
  auto_start?: boolean;
  region_id?: string;
}

export interface UpdateRunRequest {
  name?: string;
  description?: string;
}

export async function listRuns(status?: string): Promise<RunSummary[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return api.get<RunSummary[]>(`/api/v1/runs${query}`);
}

export async function getRun(id: string): Promise<Run> {
  return api.get<Run>(`/api/v1/runs/${encodeURIComponent(id)}`);
}

export async function createRun(req: CreateRunRequest): Promise<Run> {
  return api.post<Run>("/api/v1/runs", req);
}

export async function updateRun(id: string, req: UpdateRunRequest): Promise<Run> {
  return api.patch<Run>(`/api/v1/runs/${encodeURIComponent(id)}`, req);
}

export async function deleteRun(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/runs/${encodeURIComponent(id)}`);
}

export async function startRun(id: string): Promise<Run> {
  return api.post<Run>(`/api/v1/runs/${encodeURIComponent(id)}/start`);
}

export async function pauseRun(id: string): Promise<Run> {
  return api.post<Run>(`/api/v1/runs/${encodeURIComponent(id)}/pause`);
}

export async function resumeRun(id: string): Promise<Run> {
  return api.post<Run>(`/api/v1/runs/${encodeURIComponent(id)}/resume`);
}

export async function cancelRun(id: string): Promise<Run> {
  return api.post<Run>(`/api/v1/runs/${encodeURIComponent(id)}/cancel`);
}
