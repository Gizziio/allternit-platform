/**
 * Agent Task Queue Worker
 *
 * Polls the Allternit Cloud API task queue for pending items,
 * claims them on behalf of an agent, and marks them complete.
 *
 * Registered as a `function` type cron job in CronServiceEnhanced.
 *
 * Usage (cron job config):
 *   {
 *     type: "function",
 *     config: {
 *       module: "@/runtime/automation/cron/workers/agent-queue",
 *       function: "runAgentQueueWorker",
 *       args: [{ agentId: "gizzi-agent-1", agentRole: "cowork" }]
 *     }
 *   }
 */

import { createLogger } from "../utils/logger";

const log = createLogger("agent-queue-worker");

const API_BASE = process.env.Allternit_API_URL || "http://localhost:3001";

interface QueueWorkerConfig {
  agentId: string;
  agentRole?: string;
}

interface ClaimedQueueItem {
  id: string;
  task_id: string;
  agent_id: string | null;
  agent_role: string | null;
  status: string;
  claimed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  result: unknown;
  error: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
}

async function apiCall<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = process.env.Allternit_API_TOKEN;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Main entry point for the agent queue worker cron job.
 */
export async function runAgentQueueWorker(config: QueueWorkerConfig): Promise<void> {
  log.info("Agent queue worker starting", { agentId: config.agentId });

  // 1. Claim the next pending queue item
  const claimed = await apiCall<ClaimedQueueItem | null>("POST", "/api/v1/queue/claim", {
    agent_id: config.agentId,
    agent_role: config.agentRole || null,
  });

  if (!claimed) {
    log.info("No pending queue items");
    return;
  }

  log.info("Claimed queue item", {
    queueId: claimed.id,
    taskId: claimed.task_id,
    agentId: config.agentId,
  });

  // 2. Mark as running
  await apiCall<ClaimedQueueItem>("POST", `/api/v1/queue/${claimed.id}/start`, {});
  log.info("Queue item started", { queueId: claimed.id, taskId: claimed.task_id });

  // 3. Process the task (simulate agent work)
  // In production, this would invoke the actual agent runtime
  const startTime = Date.now();
  let result: string | undefined;
  let error: string | undefined;

  try {
    log.info("Processing task", { taskId: claimed.task_id });

    // Simulate agent work — replace with real agent invocation
    await simulateAgentWork(claimed.task_id, config);

    result = JSON.stringify({
      status: "completed",
      processedAt: new Date().toISOString(),
      agentId: config.agentId,
      durationMs: Date.now() - startTime,
    });

    log.info("Task processed successfully", { taskId: claimed.task_id, durationMs: Date.now() - startTime });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    log.error("Task processing failed", { taskId: claimed.task_id, error });
  }

  // 4. Complete the queue item
  await apiCall<ClaimedQueueItem>("POST", `/api/v1/queue/${claimed.id}/complete`, {
    result,
    error,
  });

  log.info("Queue item completed", {
    queueId: claimed.id,
    taskId: claimed.task_id,
    success: !error,
  });
}

/**
 * Simulates agent work for a claimed task.
 * In production, this should invoke the actual agent session runtime.
 */
async function simulateAgentWork(taskId: string, config: QueueWorkerConfig): Promise<void> {
  // Placeholder: sleep to simulate processing time
  // Replace with: Session.createNext() + SessionPrompt.prompt() etc.
  const duration = 500 + Math.random() * 1500;
  await new Promise((resolve) => setTimeout(resolve, duration));

  log.debug("Simulated agent work completed", { taskId, agentId: config.agentId, duration });
}

/**
 * Health check for the agent queue worker.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/tasks`, { method: "HEAD" });
    return response.ok || response.status === 405; // 405 Method Not Allowed is fine — API is up
  } catch {
    return false;
  }
}
