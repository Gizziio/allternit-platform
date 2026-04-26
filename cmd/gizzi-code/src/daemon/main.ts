/**
 * Allternit Daemon
 *
 * Background process that manages:
 * - Cron scheduler (job execution, recurring tasks)
 * - Vault sync (Gmail, Calendar, Fireflies, live notes)
 * - Health monitoring
 *
 * Entry point: `gizzi daemon` or spawned by desktop/CLI
 */

import { CronDaemon } from "@/runtime/automation/cron/daemon"
import { CronService } from "@/runtime/automation/cron/service"
import { registerFunction } from "@/runtime/automation/cron/executors/function-registry"
import { Log } from "@/shared/util/log"
import { Global } from "@/runtime/context/global"
import { loadSettings } from "@/vault/settings"
import { listConnectorIds, getConnectorConfig } from "@/vault/connector"
import { runSync, runAllSyncs } from "@/vault/sync"
import { updateAllLiveNotes } from "@/vault/notes/live"
import path from "path"

const log = Log.create({ service: "daemon" })

let daemon: CronDaemon | null = null

export async function startDaemon(config?: { port?: number; dbPath?: string }): Promise<void> {
  if (daemon) {
    log.info("Daemon already running")
    return
  }

  const port = config?.port ?? 3031
  const dbPath = config?.dbPath ?? path.join(Global.Path.data, "cron.db")

  log.info("Starting Allternit daemon", { port, dbPath })

  daemon = new CronDaemon({
    port,
    host: "127.0.0.1",
    dbPath,
    checkIntervalMs: 60000,
    maxConcurrentJobs: 10,
    jobTimeoutSeconds: 300,
  })

  await daemon.start()

  // Register vault functions for cron "function" jobs (production-safe registry)
  registerFunction("vault-sync", runSync as (...args: unknown[]) => unknown)
  registerFunction("vault-sync-all", runAllSyncs as (...args: unknown[]) => unknown)
  registerFunction("vault-live-notes", updateAllLiveNotes as (...args: unknown[]) => unknown)

  // Register default vault sync jobs if they don't exist
  await registerDefaultVaultJobs()

  log.info("Allternit daemon ready")
}

export async function stopDaemon(): Promise<void> {
  if (!daemon) {
    log.info("Daemon not running")
    return
  }

  log.info("Stopping Allternit daemon")
  await daemon.stop()
  daemon = null
  log.info("Allternit daemon stopped")
}

export function isDaemonRunning(): boolean {
  return daemon !== null
}

const CONNECTOR_SCHEDULES: Record<string, string> = {
  gmail: "0 2 * * *",
  calendar: "30 2 * * *",
  fireflies: "0 3 * * *",
}

let vaultJobsRegistrationPromise: Promise<void> | null = null

async function registerDefaultVaultJobs(): Promise<void> {
  // Prevent concurrent registration attempts
  if (vaultJobsRegistrationPromise) {
    return vaultJobsRegistrationPromise
  }

  vaultJobsRegistrationPromise = _doRegisterDefaultVaultJobs()
  try {
    await vaultJobsRegistrationPromise
  } finally {
    vaultJobsRegistrationPromise = null
  }
}

async function _doRegisterDefaultVaultJobs(): Promise<void> {
  const existing = CronService.list()
  const settings = await loadSettings()
  log.info("Reconciling vault sync jobs")

  const enabledIds = new Set<string>()

  // Register/update jobs for all connectors that are enabled in settings
  for (const id of listConnectorIds()) {
    const config = await getConnectorConfig(id)
    if (!config.enabled) continue

    enabledIds.add(id)
    const schedule = CONNECTOR_SCHEDULES[id]
    if (!schedule) {
      log.warn("No schedule configured for connector", { id })
      continue
    }

    const existingJob = existing.find(j => j.tags.includes("vault-sync") && j.tags.includes(id))
    if (existingJob) {
      // Update schedule if it changed
      if (existingJob.schedule !== schedule) {
        try {
          CronService.update(existingJob.id, { schedule })
          log.info("Updated vault sync job schedule", { id, schedule })
        } catch (e) {
          log.warn("Failed to update vault sync job schedule", { id, error: e })
        }
      }
      continue
    }

    try {
      CronService.create({
        name: `Vault: ${id} Sync`,
        description: `Synchronize ${id} into the knowledge vault`,
        type: "vault",
        schedule,
        config: {
          syncSources: [id],
          liveNotes: false,
        },
        tags: ["vault-sync", id],
        timeoutSeconds: 600,
      })
      log.info("Registered vault sync job", { id, schedule })
    } catch (e) {
      log.warn("Failed to register vault sync job", { id, error: e })
    }
  }

  // Remove jobs for connectors that are now disabled
  for (const job of existing) {
    if (!job.tags.includes("vault-sync")) continue
    const connectorTag = job.tags.find(t => t !== "vault-sync" && t !== "live-notes")
    if (connectorTag && !enabledIds.has(connectorTag)) {
      try {
        CronService.delete(job.id)
        log.info("Removed vault sync job for disabled connector", { id: connectorTag })
      } catch (e) {
        log.warn("Failed to remove vault sync job", { id: connectorTag, error: e })
      }
    }
  }

  // Live notes update — every 6 hours (register if enabled, remove if disabled)
  const liveNotesJob = existing.find(j => j.tags.includes("vault-sync") && j.tags.includes("live-notes"))
  if (settings.liveNotes.enabled && !liveNotesJob) {
    try {
      CronService.create({
        name: "Vault: Live Notes Update",
        description: "Refresh auto-updating live notes with latest context",
        type: "vault",
        schedule: "0 */6 * * *",
        config: {
          syncSources: [],
          liveNotes: true,
        },
        tags: ["vault-sync", "live-notes"],
        timeoutSeconds: 300,
      })
      log.info("Registered live notes job")
    } catch (e) {
      log.warn("Failed to register live notes job", { error: e })
    }
  } else if (!settings.liveNotes.enabled && liveNotesJob) {
    try {
      CronService.delete(liveNotesJob.id)
      log.info("Removed live notes job")
    } catch (e) {
      log.warn("Failed to remove live notes job", { error: e })
    }
  }

  log.info("Vault sync jobs reconciled")
}

export async function daemonMain(args: string[] = []): Promise<void> {
  const command = args[0] || "start"

  switch (command) {
    case "start":
      await startDaemon()
      // Keep process alive
      process.stdin.resume()
      break
    case "stop":
      await stopDaemon()
      break
    case "status":
      if (isDaemonRunning()) {
        console.log("Daemon: running")
      } else {
        console.log("Daemon: stopped")
      }
      break
    default:
      console.error(`Unknown daemon command: ${command}`)
      console.error("Usage: gizzi daemon [start|stop|status]")
      process.exit(1)
  }
}

export default { startDaemon, stopDaemon, daemonMain, isDaemonRunning }
