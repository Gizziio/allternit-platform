/**
 * Scheduled Jobs Service
 * 
 * Production implementation using the Gateway WebSocket API.
 * All operations go through /api/agent-control endpoint.
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

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new scheduled job
 */
export async function createScheduledJob(
  config: CronJobConfig
): Promise<ScheduledJobConfig> {
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
  } catch (error) {
    console.error("[ScheduledJobs] Failed to list jobs:", error);
    throw new Error("Failed to fetch scheduled jobs from server");
  }
}

/**
 * Update an existing scheduled job
 */
export async function updateScheduledJob(
  jobId: string,
  updates: Partial<CronJobConfig>
): Promise<ScheduledJobConfig> {
  await callAgentControl("cron.update", {
    jobId,
    ...updates,
  });

  // Fetch the updated job to return current state
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
  await callAgentControl("cron.update", {
    jobId,
    enabled: false,
    deleted: true,
  });
}

/**
 * Run a scheduled job immediately (manual trigger)
 */
export async function runScheduledJobNow(jobId: string): Promise<JobExecution> {
  return await callAgentControl<JobExecution>("cron.run", { jobId });
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
  // Note: This would require a new Gateway API endpoint
  // For now, we return an empty array - the backend should implement this
  console.warn("[ScheduledJobs] getJobExecutionHistory not implemented in Gateway API");
  return [];
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
  const template: SessionTemplate = {
    id: `template-${Date.now()}`,
    name: config.name,
    prompt: config.prompt,
    parameters: config.parameters,
    taskType: config.taskType,
  };

  // Store template via backend API (would be implemented in Gateway)
  // For now, we return the template directly
  // In production, this would persist to the backend
  return template;
}

/**
 * Get a session template by ID
 */
export function getJobSessionTemplate(templateId: string): SessionTemplate | null {
  // This would fetch from backend in production
  // For now, we return null - the backend should implement template storage
  console.warn("[ScheduledJobs] getJobSessionTemplate not implemented");
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
