import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/runtime/session/storage/schema.sql"

export const RunTable = sqliteTable(
  "cowork_run",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text(),
    mode: text().notNull().$type<"local" | "remote" | "cloud">(),
    status: text().notNull().$type<
      | "pending"
      | "planning"
      | "queued"
      | "running"
      | "paused"
      | "completed"
      | "failed"
      | "cancelled"
    >(),
    step_cursor: text(),
    total_steps: integer(),
    completed_steps: integer().notNull().default(0),
    config: text({ mode: "json" }).$type<Record<string, unknown>>(),
    started_at: integer(),
    completed_at: integer(),
    error_message: text(),
    ...Timestamps,
  },
  (table) => [
    index("cowork_run_status_idx").on(table.status),
    index("cowork_run_mode_idx").on(table.mode),
    index("cowork_run_created_idx").on(table.time_created),
  ],
)

export const RunEventTable = sqliteTable(
  "cowork_run_event",
  {
    id: text().primaryKey(),
    run_id: text()
      .notNull()
      .references(() => RunTable.id, { onDelete: "cascade" }),
    sequence: integer().notNull(),
    event_type: text().notNull(),
    payload: text({ mode: "json" }).$type<Record<string, unknown>>(),
    time_created: integer().notNull().$default(() => Date.now()),
  },
  (table) => [
    index("cowork_event_run_idx").on(table.run_id),
    index("cowork_event_sequence_idx").on(table.sequence),
  ],
)

export const ScheduleTable = sqliteTable(
  "cowork_schedule",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    enabled: integer().notNull().default(1),
    cron_expr: text().notNull(),
    natural_lang: text(),
    next_run_at: integer(),
    run_count: integer().notNull().default(0),
    mode: text().notNull().$type<"local" | "remote" | "cloud">().default("local"),
    job_template: text({ mode: "json" }).$type<{
      command: string
      working_dir?: string
      env?: Record<string, string>
    }>(),
    ...Timestamps,
  },
  (table) => [
    index("cowork_schedule_enabled_idx").on(table.enabled),
    index("cowork_schedule_next_run_idx").on(table.next_run_at),
  ],
)

export const ApprovalTable = sqliteTable(
  "cowork_approval",
  {
    id: text().primaryKey(),
    run_id: text()
      .notNull()
      .references(() => RunTable.id, { onDelete: "cascade" }),
    step_cursor: text(),
    status: text().notNull().$type<"pending" | "approved" | "denied" | "timeout">().default("pending"),
    priority: text().notNull().$type<"low" | "medium" | "high">().default("medium"),
    title: text().notNull(),
    description: text(),
    action_type: text(),
    action_params: text({ mode: "json" }).$type<Record<string, unknown>>(),
    reasoning: text(),
    requested_by: text(),
    responded_by: text(),
    response_message: text(),
    time_responded: integer(),
    ...Timestamps,
  },
  (table) => [
    index("cowork_approval_run_idx").on(table.run_id),
    index("cowork_approval_status_idx").on(table.status),
  ],
)

export const CheckpointTable = sqliteTable(
  "cowork_checkpoint",
  {
    id: text().primaryKey(),
    run_id: text()
      .notNull()
      .references(() => RunTable.id, { onDelete: "cascade" }),
    name: text(),
    description: text(),
    step_cursor: text().notNull(),
    workspace_state: text({ mode: "json" }).$type<Record<string, unknown>>(),
    approval_state: text({ mode: "json" }).$type<Record<string, unknown>>(),
    context: text({ mode: "json" }).$type<Record<string, unknown>>(),
    resumable: integer().notNull().default(1),
    time_restored: integer(),
    ...Timestamps,
  },
  (table) => [index("cowork_checkpoint_run_idx").on(table.run_id)],
)
