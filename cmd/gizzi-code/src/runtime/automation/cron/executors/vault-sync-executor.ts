/**
 * Vault Sync Executor
 *
 * Executes vault synchronization jobs for the cron scheduler.
 * Handles Gmail, Calendar, Fireflies, and live notes updates.
 */

import { createLogger } from "../utils/logger"
import type { CronJob, CronRun } from "../types"
import { VaultManager } from "@/vault"
import { runSync, runAllSyncs } from "@/vault/sync"
import { updateAllLiveNotes } from "@/vault/notes/live"

const log = createLogger("cron-vault-sync-executor")

export interface VaultSyncExecutorConfig {
  vaultPath?: string
}

export class VaultSyncExecutor {
  private config: VaultSyncExecutorConfig
  private vault: VaultManager | null = null

  constructor(config: VaultSyncExecutorConfig) {
    this.config = config
  }

  private async getVault(): Promise<VaultManager> {
    if (!this.vault) {
      this.vault = new VaultManager({
        vaultPath: this.config.vaultPath,
      })
      await this.vault.initialize()
    }
    return this.vault
  }

  async execute(job: CronJob, run: CronRun, signal: AbortSignal): Promise<void> {
    const jobConfig = job.config as {
      syncSources?: string[]
      liveNotes?: boolean
    }

    log.info("Starting vault sync execution", {
      jobId: job.id,
      runId: run.id,
      sources: jobConfig.syncSources,
      liveNotes: jobConfig.liveNotes,
    })

    const vault = await this.getVault()
    const errors: string[] = []

    // Run sync engines
    if (jobConfig.syncSources && jobConfig.syncSources.length > 0) {
      for (const source of jobConfig.syncSources) {
        if (signal.aborted) break
        try {
          const result = await runSync(vault, source)
          if (!result.success) {
            errors.push(...result.errors)
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          errors.push(`${source}: ${msg}`)
        }
      }
    }

    // Run live notes update
    if (!signal.aborted && jobConfig.liveNotes) {
      try {
        const updated = await updateAllLiveNotes(vault)
        log.info("Live notes updated", { count: updated })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`live-notes: ${msg}`)
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors.map(msg => new Error(msg)),
        `Vault sync completed with ${errors.length} error(s)`
      )
    }

    log.info("Vault sync execution complete", { jobId: job.id, runId: run.id })
  }
}
