import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/runtime/session/storage/schema.sql"

export const RuntimeTable = sqliteTable(
  "runtime",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    host: text().notNull(),
    transport: text().notNull().$type<"local" | "websocket" | "uds">(),
    status: text().notNull().$type<"online" | "offline" | "busy">().default("offline"),
    last_heartbeat_at: integer(),
    registered_at: integer().notNull(),
    workspace_id: text(),
    metadata: text({ mode: "json" }).$type<{
      cwd?: string
      env?: Record<string, string>
      websocketUrl?: string
      udsSocket?: string
      token?: string
    }>(),
    ...Timestamps,
  },
  (table) => [
    index("runtime_status_idx").on(table.status),
    index("runtime_host_idx").on(table.host),
    index("runtime_workspace_idx").on(table.workspace_id),
    index("runtime_created_idx").on(table.time_created),
  ],
)

export const RuntimeCliTable = sqliteTable(
  "runtime_cli",
  {
    id: text().primaryKey(),
    runtime_id: text()
      .notNull()
      .references(() => RuntimeTable.id, { onDelete: "cascade" }),
    name: text().notNull(),
    path: text().notNull(),
    version: text().notNull(),
    provider_id: text(),
    icon: text().notNull(),
    discovered_at: integer().notNull(),
    ...Timestamps,
  },
  (table) => [
    index("runtime_cli_runtime_idx").on(table.runtime_id),
    index("runtime_cli_name_idx").on(table.name),
  ],
)

export const RuntimeExecutionLogTable = sqliteTable(
  "runtime_execution_log",
  {
    id: text().primaryKey(),
    task_id: text().notNull(),
    runtime_id: text()
      .notNull()
      .references(() => RuntimeTable.id, { onDelete: "cascade" }),
    cli_name: text().notNull(),
    status: text().notNull().$type<"queued" | "running" | "completed" | "failed" | "cancelled">().default("queued"),
    started_at: integer(),
    finished_at: integer(),
    events: text({ mode: "json" }).$type<Record<string, unknown>[]>(),
    usage: text({ mode: "json" }).$type<{
      input_tokens?: number
      output_tokens?: number
      total_tokens?: number
    }>(),
    exit_code: integer(),
    error_message: text(),
    ...Timestamps,
  },
  (table) => [
    index("runtime_execution_log_task_idx").on(table.task_id),
    index("runtime_execution_log_runtime_idx").on(table.runtime_id),
    index("runtime_execution_log_status_idx").on(table.status),
  ],
)
