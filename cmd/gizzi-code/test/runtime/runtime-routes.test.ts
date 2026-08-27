import { describe, expect, test } from "bun:test"
import { createRuntimeRoutes } from "@/runtime/server/routes/runtime"
import type { RuntimeDriver, AgentEvent, ExecutionLog } from "@/runtime/runtime-driver"

const mockRuntime = {
  id: "rt-test",
  name: "test-runtime",
  host: "localhost",
  transport: "local" as const,
  status: "online" as const,
  registeredAt: Date.now(),
  agentClis: [{ name: "cursor-agent", path: "/bin/cursor-agent", version: "1.0.0", icon: "cursor" }],
}

const mockRuntimeWithToken = {
  ...mockRuntime,
  id: "rt-secure",
  metadata: { token: "secret-token" },
}

const mockDriver: RuntimeDriver = {
  async assign(task) {
    return { taskId: task.taskId, runtimeId: "rt-test", cliName: "cursor-agent" }
  },
  async *stream(handle): AsyncIterable<AgentEvent> {
    yield { type: "status", status: "running" }
    yield { type: "text_delta", delta: "hello" }
    yield { type: "finish", finishReason: "stop" }
  },
  async abort(handle) {},
  async inspect(handle): Promise<ExecutionLog> {
    return {
      taskId: handle.taskId,
      runtimeId: handle.runtimeId,
      cliName: handle.cliName,
      status: "running",
      events: [],
    } as ExecutionLog
  },
}

const makeDeps = (secure = false) => ({
  RuntimeService: {
    async list() {
      return [mockRuntime, ...(secure ? [mockRuntimeWithToken] : [])]
    },
    async get(id: string) {
      if (id === mockRuntime.id) return mockRuntime
      if (secure && id === mockRuntimeWithToken.id) return mockRuntimeWithToken
      return undefined
    },
    async remove(id: string) {
      return id === mockRuntime.id || (secure && id === mockRuntimeWithToken.id)
    },
    async heartbeat(id: string) {},
    async markBusy(id: string, busy: boolean) {},
  },
  ExecutionLogService: {
    async create(handle: { taskId: string; runtimeId: string; cliName: string }) {
      return undefined
    },
    async appendEvent(taskId: string, event: AgentEvent) {
      return undefined
    },
    async get(taskId: string): Promise<ExecutionLog | undefined> {
      return {
        taskId,
        runtimeId: mockRuntime.id,
        cliName: "cursor-agent",
        status: "running",
        events: [],
      } as ExecutionLog
    },
    async listByRuntime(runtimeId: string, limit: number) {
      return []
    },
  },
  RuntimeDriverFactory: {
    async forRuntime(runtimeId: string, cliName: string) {
      return mockDriver
    },
  },
})

describe("RuntimeRoutes integration", () => {
  test("GET / returns runtimes", async () => {
    const app = createRuntimeRoutes(makeDeps())
    const res = await app.request("/")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.runtimes).toHaveLength(1)
    expect(body.runtimes[0].id).toBe("rt-test")
  })

  test("POST /:runtimeID/tasks accepts attachments", async () => {
    const app = createRuntimeRoutes(makeDeps())
    const res = await app.request("/rt-test/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliName: "cursor-agent",
        prompt: "analyze this",
        attachments: [{ filename: "note.txt", mimeType: "text/plain", content: "attachment text" }],
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.handle).toBeDefined()
    expect(body.handle.cliName).toBe("cursor-agent")
  })

  test("GET /:runtimeID/tasks/:taskID/stream returns SSE", async () => {
    const app = createRuntimeRoutes(makeDeps())
    const res = await app.request("/rt-test/tasks/task-1/stream")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
    const text = await res.text()
    expect(text).toContain('"type":"status"')
    expect(text).toContain('"type":"text_delta"')
    expect(text).toContain('"type":"finish"')
    expect(text).toContain('"type":"stream-end"')
  })

  test("runtime token is required when configured", async () => {
    const app = createRuntimeRoutes(makeDeps(true))
    const res = await app.request("/rt-secure")
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("unauthorized")
  })

  test("runtime token accepts X-Runtime-Token header", async () => {
    const app = createRuntimeRoutes(makeDeps(true))
    const res = await app.request("/rt-secure", {
      headers: { "X-Runtime-Token": "secret-token" },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.runtime.id).toBe("rt-secure")
  })

  test("runtime token accepts ?token query param", async () => {
    const app = createRuntimeRoutes(makeDeps(true))
    const res = await app.request("/rt-secure?token=secret-token")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.runtime.id).toBe("rt-secure")
  })

  test("wrong runtime token is rejected", async () => {
    const app = createRuntimeRoutes(makeDeps(true))
    const res = await app.request("/rt-secure", {
      headers: { "X-Runtime-Token": "wrong-token" },
    })
    expect(res.status).toBe(401)
  })
})
