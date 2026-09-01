import { api } from "@/lib/api-client";

export type MisfirePolicy = "ignore" | "fire_once" | "fire_all";

export interface JobConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  working_dir?: string;
  timeout_seconds?: number;
}

export interface ScheduleSummary {
  id: string;
  name: string;
  enabled: boolean;
  cron_expr: string;
  natural_lang?: string | null;
  next_run_at?: string | null;
  run_count: number;
}

export interface Schedule extends ScheduleSummary {
  description?: string | null;
  timezone: string;
  job_template: JobConfig;
  misfire_policy: MisfirePolicy;
  last_run_at?: string | null;
  owner_id?: string | null;
  tenant_id?: string | null;
  region_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleRequest {
  name: string;
  description?: string;
  cron_expr: string;
  natural_lang?: string;
  timezone?: string;
  job_template: JobConfig;
  enabled?: boolean;
  misfire_policy?: MisfirePolicy;
  region_id?: string;
}

export interface UpdateScheduleRequest {
  name?: string;
  description?: string;
  cron_expr?: string;
  natural_lang?: string;
  timezone?: string;
  job_template?: JobConfig;
  enabled?: boolean;
  misfire_policy?: MisfirePolicy;
}

export async function listSchedules(enabled?: boolean): Promise<ScheduleSummary[]> {
  const query = enabled !== undefined ? `?enabled=${encodeURIComponent(String(enabled))}` : "";
  return api.get<ScheduleSummary[]>(`/api/v1/schedules${query}`);
}

export async function getSchedule(id: string): Promise<Schedule> {
  return api.get<Schedule>(`/api/v1/schedules/${encodeURIComponent(id)}`);
}

export async function createSchedule(req: CreateScheduleRequest): Promise<Schedule> {
  return api.post<Schedule>("/api/v1/schedules", req);
}

export async function updateSchedule(
  id: string,
  req: UpdateScheduleRequest
): Promise<Schedule> {
  return api.put<Schedule>(`/api/v1/schedules/${encodeURIComponent(id)}`, req);
}

export async function deleteSchedule(id: string): Promise<void> {
  return api.delete<void>(`/api/v1/schedules/${encodeURIComponent(id)}`);
}

export async function enableSchedule(id: string): Promise<Schedule> {
  return api.post<Schedule>(`/api/v1/schedules/${encodeURIComponent(id)}/enable`);
}

export async function disableSchedule(id: string): Promise<Schedule> {
  return api.post<Schedule>(`/api/v1/schedules/${encodeURIComponent(id)}/disable`);
}

export async function triggerSchedule(id: string): Promise<Schedule> {
  return api.post<Schedule>(`/api/v1/schedules/${encodeURIComponent(id)}/trigger`);
}
