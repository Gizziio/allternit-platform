import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { lazy } from "@/shared/util/lazy"
import { describeRoute, resolver, validator } from "@/runtime/server/openapi"
import { bridgeOrchestrationEvent } from "@/runtime/server/rails-bridge"
import {
  LocalTerminalBackend,
  MuxBackend,
  SessionRegistry,
  TerminalControlBackend,
  doctor,
  probeLocalTerminal,
  probeMux,
  probeTerminalControl,
  selectVendor,
  type ExecutorMode,
  type ExecutorSession,
  type SessionSpec,
  type OrchestrationEvent,
  type SessionRecord,
} from "@allternit/orchestrator"
import z from "zod/v4"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

const localTerminalBackend = new LocalTerminalBackend()
const registries = {
  tmux: new SessionRegistry(localTerminalBackend),
  'terminal-control': new SessionRegistry(new TerminalControlBackend()),
  mux: new SessionRegistry(new MuxBackend()),
}
const statePath = process.env.GIZZI_ORCHESTRATOR_STATE_PATH ?? join(homedir(), ".allternit", "orchestrator-sessions.json")
const subscribers = new Set<(event: OrchestrationEvent) => void>()
let persistChain = Promise.resolve()

function allRecords(): SessionRecord[] {
  return Object.values(registries).flatMap((registry) => registry.records())
}

function persist(): void {
  persistChain = persistChain.then(async () => {
    await mkdir(dirname(statePath), { recursive: true })
    const temporary = `${statePath}.tmp`
    await writeFile(temporary, JSON.stringify({ version: 1, sessions: allRecords() }, null, 2), { mode: 0o600 })
    await rename(temporary, statePath)
  }).catch(() => undefined)
}

for (const registry of Object.values(registries)) {
  registry.onEvent((event) => {
    for (const subscriber of subscribers) subscriber(event)
    persist()
    const workdir = Object.values(registries).map((r) => r.get(event.slug)).find(Boolean)?.workdir
    void bridgeOrchestrationEvent(event, workdir)
  })
}

const ready = readFile(statePath, "utf8").then((content) => {
  const data = JSON.parse(content) as { version?: number; sessions?: SessionRecord[] }
  if (data.version !== 1 || !Array.isArray(data.sessions)) return
  for (const record of data.sessions) {
    const registry = record.session.backend === "local-pty"
      ? registries["terminal-control"]
      : record.session.backend === "mux"
        ? registries.mux
        : registries.tmux
    registry.restore(record)
  }
}).catch(() => undefined)

const SlugSchema = z.object({ slug: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/) })
const SessionInputSchema = z.object({
  slug: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
  workdir: z.string().min(1),
  vendor: z.enum(["claude", "kimi", "codex", "agy"]),
  mode: z.enum(["interactive", "headless"]),
  backend: z.enum(["tmux", "terminal-control", "mux"]).default("tmux"),
  isolation: z.enum(["worktree", "none"]).optional(),
  taskFile: z.string().min(1).optional(),
  notesFile: z.string().min(1),
  prompt: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().optional(),
  watchIntervalMs: z.number().int().positive().optional(),
})

function errorResponse(c: any, error: unknown, fallbackStatus: 400 | 404 | 409 | 500 = 400) {
  const message = error instanceof Error ? error.message : String(error)
  const status = message.startsWith("no session registered") ? 404 :
    message.includes("already registered") ? 409 : fallbackStatus
  return c.json({ error: "orchestrator_error", message }, status)
}

async function sessionSpec(input: z.infer<typeof SessionInputSchema>): Promise<SessionSpec> {
  const mode = input.mode as ExecutorMode
  const selected = await selectVendor([input.vendor], mode, mode === "headless" ? input.prompt : undefined)
  return {
    slug: input.slug,
    workdir: input.workdir,
    vendor: input.vendor,
    mode,
    launchCommand: selected.launchCommand,
    isolation: input.isolation,
    taskFile: input.taskFile,
    notesFile: input.notesFile,
    timeoutMs: input.timeoutMs,
    watchIntervalMs: input.watchIntervalMs,
  }
}

