import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { CronTypes } from "./types"
import { CronParser } from "./parser"
import z from "zod/v4"

export namespace CronService {
  const log = Log.create({ service: "cron" })

  const JobCreatedEvent = BusEvent.define(
    "cron.job.created",
    z.object({
      jobId: z.string(),
      name: z.string(),
      createdAt: z.number(),
    })
  )

  const JobUpdatedEvent = BusEvent.define(
    "cron.job.updated",
    z.object({
      jobId: z.string(),
      updatedAt: z.number(),
    })
  )

  const JobRemovedEvent = BusEvent.define(
    "cron.job.removed",
    z.object({
      jobId: z.string(),
      removedAt: z.number(),
    })
  )

  const JobFinishedEvent = BusEvent.define(
    "cron.job.finished",
    z.object({
      jobId: z.string(),
      runId: z.string(),
      status: CronTypes.CronRunStatus,
      finishedAt: z.number(),
    })
  )

  export const Events = {
    JobCreated: JobCreatedEvent,
    JobUpdated: JobUpdatedEvent,
    JobRemoved: JobRemovedEvent,
    JobFinished: JobFinishedEvent,
  }

  type JobStore = {
    jobs: Map<string, CronTypes.CronJob>
    runs: Map<string, CronTypes.CronRun>
    timer: ReturnType<typeof setInterval> | null
  }

  const state = Instance.state(
    (): JobStore => ({
      jobs: new Map(),
      runs: new Map(),
      timer: null,
    }),
    async (store) => {
      if (store.timer) {
        clearInterval(store.timer)
        store.timer = null
      }
    }
  )

  let persistCallback: ((jobs: CronTypes.CronJob[], runs: CronTypes.CronRun[]) => Promise<void>) | null = null
  let executeCallback: ((job: CronTypes.CronJob, reason: CronTypes.CronWakeReason) => Promise<string>) | null = null

  export function initialize(options: {
    persist: (jobs: CronTypes.CronJob[], runs: CronTypes.CronRun[]) => Promise<void>
    execute: (job: CronTypes.CronJob, reason: CronTypes.CronWakeReason) => Promise<string>
    checkIntervalMs?: number
  }): void {
    persistCallback = options.persist
    executeCallback = options.execute

    const checkInterval = options.checkIntervalMs ?? 60000 // 1 minute default

    const store = state()
    if (store.timer) {
      clearInterval(store.timer)
    }

    store.timer = setInterval(() => {
      void checkDueJobs()
    }, checkInterval)

    log.info("cron service initialized", { checkInterval })
  }

  export async function load(jobs: CronTypes.CronJob[], runs: CronTypes.CronRun[]): Promise<void> {
    const store = state()

    for (const job of jobs) {
      store.jobs.set(job.id, job)
    }

    for (const run of runs) {
      store.runs.set(run.id, run)
    }

    recalculateAllNextRuns()

    log.info("cron data loaded", { jobs: jobs.length, runs: runs.length })
  }

  export function create(input: CronTypes.CronJobInput): CronTypes.CronJob {
    const now = Date.now()
    const id = crypto.randomUUID()

    const job: CronTypes.CronJob = {
      id,
      name: input.name,
      description: input.description,
      schedule: input.schedule,
      prompt: input.prompt,
      agent: input.agent,
      sessionID: input.sessionID,
      status: "active",
      wakeMode: input.wakeMode,
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      failCount: 0,
    }

    job.nextRunAt = calculateNextRun(job.schedule, now)

    state().jobs.set(id, job)

    void persist()

    Bus.publish(JobCreatedEvent, { jobId: id, name: job.name, createdAt: now })

    log.info("cron job created", { id, name: job.name })

    return job
  }

  export function update(id: string, input: CronTypes.CronJobUpdate): CronTypes.CronJob {
    const store = state()
    const job = store.jobs.get(id)

    if (!job) {
      throw new Error(`Cron job "${id}" not found`)
    }

    const now = Date.now()

    if (input.name !== undefined) job.name = input.name
    if (input.description !== undefined) job.description = input.description
    if (input.schedule !== undefined) {
      job.schedule = input.schedule
      job.nextRunAt = calculateNextRun(job.schedule, now)
    }
    if (input.prompt !== undefined) job.prompt = input.prompt
    if (input.agent !== undefined) job.agent = input.agent
    if (input.sessionID !== undefined) job.sessionID = input.sessionID
    if (input.wakeMode !== undefined) job.wakeMode = input.wakeMode

    job.updatedAt = now

    void persist()

    Bus.publish(JobUpdatedEvent, { jobId: id, updatedAt: now })

    log.info("cron job updated", { id, name: job.name })

    return job
  }

  export function remove(id: string): void {
    const store = state()
    const job = store.jobs.get(id)

    if (!job) {
      throw new Error(`Cron job "${id}" not found`)
    }

    store.jobs.delete(id)

    // Clean up associated runs
    for (const [runId, run] of store.runs) {
      if (run.jobId === id) {
        store.runs.delete(runId)
      }
    }

    void persist()

    Bus.publish(JobRemovedEvent, { jobId: id, removedAt: Date.now() })

    log.info("cron job removed", { id, name: job.name })
  }

