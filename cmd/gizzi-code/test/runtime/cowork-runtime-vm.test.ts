import { beforeAll, afterEach, describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import path from "path"
import { Database } from "../../src/runtime/session/storage/db"
import { CoworkRuntime } from "../../src/runtime/cowork/cowork.runtime"
import { RunService } from "../../src/runtime/cowork/cowork.service"

// NOTE: the cowork migration (20260414094100_cowork_runtime) has no
// `--> statement-breakpoint` separators, so Database.applyMigrations only ever
// executes its first statement (cowork_run) on a fresh DB. Apply the cowork
// DDL directly here so the runtime under test sees the real schema.
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

describe("cowork runtime vm mode", () => {
  test("vm-mode run fails with a clear error instead of the dead vfkit path", async () => {
    const run = RunService.create({
      name: "vm-mode-proof",
      mode: "vm",
      config: { command: "echo hi" },
    })

    await CoworkRuntime.execute(run)

    const after = RunService.get(run.id)!
    expect(after.status).toBe("failed")
    expect(after.error_message).toContain("not supported by the in-process cowork runtime")
    // the old failure was `createVFKitManager is not a function` — make sure
    // the dead vfkit dynamic import is truly gone
    expect(after.error_message).not.toContain("createVFKitManager")
  })

  test("local-mode run without a command completes without executing anything", async () => {
    const run = RunService.create({ name: "local-noop-proof", mode: "local" })

    await CoworkRuntime.execute(run)

    const after = RunService.get(run.id)!
    expect(after.status).toBe("completed")
  })
})
