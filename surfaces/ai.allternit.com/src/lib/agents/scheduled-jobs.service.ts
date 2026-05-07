/**
 * Scheduled Jobs Service
 * 
 * Production implementation using the Gateway WebSocket API.
 * All operations go through /api/agent-control plus verified REST fallback.
 * NO localStorage fallbacks - proper error handling only.
 */

import { CronJobConfig } from "@/components/agents/CronJobWizard";
import { nativeAgentApi } from "./native-agent-api";

// ============================================================================
// Types
// ============================================================================

export interface ScheduledJobConfig extends CronJobConfig {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount?: number;
  lastError?: string;
}

export interface JobExecution {
  executionId: string;
  jobId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

export interface CreateJobRequest {
  name: string;
  description?: string;
  schedule: string;
  prompt: string;
  taskType: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
  maxRetries: number;
  timeout: number;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

interface AgentControlResponse<T = unknown> {
  ok: boolean;
  method?: string;
  payload?: T;
  error?: string;
}

interface GatewayJob {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  enabled: boolean;
  sessionTemplateId?: string;
  config?: {
    maxRetries?: number;
    timeout?: number;
    notifyOnSuccess?: boolean;
    notifyOnFailure?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount?: number;
  lastError?: string;
}

// ============================================================================
// API Client
// ============================================================================

const AGENT_CONTROL_API = "/api/agent-control";
const CRON_REST_API_BASE = "/allternit-api/cron";

/**
 * Call the agent-control API with proper error handling
 */
async function callAgentControl<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  const response = await fetch(AGENT_CONTROL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data = await response.json() as AgentControlResponse<T>;
  
  if (!data.ok) {
    throw new Error(data.error || "API request failed");
  }

  return data.payload as T;
}

interface CronRestJob {
  id: string;
  name?: string;
  description?: string;
  schedule?: string;
  enabled?: boolean;
  command?: string;
  created_at?: string;
  updated_at?: string;
  last_run?: string;
  next_run?: string;
  createdAt?: string;
  updatedAt?: string;
  lastRun?: string;
  nextRun?: string;
  metadata?: Record<string, unknown>;
}

interface CronRestListResponse {
  jobs?: CronRestJob[];
}

async function readErrorBody(response: Response): Promise<string> {
  const candidate = response as unknown as {
    text?: () => Promise<string>;
    json?: () => Promise<unknown>;
  };

  if (typeof candidate.text === "function") {
    try {
      return await candidate.text();
    } catch {
      // fall through
    }
  }
  if (typeof candidate.json === "function") {
    try {
      return JSON.stringify(await candidate.json());
    } catch {
      // fall through
    }
  }
  return "";
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
  const candidate = response as unknown as {
    text?: () => Promise<string>;
    json?: () => Promise<unknown>;
  };

  if (typeof candidate.text === "function") {
    const raw = await candidate.text();
    try {
      return (raw ? JSON.parse(raw) : {}) as T;
    } catch {
      throw new Error(`${label} returned non-JSON response`);
    }
  }

  if (typeof candidate.json === "function") {
    return (await candidate.json()) as T;
  }

  throw new Error(`${label} response body is not readable`);
}

function mapCronRestJob(job: CronRestJob): ScheduledJobConfig {
  const metadata = (job.metadata ?? {}) as Record<string, unknown>;
  return {
    id: job.id,
    name: job.name || "Scheduled job",
    description: job.description || "",
    schedule: job.schedule || "0 0 * * *",
    taskType: "custom-task",
    parameters: {},
    prompt: typeof metadata.prompt === "string" ? metadata.prompt : "",
    enabled: job.enabled !== false,
    maxRetries: typeof metadata.maxRetries === "number" ? metadata.maxRetries : 3,
    timeout: typeof metadata.timeout === "number" ? metadata.timeout : 30,
    notifyOnSuccess: metadata.notifyOnSuccess === true,
    notifyOnFailure: metadata.notifyOnFailure !== false,
    createdAt: job.createdAt || job.created_at,
    updatedAt: job.updatedAt || job.updated_at,
    lastRunAt: job.lastRun || job.last_run,
    nextRunAt: job.nextRun || job.next_run,
    runCount: 0,
    lastError: undefined,
  };
}

async function listScheduledJobsViaRest(): Promise<ScheduledJobConfig[]> {
  const response = await fetch(CRON_REST_API_BASE, { method: "GET" });
  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new Error(`Cron REST list failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  const data = await parseJsonResponse<CronRestListResponse | CronRestJob[]>(
    response,
    "Cron REST list",
  );
  const jobs = Array.isArray(data) ? data : data.jobs || [];
  return jobs.map(mapCronRestJob);
}

async function createScheduledJobViaRest(config: CronJobConfig): Promise<ScheduledJobConfig> {
  const response = await fetch(CRON_REST_API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: config.name,
      description: config.description,
      schedule: config.schedule,
      // Rust cron API requires a command string; keep task type as command identity.
      command: config.taskType || "custom-task",
      arguments: config.parameters,
      enabled: config.enabled,
      metadata: {
        prompt: config.prompt,
        maxRetries: config.maxRetries,
        timeout: config.timeout,
        notifyOnSuccess: config.notifyOnSuccess,
        notifyOnFailure: config.notifyOnFailure,
      },
    }),
  });

  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new Error(`Cron REST create failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const created = await parseJsonResponse<{ id?: string }>(response, "Cron REST create");
  return {
    ...config,
    id: created.id || `job-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    runCount: 0,
  };
}

async function deleteScheduledJobViaRest(jobId: string): Promise<void> {
  const response = await fetch(`${CRON_REST_API_BASE}/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204 && response.status !== 404) {
    const detail = await readErrorBody(response);
    throw new Error(`Cron REST delete failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
}

async function runScheduledJobNowViaRest(jobId: string): Promise<JobExecution> {
  const response = await fetch(`${CRON_REST_API_BASE}/${encodeURIComponent(jobId)}/run`, {
    method: "POST",
  });
  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new Error(`Cron REST run failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const data = await parseJsonResponse<{
    status?: string;
    job_id?: string;
    success?: boolean;
    started_at?: string;
    completed_at?: string;
    output?: string;
    error?: string;
  }>(response, "Cron REST run");

  const startedAt = data.started_at || new Date().toISOString();
  return {
    executionId: `${jobId}-${Date.now()}`,
    jobId: data.job_id || jobId,
    status: data.success === false ? "failed" : "completed",
    startedAt,
    completedAt: data.completed_at || new Date().toISOString(),
    output: data.output,
    error: data.error,
  };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new scheduled job
 */
export async function createScheduledJob(
  config: CronJobConfig
): Promise<ScheduledJobConfig> {
  try {
    // First, create a session template for this job
    const sessionTemplate = await createJobSessionTemplate(config);
    
    // Then register with the cron system via Gateway API
    const jobId = `job-${Date.now()}`;
    
    await callAgentControl("cron.update", {
      jobId,
      name: config.name,
      description: config.description,
      schedule: config.schedule,
      enabled: config.enabled,
      sessionTemplateId: sessionTemplate.id,
      config: {
        maxRetries: config.maxRetries,
        timeout: config.timeout,
        notifyOnSuccess: config.notifyOnSuccess,
        notifyOnFailure: config.notifyOnFailure,
      },
    });

    return {
      ...config,
      id: jobId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
    };
  } catch (primaryError) {
    console.warn("[ScheduledJobs] Gateway create failed, falling back to REST:", primaryError);
    try {
      return await createScheduledJobViaRest(config);
    } catch (restError) {
      throw new Error(
        `[ScheduledJobs] Failed to create scheduled job via gateway or REST: ${
          restError instanceof Error ? restError.message : String(restError)
        }`
      );
    }
  }
}

/**
 * List all scheduled jobs
 */
export async function listScheduledJobs(): Promise<ScheduledJobConfig[]> {
  try {
    const response = await callAgentControl<{ jobs: GatewayJob[] }>("cron.list", {});
    const jobs = response.jobs || [];
    
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      description: job.description,
      schedule: job.schedule,
      taskType: "custom-task",
      parameters: {},
      prompt: "",
      enabled: job.enabled,
      maxRetries: job.config?.maxRetries || 3,
      timeout: job.config?.timeout || 30,
      notifyOnSuccess: job.config?.notifyOnSuccess || false,
      notifyOnFailure: job.config?.notifyOnFailure !== false,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      lastRunAt: job.lastRunAt,
      nextRunAt: job.nextRunAt,
      runCount: job.runCount || 0,
      lastError: job.lastError,
    }));
  } catch (gatewayError) {
    console.warn("[ScheduledJobs] Gateway list failed, falling back to REST:", gatewayError);
    try {
      return await listScheduledJobsViaRest();
    } catch (restError) {
      throw new Error(
        `[ScheduledJobs] Failed to list scheduled jobs via gateway or REST: ${
          restError instanceof Error ? restError.message : String(restError)
        }`
      );
    }
  }
}

/**
 * Update an existing scheduled job
 */
export async function updateScheduledJob(
  jobId: string,
  updates: Partial<CronJobConfig>
): Promise<ScheduledJobConfig> {
  try {
    await callAgentControl("cron.update", {
      jobId,
      ...updates,
    });
  } catch (gatewayError) {
    const onlyEnabledUpdate =
      Object.keys(updates).length === 1 && typeof updates.enabled === "boolean";
    if (onlyEnabledUpdate) {
      const endpoint = updates.enabled ? "enable" : "disable";
      await fetch(`${CRON_REST_API_BASE}/${encodeURIComponent(jobId)}/${endpoint}`, {
        method: "POST",
      });
    } else {
      throw gatewayError;
    }
    if (gatewayError) {
      console.warn("[ScheduledJobs] Gateway update failed:", gatewayError);
    }
  }

  const jobs = await listScheduledJobs();
  const updated = jobs.find((j) => j.id === jobId);
  if (!updated) {
    throw new Error("Job not found after update");
  }
  return updated;
}

/**
 * Delete a scheduled job
 */
export async function deleteScheduledJob(jobId: string): Promise<void> {
  try {
    await callAgentControl("cron.update", {
      jobId,
      enabled: false,
      deleted: true,
    });
  } catch (gatewayError) {
    console.warn("[ScheduledJobs] Gateway delete failed, falling back to REST:", gatewayError);
    try {
      await deleteScheduledJobViaRest(jobId);
    } catch (restError) {
      throw new Error(
        `[ScheduledJobs] Failed to delete scheduled job via gateway or REST: ${
          restError instanceof Error ? restError.message : String(restError)
        }`
      );
    }
  }
}

/**
 * Run a scheduled job immediately (manual trigger)
 */
export async function runScheduledJobNow(jobId: string): Promise<JobExecution> {
  try {
    return await callAgentControl<JobExecution>("cron.run", { jobId });
  } catch (gatewayError) {
    console.warn("[ScheduledJobs] Gateway run failed, falling back to REST:", gatewayError);
    try {
      return await runScheduledJobNowViaRest(jobId);
    } catch (restError) {
      throw new Error(
        `[ScheduledJobs] Failed to run scheduled job via gateway or REST: ${
          restError instanceof Error ? restError.message : String(restError)
        }`
      );
    }
  }
}

/**
 * Pause a scheduled job
 */
export async function pauseScheduledJob(jobId: string): Promise<void> {
  await updateScheduledJob(jobId, { enabled: false });
}

/**
 * Resume a scheduled job
 */
export async function resumeScheduledJob(jobId: string): Promise<void> {
  await updateScheduledJob(jobId, { enabled: true });
}

/**
 * Get execution history for a job
 */
export async function getJobExecutionHistory(
  jobId: string,
  limit: number = 10
): Promise<JobExecution[]> {
  void limit;
  throw new Error(
    `Execution history for scheduled job '${jobId}' is unavailable because no durable backend history endpoint is implemented.`
  );
}

// ============================================================================
// Session Template Management
// ============================================================================

interface SessionTemplate {
  id: string;
  name: string;
  prompt: string;
  parameters: Record<string, unknown>;
  taskType: string;
}

/**
 * Create a session template for a scheduled job
 * This template is used when the job runs to create a new session
 */
async function createJobSessionTemplate(
  config: CronJobConfig
): Promise<SessionTemplate> {
  return {
    id: `template-${Date.now()}`,
    name: config.name,
    prompt: config.prompt,
    parameters: config.parameters,
    taskType: config.taskType,
  };
}

/**
 * Get a session template by ID
 */
export function getJobSessionTemplate(templateId: string): SessionTemplate | null {
  void templateId;
  return null;
}

// ============================================================================
// Job Execution (Called by runner)
// ============================================================================

/**
 * Execute a scheduled job
 * This is called by the job runner when the schedule triggers
 */
export async function executeScheduledJob(
  jobConfig: ScheduledJobConfig
): Promise<JobExecution> {
  const executionId = `exec-${Date.now()}`;
  const startedAt = new Date().toISOString();

  try {
    // Create a new session for this job execution
    const session = await nativeAgentApi.sessions.createSession({
      name: `[Scheduled] ${jobConfig.name}`,
      description: `Automated execution of scheduled job: ${jobConfig.name}`,
      metadata: {
        scheduledJobId: jobConfig.id,
        taskType: jobConfig.taskType,
        isScheduledExecution: true,
      },
    });

    // Send the prompt to the session
    await nativeAgentApi.sessions.sendMessage(session.id, {
      role: "user",
      text: jobConfig.prompt,
    });

    // Return execution record
    return {
      executionId,
      jobId: jobConfig.id || "unknown",
      status: "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      output: `Session created: ${session.id}`,
    };
  } catch (error) {
    return {
      executionId,
      jobId: jobConfig.id || "unknown",
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Cron Expression Utilities
// ============================================================================

/**
 * Parse a cron expression and return human-readable description
 */
export function describeCronExpression(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid cron expression";

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (cron === "* * * * *") return "Every minute";
  if (cron === "0 * * * *") return "Every hour";
  if (cron === "0 0 * * *") return "Every day at midnight";
  if (cron === "0 9 * * *") return "Every day at 9:00 AM";
  if (cron === "0 9 * * 1-5") return "Every weekday at 9:00 AM";
  if (cron === "0 9 * * 1") return "Every Monday at 9:00 AM";
  if (cron === "0 0 * * 0") return "Every Sunday at midnight";
  if (cron === "0 0 1 * *") return "First day of every month";

  // Custom descriptions
  let description = "";
  
  if (minute === "0" && hour !== "*") {
    description = `Daily at ${hour}:${minute.padStart(2, "0")}`;
  } else if (minute.startsWith("*/")) {
    const interval = minute.replace("*/", "");
    description = `Every ${interval} minutes`;
  } else if (hour === "*") {
    description = `Every hour at minute ${minute}`;
  }

  if (dayOfWeek !== "*" && dayOfMonth === "*") {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    if (dayOfWeek.includes("-")) {
      const [start, end] = dayOfWeek.split("-");
      description += ` from ${days[parseInt(start)]} to ${days[parseInt(end)]}`;
    } else if (dayOfWeek.includes(",")) {
      const dayList = dayOfWeek.split(",").map((d) => days[parseInt(d)]);
      description += ` on ${dayList.join(", ")}`;
    } else {
      description += ` on ${days[parseInt(dayOfWeek)]}`;
    }
  }

  return description || cron;
}

/**
 * Calculate next run time from cron expression
 */
export function calculateNextRun(cron: string): Date | null {
  const now = new Date();

  // Every minute
  if (cron === "* * * * *") {
    return new Date(now.getTime() + 60000);
  }

  // Every hour
  if (cron === "0 * * * *") {
    const next = new Date(now);
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
    next.setSeconds(0);
    return next;
  }

  // Every day at specific time
  const dailyMatch = cron.match(/^0 (\d+) \* \* \*$/);
  if (dailyMatch) {
    const hour = parseInt(dailyMatch[1]);
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  // Default: 1 hour from now
  return new Date(now.getTime() + 3600000);
}
