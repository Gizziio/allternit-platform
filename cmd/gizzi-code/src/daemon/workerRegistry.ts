/**
 * Daemon Worker Registry
 *
 * Manages background worker processes for the Allternit daemon.
 * Workers handle vault sync, live note updates, and scheduled tasks.
 */

import { Log } from "@/shared/util/log"
import type { CronJob } from "@/runtime/automation/cron/types"

const log = Log.create({ service: "daemon-worker-registry" })

export interface WorkerInfo {
  id: string
  status: "idle" | "busy" | "error"
  jobType?: string
  startedAt?: string
  lastHeartbeat?: string
}

const workers = new Map<string, WorkerInfo>()

export function registerWorker(worker: WorkerInfo): void {
  workers.set(worker.id, { ...worker, lastHeartbeat: new Date().toISOString() })
  log.debug("Worker registered", { id: worker.id, status: worker.status })
}

export function updateWorkerStatus(id: string, status: WorkerInfo["status"]): void {
  const worker = workers.get(id)
  if (worker) {
    worker.status = status
    worker.lastHeartbeat = new Date().toISOString()
    workers.set(id, worker)
  }
}

export function heartbeatWorker(id: string): void {
  const worker = workers.get(id)
  if (worker) {
    worker.lastHeartbeat = new Date().toISOString()
    workers.set(id, worker)
  }
}

export function unregisterWorker(id: string): void {
  workers.delete(id)
  log.debug("Worker unregistered", { id })
}

export function getWorkers(): WorkerInfo[] {
  return Array.from(workers.values())
}

export function getWorker(id: string): WorkerInfo | undefined {
  return workers.get(id)
}

export function getIdleWorkers(): WorkerInfo[] {
  return Array.from(workers.values()).filter(w => w.status === "idle")
}

export function getBusyWorkers(): WorkerInfo[] {
  return Array.from(workers.values()).filter(w => w.status === "busy")
}

export function getWorkersByType(jobType: string): WorkerInfo[] {
  return Array.from(workers.values()).filter(w => w.jobType === jobType)
}

/**
 * Assign a job to an idle worker.
 * Returns the worker ID if assigned, null if no idle workers available.
 */
export function assignJob(job: Pick<CronJob, "id" | "type">): string | null {
  const idle = getIdleWorkers()
  if (idle.length === 0) return null

  const worker = idle[0]!
  worker.status = "busy"
  worker.jobType = job.type
  worker.startedAt = new Date().toISOString()
  workers.set(worker.id, worker)

  log.info("Job assigned to worker", { jobId: job.id, workerId: worker.id })
  return worker.id
}

/**
 * Release a worker back to idle state.
 */
export function releaseWorker(id: string): void {
  const worker = workers.get(id)
  if (!worker) return

  worker.status = "idle"
  worker.jobType = undefined
  worker.startedAt = undefined
  workers.set(id, worker)

  log.debug("Worker released", { id })
}

/**
 * Clean up stale workers that haven't sent a heartbeat recently.
 */
export function cleanupStaleWorkers(maxAgeMs = 300000): number {
  const now = Date.now()
  let removed = 0

  for (const [id, worker] of workers) {
    const lastHeartbeat = worker.lastHeartbeat ? new Date(worker.lastHeartbeat).getTime() : 0
    if (now - lastHeartbeat > maxAgeMs) {
      workers.delete(id)
      removed++
      log.warn("Removed stale worker", { id, lastHeartbeat: worker.lastHeartbeat })
    }
  }

  return removed
}

/**
 * Main entry for running a daemon worker process.
 * Currently a no-op placeholder for future worker pool implementation.
 */
export function runDaemonWorker(..._args: unknown[]): void {
  // TODO: Implement worker process fork when needed
  // For now, all work runs in the main daemon process via CronService
}

export default { registerWorker, getWorkers, runDaemonWorker, assignJob, releaseWorker, cleanupStaleWorkers }
