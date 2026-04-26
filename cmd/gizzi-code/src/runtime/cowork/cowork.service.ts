/**
 * Cowork Runtime Service
 *
 * Database-backed service for run orchestration.
 * Uses Drizzle ORM with Bun SQLite (via Database.use).
 */

import { eq, and, desc, sql, gte } from "drizzle-orm"
import { Database } from "@/runtime/session/storage/db"
import {
  RunTable,
  RunEventTable,
  ScheduleTable,
  ApprovalTable,
  CheckpointTable,
} from "@/runtime/cowork/cowork.sql"
import { Log } from "@/shared/util/log"
import { randomUUID } from "crypto"

const log = Log.create({ service: "cowork-service" })

// ============================================================================
// Types
// ============================================================================

export interface RunConfig {
  command?: string
  working_dir?: string
  env?: Record<string, string>
  runtime?: "shell" | "docker" | "vm"
  image?: string
  host?: string
  port?: number
  username?: string
  ssh_key?: string
  provider?: string
  region?: string
  instance_type?: string
  storage_gb?: number
}

export type RunMode = "local" | "vm" | "remote" | "cloud"
export type RunStatus =
  | "pending"
  | "planning"
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"

export interface Run {
  id: string
  name: string
  description?: string | null
  mode: RunMode
  status: RunStatus
  step_cursor?: string | null
  total_steps?: number | null
  completed_steps: number
  config?: RunConfig | null
  created_at: number
  updated_at: number
  started_at?: number | null
  completed_at?: number | null
  error_message?: string | null
}

export interface RunEvent {
  id: string
  run_id: string
  sequence: number
  event_type: string
  payload?: Record<string, unknown> | null
  created_at: number
}

export interface Schedule {
  id: string
  name: string
  enabled: boolean
  cron_expr: string
  natural_lang?: string | null
  next_run_at?: number | null
  run_count: number
  mode: RunMode
  job_template?: { command: string; working_dir?: string; env?: Record<string, string> } | null
  created_at: number
  updated_at: number
}

export interface Approval {
  id: string
  run_id: string
  step_cursor?: string | null
  status: "pending" | "approved" | "denied" | "timeout"
  priority: "low" | "medium" | "high"
  title: string
  description?: string | null
  action_type?: string | null
  action_params?: Record<string, unknown> | null
  reasoning?: string | null
  requested_by?: string | null
  responded_by?: string | null
  response_message?: string | null
  created_at: number
  updated_at: number
  responded_at?: number | null
}

export interface Checkpoint {
  id: string
  run_id: string
  name?: string | null
  description?: string | null
  step_cursor: string
  workspace_state?: Record<string, unknown> | null
  approval_state?: Record<string, unknown> | null
  context?: Record<string, unknown> | null
  resumable: boolean
  created_at: number
  updated_at: number
  restored_at?: number | null
}

// ============================================================================
// Event Streaming
// ============================================================================

const eventListeners = new Map<string, Set<(event: RunEvent) => void>>()

function getNextSequence(runId: string): number {
  return Database.use((db) => {
    const result = db
      .select({ maxSeq: sql<number>`COALESCE(MAX(${RunEventTable.sequence}), 0)` })
      .from(RunEventTable)
      .where(eq(RunEventTable.run_id, runId))
      .get()
    return (result?.maxSeq ?? 0) + 1
  })
}

function notifyListeners(event: RunEvent) {
  const listeners = eventListeners.get(event.run_id)
  if (!listeners) return
  for (const cb of listeners) {
    try {
      cb(event)
    } catch (e) {
      log.error("event listener error", { error: e })
    }
  }
}

export function subscribeToRunEvents(runId: string, callback: (event: RunEvent) => void): () => void {
  const set = eventListeners.get(runId) ?? new Set()
  set.add(callback)
  eventListeners.set(runId, set)
  return () => set.delete(callback)
}

// ============================================================================
// Run Service
// ============================================================================

export namespace RunService {
  export function list(options?: { status?: string; mode?: string; limit?: number }): Run[] {
    return Database.use((db) => {
      let query = db.select().from(RunTable).$dynamic()
      const conditions = []
      if (options?.status) conditions.push(eq(RunTable.status, options.status as RunStatus))
      if (options?.mode) conditions.push(eq(RunTable.mode, options.mode as RunMode))
      if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query
      query = query.orderBy(desc(RunTable.time_created)).limit(options?.limit ?? 20) as typeof query
      return query.all() as Run[]
    })
  }

