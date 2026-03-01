import { Log } from "@/util/log"
import { CronService } from "./service"
import { CronStore } from "./store"
import { CronTypes } from "./types"
import { SessionPrompt } from "@/session/prompt"
import { RunRegistry } from "@/runtime/run-registry"

export { CronService, CronStore, CronTypes }

const log = Log.create({ service: "cron-init" })

export async function initializeCron(): Promise<void> {
  log.info("initializing cron service")

  // Load persisted data
  const { jobs, runs } = await CronStore.load()

  // Initialize service
  CronService.initialize({
    persist: async (jobs, runs) => {
      await CronStore.persist(jobs, runs)
    },
    execute: async (job, reason) => {
      log.info("executing cron job", { jobId: job.id, reason })

      // Create a new session or use existing
      const sessionID = job.sessionID ?? `cron-${Date.now()}`

      // Create run via RunRegistry for tracking
      const { runId } = RunRegistry.create(sessionID, job.agent, job.prompt)

      // Execute the prompt
      const promptPromise = SessionPrompt.prompt({
        sessionID,
        agent: job.agent,
        parts: [{ type: "text", text: job.prompt }],
      })
        .then(() => {
          RunRegistry.complete(runId, "completed")
          return "completed"
        })
        .catch((error) => {
          const errorMsg = error instanceof Error ? error.message : String(error)
          RunRegistry.complete(runId, "errored", errorMsg)
          throw error
        })

      RunRegistry.start(runId, promptPromise)

      await promptPromise

      return runId
    },
    checkIntervalMs: 60000, // Check every minute
  })

  // Load data into service
  await CronService.load(jobs, runs)

  log.info("cron service initialized", { jobs: jobs.length, runs: runs.length })
}

export function shutdownCron(): void {
  log.info("shutting down cron service")
  // The service cleanup is handled by Instance.state disposal
}