  export function get(id: string): CronTypes.CronJob | undefined {
    return state().jobs.get(id)
  }

  export function list(): CronTypes.CronJob[] {
    return Array.from(state().jobs.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  export function setStatus(id: string, status: CronTypes.CronJobStatus): void {
    const job = state().jobs.get(id)
    if (!job) {
      throw new Error(`Cron job "${id}" not found`)
    }

    job.status = status
    job.updatedAt = Date.now()

    if (status === "active") {
      job.nextRunAt = calculateNextRun(job.schedule, Date.now())
    } else {
      job.nextRunAt = undefined
    }

    void persist()

    Bus.publish(JobUpdatedEvent, { jobId: id, updatedAt: job.updatedAt })

    log.info("cron job status changed", { id, status })
  }

  export async function trigger(id: string, reason: CronTypes.CronWakeReason = "manual"): Promise<CronTypes.CronRun> {
    const job = state().jobs.get(id)
    if (!job) {
      throw new Error(`Cron job "${id}" not found`)
    }

    return executeJob(job, reason)
  }

  export async function wake(reason: CronTypes.CronWakeReason = "api"): Promise<{ triggered: number; jobs: string[] }> {
    const dueJobs = getDueJobs()
    const triggered: string[] = []

    for (const job of dueJobs) {
      try {
        await executeJob(job, reason)
        triggered.push(job.id)
      } catch (error) {
        log.error("failed to execute job during wake", { jobId: job.id, error })
      }
    }

    return { triggered: triggered.length, jobs: triggered }
  }

  export function getRuns(jobId?: string): CronTypes.CronRun[] {
    const runs = Array.from(state().runs.values())
    if (jobId) {
      return runs.filter((r) => r.jobId === jobId).sort((a, b) => b.startedAt - a.startedAt)
    }
    return runs.sort((a, b) => b.startedAt - a.startedAt)
  }

  export function getRun(id: string): CronTypes.CronRun | undefined {
    return state().runs.get(id)
  }

  export function getStatus(): {
    jobs: number
    active: number
    pendingRuns: number
    runningRuns: number
  } {
    const store = state()
    const jobs = Array.from(store.jobs.values())
    const runs = Array.from(store.runs.values())

    return {
      jobs: jobs.length,
      active: jobs.filter((j) => j.status === "active").length,
      pendingRuns: runs.filter((r) => r.status === "pending").length,
      runningRuns: runs.filter((r) => r.status === "running").length,
    }
  }

  async function checkDueJobs(): Promise<void> {
    const dueJobs = getDueJobs()

    for (const job of dueJobs) {
      try {
        await executeJob(job, "schedule")
      } catch (error) {
        log.error("failed to execute scheduled job", { jobId: job.id, error })
      }
    }
  }

  function getDueJobs(): CronTypes.CronJob[] {
    const now = Date.now()
    return Array.from(state().jobs.values()).filter((job) => {
      if (job.status !== "active") return false
      if (!job.nextRunAt) return false
      return job.nextRunAt <= now
    })
  }

  async function executeJob(job: CronTypes.CronJob, reason: CronTypes.CronWakeReason): Promise<CronTypes.CronRun> {
    const runId = crypto.randomUUID()
    const now = Date.now()

    const run: CronTypes.CronRun = {
      id: runId,
      jobId: job.id,
      status: "pending",
      startedAt: now,
    }

    state().runs.set(runId, run)

    log.info("cron job executing", { jobId: job.id, runId, reason })

    try {
      run.status = "running"

      if (!executeCallback) {
        throw new Error("Cron service not initialized with execute callback")
      }

      const output = await executeCallback(job, reason)

      run.status = "completed"
      run.finishedAt = Date.now()
      run.output = output

      job.runCount++
      job.lastRunAt = now
      job.nextRunAt = calculateNextRun(job.schedule, now)
    } catch (error) {
      run.status = "failed"
      run.finishedAt = Date.now()
      run.error = error instanceof Error ? error.message : String(error)

      job.failCount++
      job.lastRunAt = now
      job.nextRunAt = calculateNextRun(job.schedule, now)

      log.error("cron job execution failed", { jobId: job.id, runId, error })
    }

    void persist()

    Bus.publish(JobFinishedEvent, {
      jobId: job.id,
      runId,
      status: run.status,
      finishedAt: run.finishedAt ?? Date.now(),
    })

    return run
  }

  function calculateNextRun(schedule: string, fromTime: number): number | undefined {
    try {
      const interval = CronParser.parseExpression(schedule, {
        currentDate: new Date(fromTime),
      })
      const next = interval.next()
      return next.getTime()
    } catch (error) {
      log.error("failed to calculate next run", { schedule, error })
      return undefined
    }
  }

  function recalculateAllNextRuns(): void {
    const now = Date.now()
    for (const job of state().jobs.values()) {
      if (job.status === "active") {
        job.nextRunAt = calculateNextRun(job.schedule, job.lastRunAt ?? now)
      }
    }
  }

  async function persist(): Promise<void> {
    if (!persistCallback) return

    const store = state()
    const jobs = Array.from(store.jobs.values())
    const runs = Array.from(store.runs.values())

    try {
      await persistCallback(jobs, runs)
    } catch (error) {
      log.error("failed to persist cron data", { error })
    }
  }
}
