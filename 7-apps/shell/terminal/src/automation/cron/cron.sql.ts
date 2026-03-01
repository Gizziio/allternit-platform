import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/storage/schema.sql"

export const CronJobTable = sqliteTable(
  "cron_job",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text(),
    schedule: text().notNull(), // cron expression
    prompt: text().notNull(),
    agent: text(),
    session_id: text(), // null = isolated run
    status: text().notNull().$type<"active" | "paused" | "disabled">(),
    wake_mode: text().notNull().$type<"main" | "isolated">(),
    last_run_at: integer(),
    next_run_at: integer(),
    run_count: integer().notNull().default(0),
    fail_count: integer().notNull().default(0),
    ...Timestamps,
  },
  (table) => [
    index("cron_job_status_idx").on(table.status),
    index("cron_job_next_run_idx").on(table.next_run_at),
  ],
)

export const CronRunTable = sqliteTable(
  "cron_run",
  {
    id: text().primaryKey(),
    job_id: text()
      .notNull()
      .references(() => CronJobTable.id, { onDelete: "cascade" }),
    run_id: text(), // links to RunRegistry if applicable
    session_id: text(),
    status: text().notNull().$type<"pending" | "running" | "completed" | "failed" | "aborted">(),
    started_at: integer().notNull(),
    finished_at: integer(),
    output: text(),
    error: text(),
  },
  (table) => [
    index("cron_run_job_idx").on(table.job_id),
    index("cron_run_status_idx").on(table.status),
    index("cron_run_started_idx").on(table.started_at),
  ],
)