  export function get(id: string): Run | undefined {
    return Database.use((db) => {
      const rows = db.select().from(RunTable).where(eq(RunTable.id, id)).all()
      return rows[0] as Run | undefined
    })
  }

  export function create(input: { name: string; mode: RunMode; config?: RunConfig; auto_start?: boolean }): Run {
    const id = `run-${randomUUID()}`
    const status: RunStatus = input.auto_start ? "queued" : "pending"
    const now = Date.now()

    Database.use((db) => {
      db.insert(RunTable).values({
        id,
        name: input.name,
        mode: input.mode,
        status,
        completed_steps: 0,
        config: input.config ?? {},
        time_created: now,
        time_updated: now,
      }).run()
    })

    return get(id)!
  }

  export function updateStatus(
    id: string,
    status: RunStatus,
    updates?: Partial<Pick<Run, "step_cursor" | "total_steps" | "completed_steps" | "error_message">>,
  ): Run | undefined {
    return Database.use((db) => {
      const setClause: any = { status, time_updated: Date.now() }
      if (updates?.step_cursor !== undefined) setClause.step_cursor = updates.step_cursor
      if (updates?.total_steps !== undefined) setClause.total_steps = updates.total_steps
      if (updates?.completed_steps !== undefined) setClause.completed_steps = updates.completed_steps
      if (updates?.error_message !== undefined) setClause.error_message = updates.error_message

      if (status === "running" && !get(id)?.started_at) {
        setClause.started_at = Date.now()
      }
      if (["completed", "failed", "cancelled"].includes(status)) {
        setClause.completed_at = Date.now()
      }

      db.update(RunTable).set(setClause).where(eq(RunTable.id, id)).run()
      return get(id)
    })
  }

  export function appendEvent(runId: string, eventType: string, payload?: Record<string, unknown>): RunEvent {
    const id = `evt-${randomUUID()}`
    const sequence = getNextSequence(runId)
    const now = Date.now()

    const event: RunEvent = {
      id,
      run_id: runId,
      sequence,
      event_type: eventType,
      payload: payload ?? {},
      created_at: now,
    }

    Database.use((db) => {
      db.insert(RunEventTable).values({
        id,
        run_id: runId,
        sequence,
        event_type: eventType,
        payload: payload ?? {},
        time_created: now,
      }).run()
    })

    notifyListeners(event)
    return event
  }

  export function getEvents(runId: string, options?: { limit?: number; cursor?: number }): RunEvent[] {
    return Database.use((db) => {
      let query = db.select().from(RunEventTable).where(eq(RunEventTable.run_id, runId)).$dynamic()
      if (options?.cursor) {
        query = query.where(gte(RunEventTable.sequence, options.cursor)) as typeof query
      }
      query = query.orderBy(desc(RunEventTable.sequence)).limit(options?.limit ?? 100) as typeof query
      return query.all() as RunEvent[]
    })
  }
}

// ============================================================================
// Schedule Service
// ============================================================================

export namespace ScheduleService {
  export function list(options?: { enabled?: boolean }): Schedule[] {
    return Database.use((db) => {
      let query = db.select().from(ScheduleTable).$dynamic()
      if (options?.enabled !== undefined) {
        query = query.where(eq(ScheduleTable.enabled, options.enabled ? 1 : 0)) as typeof query
      }
      return query.all() as Schedule[]
    })
  }

  export function get(id: string): Schedule | undefined {
    return Database.use((db) => {
      const rows = db.select().from(ScheduleTable).where(eq(ScheduleTable.id, id)).all()
      return rows[0] as Schedule | undefined
    })
  }

  export function create(input: {
    name: string
    cron_expr: string
    job_template: { command: string; working_dir?: string }
    enabled?: boolean
    mode?: RunMode
  }): Schedule {
    const id = `sched-${randomUUID()}`
    const now = Date.now()
    Database.use((db) => {
      db.insert(ScheduleTable).values({
        id,
        name: input.name,
        cron_expr: input.cron_expr,
        enabled: input.enabled ?? true ? 1 : 0,
        mode: input.mode ?? "local",
        job_template: input.job_template,
        time_created: now,
        time_updated: now,
      }).run()
    })
    return get(id)!
  }

