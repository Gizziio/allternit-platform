import { describe, expect, test, beforeEach } from "bun:test"
import path from "node:path"
import { LocalCliDriver } from "@/runtime/drivers/local-cli-driver"
import { RuntimeService } from "@/runtime/runtime-service"
import { Database } from "@/runtime/session/storage/db"
import { RuntimeTable, RuntimeCliTable, RuntimeExecutionLogTable } from "@/runtime/runtime.sql"
import { eq } from "drizzle-orm"
import { discoverLocalAgentClis } from "@/runtime/runtime-discovery"

const fixtureDir = path.join(import.meta.dir, "../fixture/agent-clis")

async function clearRuntimes() {
  await Database.use(async (db) => {
    await db.delete(RuntimeExecutionLogTable)
    await db.delete(RuntimeCliTable)
    await db.delete(RuntimeTable)
  })
}

async function registerMockRuntime(names: { id: string; binName: string; icon: string }[]) {
  const agentClis = names.map((n) => ({
    name: n.id,
    path: path.join(fixtureDir, n.binName),
    version: "mock-1.0.0",
    icon: n.icon,
  }))

  return RuntimeService.register(
    { host: "localhost-test", agentClis, discoveredAt: Date.now() },
    { name: "test-runtime" },
  )
}

describe("LocalCliDriver execution", () => {
  beforeEach(async () => {
    await clearRuntimes()
  })

  test("one-shot adapter executes a mock CLI and yields text", async () => {
    const registered = await registerMockRuntime([{ id: "kimi-cli", binName: "kimi", icon: "kimi" }])
    const driver = new LocalCliDriver(registered.id, "kimi-cli")

    const handle = await driver.assign({
      taskId: "task-kimi-1",
      prompt: "hello from test",
    })

    const events: any[] = []
    for await (const event of driver.stream(handle)) {
      events.push(event)
    }

    expect(events.some((e) => e.type === "status" && e.status === "running")).toBe(true)
    expect(events.some((e) => e.type === "text_delta" && e.delta.includes("hello from test"))).toBe(true)
    expect(events.some((e) => e.type === "status" && e.status === "completed")).toBe(true)
  })

  test("warm adapter executes a mock stream-json CLI and yields deltas", async () => {
    const registered = await registerMockRuntime([{ id: "claude-cli", binName: "claude", icon: "claude" }])
    const driver = new LocalCliDriver(registered.id, "claude-cli")

    const handle = await driver.assign({
      taskId: "task-claude-1",
      prompt: "warm test",
    })

    const events: any[] = []
    for await (const event of driver.stream(handle)) {
      events.push(event)
    }

    expect(events.some((e) => e.type === "status" && e.status === "running")).toBe(true)
    expect(events.some((e) => e.type === "text_delta" && e.delta.includes("Echo: warm test"))).toBe(true)
    expect(events.some((e) => e.type === "finish")).toBe(true)
    expect(events.some((e) => e.type === "status" && e.status === "completed")).toBe(true)
  })

  test("ACP adapter executes a mock ACP CLI and yields deltas", async () => {
    const registered = await registerMockRuntime([
      { id: "cursor-agent", binName: "cursor-agent", icon: "cursor" },
    ])
    const driver = new LocalCliDriver(registered.id, "cursor-agent")

    const handle = await driver.assign({
      taskId: "task-acp-1",
      prompt: "acp test",
    })

    const events: any[] = []
    for await (const event of driver.stream(handle)) {
      events.push(event)
    }

    expect(events.some((e) => e.type === "status" && e.status === "running")).toBe(true)
    expect(events.some((e) => e.type === "text_delta" && e.delta.includes("Mock ACP echo: acp test"))).toBe(true)
    expect(events.some((e) => e.type === "finish")).toBe(true)
    expect(events.some((e) => e.type === "status" && e.status === "completed")).toBe(true)
  })
})

describe("Runtime discovery", () => {
  test("discovers mock agent CLIs from a custom PATH", async () => {
    const originalPath = process.env.PATH
    process.env.PATH = fixtureDir + path.delimiter + (originalPath ?? "")
    try {
      const clis = await discoverLocalAgentClis()
      const byName = new Map(clis.map((c) => [c.name, c]))
      expect(byName.has("kimi-cli")).toBe(true)
      expect(byName.has("claude-cli")).toBe(true)
      expect(byName.has("cursor-agent")).toBe(true)
      for (const id of ["kimi-cli", "claude-cli", "cursor-agent"]) {
        const cli = byName.get(id)
        expect(cli?.path).toStartWith(fixtureDir)
        expect(cli?.version.length).toBeGreaterThan(0)
      }
    } finally {
      process.env.PATH = originalPath
    }
  })
})
