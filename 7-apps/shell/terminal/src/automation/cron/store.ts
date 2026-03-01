import { Log } from "@/util/log"
import { Storage } from "@/storage/storage"
import { CronTypes } from "./types"

export namespace CronStore {
  const log = Log.create({ service: "cron-store" })

  const JOBS_KEY = ["automation", "cron", "jobs"]
  const RUNS_KEY = ["automation", "cron", "runs"]

  export async function saveJobs(jobs: CronTypes.CronJob[]): Promise<void> {
    try {
      await Storage.write(JOBS_KEY, jobs)
      log.debug("jobs saved", { count: jobs.length })
    } catch (error) {
      log.error("failed to save jobs", { error })
      throw error
    }
  }

  export async function loadJobs(): Promise<CronTypes.CronJob[]> {
    try {
      const jobs = await Storage.read<CronTypes.CronJob[]>(JOBS_KEY)
      return jobs ?? []
    } catch (error) {
      log.error("failed to load jobs", { error })
      return []
    }
  }

  export async function saveRuns(runs: CronTypes.CronRun[]): Promise<void> {
    try {
      // Keep only last 1000 runs to prevent unbounded growth
      const trimmedRuns = runs
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 1000)
      
      await Storage.write(RUNS_KEY, trimmedRuns)
      log.debug("runs saved", { count: trimmedRuns.length })
    } catch (error) {
      log.error("failed to save runs", { error })
      throw error
    }
  }

  export async function loadRuns(): Promise<CronTypes.CronRun[]> {
    try {
      const runs = await Storage.read<CronTypes.CronRun[]>(RUNS_KEY)
      return runs ?? []
    } catch (error) {
      log.error("failed to load runs", { error })
      return []
    }
  }

  export async function persist(jobs: CronTypes.CronJob[], runs: CronTypes.CronRun[]): Promise<void> {
    await Promise.all([saveJobs(jobs), saveRuns(runs)])
  }

  export async function load(): Promise<{ jobs: CronTypes.CronJob[]; runs: CronTypes.CronRun[] }> {
    const [jobs, runs] = await Promise.all([loadJobs(), loadRuns()])
    return { jobs, runs }
  }
}
