import { BusEvent } from "@/shared/bus/bus-event"
import { Bus } from "@/shared/bus"
import { Instance } from "@/runtime/context/project/instance"
import { Log } from "@/shared/util/log"
import z from "zod/v4"

export namespace RunRegistry {
  const log = Log.create({ service: "run-registry" })

  export const RunStatus = z.enum([
    "pending",
    "running",
    "completed",
    "aborted",
    "errored",
  ])
  export type RunStatus = z.infer<typeof RunStatus>

  export const RunInfo = z.object({
    runId: z.string(),
    sessionID: z.string(),
    agent: z.string().optional(),
    status: RunStatus,
    prompt: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    finishedAt: z.number().optional(),
    error: z.string().optional(),
  })
  export type RunInfo = z.infer<typeof RunInfo>

  export const RunStartedEvent = BusEvent.define(
    "run.started",
    z.object({
      runId: z.string(),
      sessionID: z.string(),
      agent: z.string().optional(),
      prompt: z.string().optional(),
      createdAt: z.number(),
    })
  )

  export const RunUpdatedEvent = BusEvent.define(
    "run.updated",
    z.object({
      runId: z.string(),
      status: RunStatus,
      updatedAt: z.number(),
    })
  )

  export const RunFinishedEvent = BusEvent.define(
    "run.finished",
    z.object({
      runId: z.string(),
      sessionID: z.string(),
      status: RunStatus,
      finishedAt: z.number(),
      error: z.string().optional(),
    })
  )

  export const RunAbortedEvent = BusEvent.define(
    "run.aborted",
    z.object({
      runId: z.string(),
      sessionID: z.string(),
      abortedAt: z.number(),
    })
  )

  export const Events = {
    Started: RunStartedEvent,
    Updated: RunUpdatedEvent,
    Finished: RunFinishedEvent,
    Aborted: RunAbortedEvent,
  }

  type RunEntry = {
    info: RunInfo
    abortController: AbortController
    promise: Promise<unknown>
  }

  const state = Instance.state(() => {
    const runs = new Map<string, RunEntry>()
    return { runs }
  })

  export function create(
    sessionID: string,
    agent: string | undefined,
    prompt: string | undefined
  ): { runId: string; abortController: AbortController } {
    const runId = crypto.randomUUID()
    const now = Date.now()
    const abortController = new AbortController()

    const info: RunInfo = {
      runId,
      sessionID,
      agent,
      status: "pending",
      prompt,
      createdAt: now,
      updatedAt: now,
    }

    const entry: RunEntry = {
      info,
      abortController,
      promise: Promise.resolve(),
    }

    state().runs.set(runId, entry)

    log.info("run created", { runId, sessionID, agent })

    Bus.publish(RunStartedEvent, {
      runId,
      sessionID,
      agent,
      prompt,
      createdAt: now,
    })

    return { runId, abortController }
  }

  export function start(runId: string, promise: Promise<unknown>): void {
    const entry = state().runs.get(runId)
    if (!entry) {
      log.warn("run not found for start", { runId })
      return
    }

    entry.info.status = "running"
    entry.info.updatedAt = Date.now()
    entry.promise = promise

    log.info("run started", { runId, sessionID: entry.info.sessionID })

    Bus.publish(RunUpdatedEvent, {
      runId,
      status: "running",
      updatedAt: entry.info.updatedAt,
    })

    promise
      .then(() => {
        complete(runId, "completed")
      })
      .catch((error) => {
        complete(runId, "errored", error instanceof Error ? error.message : String(error))
      })
  }

  export function complete(runId: string, status: "completed" | "errored" | "aborted", error?: string): void {
    const entry = state().runs.get(runId)
    if (!entry) {
      log.warn("run not found for complete", { runId, status })
      return
    }

    const now = Date.now()
    entry.info.status = status
    entry.info.updatedAt = now
    entry.info.finishedAt = now
    if (error) entry.info.error = error

    log.info("run finished", { runId, status, sessionID: entry.info.sessionID })

    Bus.publish(RunUpdatedEvent, {
      runId,
      status,
      updatedAt: now,
    })

    Bus.publish(RunFinishedEvent, {
      runId,
      sessionID: entry.info.sessionID,
      status,
      finishedAt: now,
      error,
    })
  }

  export function abort(runId: string): boolean {
    const entry = state().runs.get(runId)
    if (!entry) {
      log.warn("run not found for abort", { runId })
      return false
    }

    if (entry.info.status === "completed" || entry.info.status === "errored" || entry.info.status === "aborted") {
      log.warn("run already finished", { runId, status: entry.info.status })
      return false
    }

    entry.abortController.abort()
    complete(runId, "aborted")

    Bus.publish(RunAbortedEvent, {
      runId,
      sessionID: entry.info.sessionID,
      abortedAt: Date.now(),
    })

    return true
  }

  export function get(runId: string): RunInfo | undefined {
    return state().runs.get(runId)?.info
  }

  export function getAbortController(runId: string): AbortController | undefined {
    return state().runs.get(runId)?.abortController
  }

  export function list(sessionID?: string): RunInfo[] {
    const all = Array.from(state().runs.values()).map((e) => e.info)
    if (sessionID) {
      return all.filter((r) => r.sessionID === sessionID)
    }
    return all
  }

  export function listActive(sessionID?: string): RunInfo[] {
    return list(sessionID).filter((r) => r.status === "pending" || r.status === "running")
  }

  export async function wait(runId: string): Promise<RunInfo> {
    const entry = state().runs.get(runId)
    if (!entry) {
      throw new Error(`Run not found: ${runId}`)
    }

    await entry.promise
    return entry.info
  }

  export function cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now()
    let cleaned = 0

    for (const [runId, entry] of state().runs) {
      const isFinished = entry.info.status === "completed" || entry.info.status === "errored" || entry.info.status === "aborted"
      const isOld = entry.info.updatedAt < now - maxAgeMs

      if (isFinished && isOld) {
        state().runs.delete(runId)
        cleaned++
      }
    }

    log.info("cleanup finished", { cleaned, remaining: state().runs.size })
    return cleaned
  }
}