const response = (description: string) => ({
  200: { description, content: { "application/json": { schema: resolver(z.any()) } } },
})

function registryForSlug(slug: string): SessionRegistry {
  const registry = Object.values(registries).find((candidate) => candidate.get(slug))
  if (!registry) throw new Error(`no session registered for slug '${slug}'`)
  return registry
}

function registryOrNull(slug: string): SessionRegistry | null {
  return Object.values(registries).find((candidate) => candidate.get(slug)) ?? null
}

/** Transient record for a slug that only exists as an external ao-* tmux session. */
function externalSessionRecord(slug: string): ExecutorSession {
  return {
    sessionId: `external-${slug}`,
    slug,
    backend: "local-terminal",
    external: true,
    vendor: "kimi",
    mode: "interactive",
    state: "running",
    workdir: "",
    createdAt: new Date(0).toISOString(),
  }
}

function assertSlugAvailable(slug: string): void {
  if (Object.values(registries).some((registry) => registry.get(slug))) throw new Error(`slug '${slug}' is already registered`)
}

export const OrchestratorRoutes = lazy(() =>
  new Hono()
    .use(async (_c, next) => { await ready; return next() })
    .get(
      "/events",
      describeRoute({ summary: "Stream orchestration lifecycle events", operationId: "orchestrator.events", responses: response("Orchestration SSE stream") }),
      (c) => streamSSE(c, async (stream) => {
        const queue: OrchestrationEvent[] = []
        let wake: (() => void) | undefined
        const subscriber = (event: OrchestrationEvent) => { queue.push(event); wake?.(); wake = undefined }
        subscribers.add(subscriber)
        await stream.writeSSE({ event: "ready", data: JSON.stringify({ connected: true }) })
        try {
          while (!c.req.raw.signal.aborted) {
            if (queue.length === 0) await Promise.race([new Promise<void>((resolve) => { wake = resolve }), new Promise((resolve) => setTimeout(resolve, 15_000))])
            const event = queue.shift()
            if (event) await stream.writeSSE({ event: "orchestration", data: JSON.stringify(event) })
            else await stream.writeSSE({ event: "ping", data: "{}" })
          }
        } finally { subscribers.delete(subscriber) }
      }),
    )
    .get(
      "/doctor",
      describeRoute({ summary: "Probe executor runtimes", operationId: "orchestrator.doctor", responses: response("Executor runtime report") }),
      async (c) => c.json({ ...await doctor(), backends: { tmux: await probeLocalTerminal(), terminalControl: await probeTerminalControl(), mux: await probeMux() } }),
    )
    .get(
      "/sessions",
      describeRoute({ summary: "List executor sessions", operationId: "orchestrator.sessions.list", responses: response("Registered executor sessions") }),
      (c) => c.json({ sessions: Object.values(registries).flatMap((registry) => registry.list()) }),
    )
    .get(
      "/sessions/discovered",
      describeRoute({ summary: "Discover externally spawned ao-* tmux sessions", operationId: "orchestrator.sessions.discovered", responses: response("External executor sessions") }),
      async (c) => c.json({ sessions: await localTerminalBackend.discover() }),
    )
    .post(
      "/assign",
      describeRoute({ summary: "Assign an executor asynchronously", operationId: "orchestrator.assign", responses: response("Spawned executor session") }),
      validator("json", SessionInputSchema),
      async (c) => {
        const input = c.req.valid("json")
        try {
          assertSlugAvailable(input.slug)
          const spec = await sessionSpec(input)
          const session = await registries[input.backend].assign(spec, input.mode === "interactive" ? input.prompt : undefined)
          return c.json({ session })
        } catch (error) {
          return errorResponse(c, error)
        }
      },
    )
    .post(
      "/handoff",
      describeRoute({ summary: "Delegate and wait for review evidence", operationId: "orchestrator.handoff", responses: response("Completion report and actual footprint") }),
      validator("json", SessionInputSchema),
      async (c) => {
        const input = c.req.valid("json")
        try {
          assertSlugAvailable(input.slug)
          const spec = await sessionSpec(input)
          const result = await registries[input.backend].handoff(spec, input.mode === "interactive" ? input.prompt : undefined)
          return c.json(result)
        } catch (error) {
          return errorResponse(c, error)
        }
      },
    )
    .get(
      "/sessions/:slug",
      describeRoute({ summary: "Read executor session status", operationId: "orchestrator.sessions.status", responses: response("Executor session status") }),
      validator("param", SlugSchema),
      async (c) => {
        const { slug } = c.req.valid("param")
        const registry = registryOrNull(slug)
        if (!registry) {
          try {
            const session = externalSessionRecord(slug)
            const state = await localTerminalBackend.status(session)
            if (state === "dead") throw new Error(`no session registered for slug '${slug}'`)
            return c.json({ session: { ...session, state }, state })
          } catch (error) {
            return errorResponse(c, error, 404)
          }
        }
        try {
          return c.json({ session: registry.get(slug), state: await registry.status(slug) })
        } catch (error) {
          return errorResponse(c, error, 404)
        }
      },
    )
    .get(
      "/sessions/:slug/tail",
      describeRoute({ summary: "Read executor terminal output", operationId: "orchestrator.sessions.tail", responses: response("Executor terminal tail") }),
      validator("param", SlugSchema),
      validator("query", z.object({ lines: z.coerce.number().int().min(1).max(500).optional() })),
      async (c) => {
        const { slug } = c.req.valid("param")
        const { lines } = c.req.valid("query")
        try {
          const registry = registryOrNull(slug)
          const output = registry
            ? await registry.tail(slug, lines)
            : await localTerminalBackend.tail(externalSessionRecord(slug), lines)
          return c.json({ slug, output })
        } catch (error) {
          return errorResponse(c, error, 404)
        }
      },
    )
    .post(
      "/sessions/:slug/send",
      describeRoute({ summary: "Steer a running executor", operationId: "orchestrator.sessions.send", responses: response("Verified send result") }),
      validator("param", SlugSchema),
      validator("json", z.object({ prompt: z.string().min(1) })),
      async (c) => {
        const { slug } = c.req.valid("param")
        const { prompt } = c.req.valid("json")
        try {
          const registry = registryOrNull(slug)
          return c.json(
            registry
              ? await registry.sendMessage(slug, prompt)
              : await localTerminalBackend.send(externalSessionRecord(slug), prompt),
          )
        } catch (error) {
          return errorResponse(c, error, 404)
        }
      },
    )
    .post(
      "/sessions/:slug/watch",
      describeRoute({ summary: "Wait for executor completion evidence", operationId: "orchestrator.sessions.watch", responses: response("Completion outcome") }),
      validator("param", SlugSchema),
      async (c) => {
        const { slug } = c.req.valid("param")
        try {
          return c.json(await registryForSlug(slug).watch(slug))
        } catch (error) {
          return errorResponse(c, error, 404)
        }
      },
    )
    .post(
      "/sessions/:slug/review",
      describeRoute({ summary: "Accept or reject executor work", operationId: "orchestrator.sessions.review", responses: response("Recorded review decision") }),
      validator("param", SlugSchema),
      validator("json", z.object({ decision: z.enum(["accepted", "rejected"]), reason: z.string().min(1).optional() })),
      (c) => {
        const { slug } = c.req.valid("param")
        const { decision, reason } = c.req.valid("json")
        try { return c.json({ session: registryForSlug(slug).review(slug, decision, reason) }) }
        catch (error) { return errorResponse(c, error, 409) }
      },
    )
    .delete(
      "/sessions/:slug",
      describeRoute({ summary: "Kill an executor session", operationId: "orchestrator.sessions.kill", responses: response("Executor termination result") }),
      validator("param", SlugSchema),
      validator("query", z.object({ removeWorktree: z.enum(["true", "false"]).transform((value) => value === "true").optional() })),
      async (c) => {
        const { slug } = c.req.valid("param")
        const { removeWorktree } = c.req.valid("query")
        try {
          const registry = registryOrNull(slug)
          if (registry) await registry.kill(slug, { removeWorktree })
          else await localTerminalBackend.kill(externalSessionRecord(slug))
          return c.json({ success: true, slug })
        } catch (error) {
          return errorResponse(c, error, 404)
        }
      },
    ),
)
