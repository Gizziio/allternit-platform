import { eq } from "drizzle-orm"
import { Database } from "@/runtime/session/storage/db"
import { RuntimeExecutionLogTable } from "@/runtime/runtime.sql"
import { Log } from "@/shared/util/log"
import type { AgentEvent, ExecutionLog, TaskHandle } from "@/runtime/runtime-driver"

const log = Log.create({ service: "execution-log" })

export namespace ExecutionLogService {
  export async function create(handle: TaskHandle): Promise<void> {
    return Database.use(async (db) => {
      await db.insert(RuntimeExecutionLogTable).values({
        id: handle.taskId,
        task_id: handle.taskId,
        runtime_id: handle.runtimeId,
        cli_name: handle.cliName,
        status: "queued",
        events: [],
      })
    })
  }

  export async function appendEvent(taskId: string, event: AgentEvent): Promise<void> {
    return Database.use(async (db) => {
      const row = await db
        .select({ events: RuntimeExecutionLogTable.events })
        .from(RuntimeExecutionLogTable)
        .where(eq(RuntimeExecutionLogTable.task_id, taskId))
        .get()

      const events = (row?.events ?? []) as AgentEvent[]
      events.push(event)

      const update: Partial<typeof RuntimeExecutionLogTable.$inferInsert> = { events }

      if (event.type === "status") {
        update.status = event.status
        if (event.status === "running" && !events.some((e) => e.type === "status" && e.status === "running")) {
          update.started_at = Date.now()
        }
        if (event.status === "completed" || event.status === "failed" || event.status === "cancelled") {
          update.finished_at = Date.now()
        }
      }

      if (event.type === "finish") {
        if (event.usage) update.usage = toDbUsage(event.usage)
      }

      if (event.type === "error") {
        update.error_message = event.error instanceof Error ? event.error.message : String(event.error)
      }

      await db.update(RuntimeExecutionLogTable).set(update).where(eq(RuntimeExecutionLogTable.task_id, taskId))
    })
  }

  export async function get(taskId: string): Promise<ExecutionLog | undefined> {
    return Database.use(async (db) => {
      const row = await db
        .select()
        .from(RuntimeExecutionLogTable)
        .where(eq(RuntimeExecutionLogTable.task_id, taskId))
        .get()

      if (!row) return undefined

      return {
        taskId: row.task_id,
        runtimeId: row.runtime_id,
        cliName: row.cli_name,
        status: row.status as ExecutionLog["status"],
        startedAt: row.started_at ?? undefined,
        finishedAt: row.finished_at ?? undefined,
        events: (row.events ?? []) as AgentEvent[],
        usage: row.usage ? fromDbUsage(row.usage as any) : undefined,
        exitCode: row.exit_code ?? undefined,
        errorMessage: row.error_message ?? undefined,
      }
    })
  }

  export async function listByRuntime(runtimeId: string, limit = 100): Promise<ExecutionLog[]> {
    return Database.use(async (db) => {
      const rows = await db
        .select()
        .from(RuntimeExecutionLogTable)
        .where(eq(RuntimeExecutionLogTable.runtime_id, runtimeId))
        .orderBy(RuntimeExecutionLogTable.time_created)
        .limit(limit)
        .all()

      return rows.map((row) => ({
        taskId: row.task_id,
        runtimeId: row.runtime_id,
        cliName: row.cli_name,
        status: row.status as ExecutionLog["status"],
        startedAt: row.started_at ?? undefined,
        finishedAt: row.finished_at ?? undefined,
        events: (row.events ?? []) as AgentEvent[],
        usage: row.usage ? fromDbUsage(row.usage as any) : undefined,
        exitCode: row.exit_code ?? undefined,
        errorMessage: row.error_message ?? undefined,
      }))
    })
  }
}

function toDbUsage(usage: { inputTokens: number; outputTokens: number; totalTokens: number }) {
  return {
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
  }
}

function fromDbUsage(usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number }) {
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  }
}
