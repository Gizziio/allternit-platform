import { beforeAll, afterEach, describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import path from "path"
import { Database } from "../../src/runtime/session/storage/db"
import {
  RunService,
  ScheduleService,
  ApprovalService,
  CheckpointService,
} from "../../src/runtime/cowork/cowork.service"

// NOTE: the cowork migration (20260414094100_cowork_runtime) has no
// `--> statement-breakpoint` separators, so Database.applyMigrations only ever
// executes its first statement (cowork_run) on a fresh DB. Apply the cowork
// DDL directly here so the service under test sees the real schema.
beforeAll(() => {
  const ddl = readFileSync(
    path.join(import.meta.dir, "../../migration/20260414094100_cowork_runtime/migration.sql"),
    "utf-8",
  )
  Database.use((db: any) => {
    const client = db.session.client as { exec: (sql: string) => void }
    for (const stmt of ddl.split(";\n")) {
      const trimmed = stmt.trim()
      if (!trimmed.startsWith("CREATE")) continue
      try {
        client.exec(trimmed)
      } catch {
        // cowork_run may already exist from the partial migration apply
      }
    }
  })
})

afterEach(() => {
  delete process.env.GIZZI_COWORK_STORE
  delete process.env.ALLTERNIT_COWORK_CANONICAL
})

describe("cowork service schema mapping", () => {
  test("run rows expose created_at/updated_at mapped from time_created/time_updated", () => {
    const run = RunService.create({ name: "map-run", mode: "local", config: { command: "echo hi" } })

    expect(typeof run.created_at).toBe("number")
    expect(typeof run.updated_at).toBe("number")
    expect(run).not.toHaveProperty("time_created")
    expect(run).not.toHaveProperty("time_updated")

    const fetched = RunService.get(run.id)!
    expect(typeof fetched.created_at).toBe("number")
    expect(fetched.mode).toBe("local")

    const listed = RunService.list({ status: "pending" })
    const mapped = listed.find((r) => r.id === run.id)!
    expect(typeof mapped.created_at).toBe("number")
    expect(mapped).not.toHaveProperty("time_created")
  })

  test("vm mode round-trips through the schema mode union", () => {
    const run = RunService.create({ name: "map-run-vm", mode: "vm" })
    expect(RunService.get(run.id)!.mode).toBe("vm")
  })

  test("run events expose created_at", () => {
    const run = RunService.create({ name: "map-run-evt", mode: "local" })
    const event = RunService.appendEvent(run.id, "run_started", { run_id: run.id })
    expect(typeof event.created_at).toBe("number")

    const events = RunService.getEvents(run.id)
    expect(events.length).toBeGreaterThan(0)
    expect(typeof events[0].created_at).toBe("number")
    expect(events[0]).not.toHaveProperty("time_created")
  })

  test("schedule rows map timestamps and the integer enabled flag", () => {
    const schedule = ScheduleService.create({
      name: "map-sched",
      cron_expr: "0 * * * *",
      job_template: { command: "echo hi" },
    })

    expect(schedule.enabled).toBe(true)
    expect(typeof schedule.created_at).toBe("number")
    expect(typeof schedule.updated_at).toBe("number")
    expect(schedule).not.toHaveProperty("time_created")

    const fetched = ScheduleService.get(schedule.id)!
    expect(fetched.enabled).toBe(true)
    expect(typeof fetched.created_at).toBe("number")
  })

  test("approval rows map responded_at on resolve", () => {
    const run = RunService.create({ name: "map-run-appr", mode: "local" })
    const approval = ApprovalService.create({ run_id: run.id, title: "approve?" })

    expect(typeof approval.created_at).toBe("number")
    expect(approval.responded_at ?? null).toBeNull()

    const resolved = ApprovalService.resolve(approval.id, "approved")!
    expect(resolved.status).toBe("approved")
    expect(typeof resolved.responded_at).toBe("number")
    expect(resolved).not.toHaveProperty("time_responded")

    const listed = ApprovalService.list({ run_id: run.id })
    expect(typeof listed[0].created_at).toBe("number")
  })

  test("checkpoint rows map restored_at and the integer resumable flag", () => {
    const run = RunService.create({ name: "map-run-ckpt", mode: "local" })
    const checkpoint = CheckpointService.create({ run_id: run.id, name: "ckpt" })

    expect(checkpoint.resumable).toBe(true)
    expect(typeof checkpoint.created_at).toBe("number")
    expect(checkpoint.restored_at ?? null).toBeNull()

    const restored = CheckpointService.restore(checkpoint.id)!
    expect(typeof restored.restored_at).toBe("number")
    expect(restored).not.toHaveProperty("time_restored")

    const listed = CheckpointService.listForRun(run.id)
    expect(listed[0].resumable).toBe(true)
    expect(typeof listed[0].created_at).toBe("number")
  })
})