  export function updateEnabled(id: string, enabled: boolean): void {
    Database.use((db) => {
      db.update(ScheduleTable)
        .set({ enabled: enabled ? 1 : 0, time_updated: Date.now() })
        .where(eq(ScheduleTable.id, id))
        .run()
    })
  }

  export function incrementRunCount(id: string): void {
    Database.use((db) => {
      db.update(ScheduleTable)
        .set({ run_count: sql`${ScheduleTable.run_count} + 1`, time_updated: Date.now() })
        .where(eq(ScheduleTable.id, id))
        .run()
    })
  }

  export function delete_(id: string): void {
    Database.use((db) => {
      db.delete(ScheduleTable).where(eq(ScheduleTable.id, id)).run()
    })
  }
}

// ============================================================================
// Approval Service
// ============================================================================

export namespace ApprovalService {
  export function list(options?: { run_id?: string; status?: string }): Approval[] {
    return Database.use((db) => {
      let query = db.select().from(ApprovalTable).$dynamic()
      const conditions = []
      if (options?.run_id) conditions.push(eq(ApprovalTable.run_id, options.run_id))
      if (options?.status) conditions.push(eq(ApprovalTable.status, options.status as Approval["status"]))
      if (conditions.length > 0) query = query.where(and(...conditions)) as typeof query
      return query.all() as Approval[]
    })
  }

  export function get(id: string): Approval | undefined {
    return Database.use((db) => {
      const rows = db.select().from(ApprovalTable).where(eq(ApprovalTable.id, id)).all()
      return rows[0] as Approval | undefined
    })
  }

  export function create(input: {
    run_id: string
    title: string
    priority?: Approval["priority"]
    description?: string
    action_type?: string
    action_params?: Record<string, unknown>
    reasoning?: string
    requested_by?: string
  }): Approval {
    const id = `appr-${randomUUID()}`
    const now = Date.now()
    Database.use((db) => {
      db.insert(ApprovalTable).values({
        id,
        run_id: input.run_id,
        title: input.title,
        priority: input.priority ?? "medium",
        description: input.description,
        action_type: input.action_type,
        action_params: input.action_params,
        reasoning: input.reasoning,
        requested_by: input.requested_by,
        status: "pending",
        time_created: now,
        time_updated: now,
      }).run()
    })
    return get(id)!
  }

  export function resolve(
    id: string,
    resolution: "approved" | "denied",
    opts?: { message?: string; responded_by?: string },
  ): Approval | undefined {
    return Database.use((db) => {
      db.update(ApprovalTable)
        .set({
          status: resolution,
          responded_by: opts?.responded_by ?? "user",
          response_message: opts?.message,
          time_responded: Date.now(),
          time_updated: Date.now(),
        })
        .where(eq(ApprovalTable.id, id))
        .run()
      return get(id)
    })
  }
}

// ============================================================================
// Checkpoint Service
// ============================================================================

export namespace CheckpointService {
  export function listForRun(runId: string): Checkpoint[] {
    return Database.use((db) => {
      return db.select().from(CheckpointTable).where(eq(CheckpointTable.run_id, runId)).all() as Checkpoint[]
    })
  }

  export function get(id: string): Checkpoint | undefined {
    return Database.use((db) => {
      const rows = db.select().from(CheckpointTable).where(eq(CheckpointTable.id, id)).all()
      return rows[0] as Checkpoint | undefined
    })
  }

  export function create(input: {
    run_id: string
    name?: string
    description?: string
    step_cursor?: string
  }): Checkpoint {
    const id = `ckpt-${randomUUID()}`
    const now = Date.now()
    const run = RunService.get(input.run_id)
    Database.use((db) => {
      db.insert(CheckpointTable).values({
        id,
        run_id: input.run_id,
        name: input.name,
        description: input.description,
        step_cursor: input.step_cursor ?? run?.step_cursor ?? "start",
        resumable: 1,
        time_created: now,
        time_updated: now,
      }).run()
    })
    return get(id)!
  }

  export function restore(id: string): Checkpoint | undefined {
    return Database.use((db) => {
      db.update(CheckpointTable)
        .set({ time_restored: Date.now(), time_updated: Date.now() })
        .where(eq(CheckpointTable.id, id))
        .run()
      return get(id)
    })
  }

  export function delete_(id: string): void {
    Database.use((db) => {
      db.delete(CheckpointTable).where(eq(CheckpointTable.id, id)).run()
    })
  }
}
