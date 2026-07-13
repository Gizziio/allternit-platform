import { Hono } from "hono"
import { lazy } from "@/shared/util/lazy"
import { describeRoute, resolver, validator } from "@/runtime/server/openapi"
import {
  LocalTerminalBackend,
  SessionRegistry,
  doctor,
  selectVendor,
  type ExecutorMode,
  type SessionSpec,
} from "@allternit/orchestrator"
import z from "zod/v4"

const registry = new SessionRegistry(new LocalTerminalBackend())

const SlugSchema = z.object({ slug: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/) })
const SessionInputSchema = z.object({
  slug: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
  workdir: z.string().min(1),
  vendor: z.enum(["claude", "kimi", "codex", "agy"]),
  mode: z.enum(["interactive", "headless"]),
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

export const OrchestratorRoutes = lazy(() =>
  new Hono()
    .get(
      "/doctor",
      describeRoute({ summary: "Probe executor runtimes", operationId: "orchestrator.doctor", responses: response("Executor runtime report") }),
      async (c) => c.json(await doctor()),
    )
    .get(
      "/sessions",
      describeRoute({ summary: "List executor sessions", operationId: "orchestrator.sessions.list", responses: response("Registered executor sessions") }),
      (c) => c.json({ sessions: registry.list() }),
    )
    .post(
      "/assign",
      describeRoute({ summary: "Assign an executor asynchronously", operationId: "orchestrator.assign", responses: response("Spawned executor session") }),
      validator("json", SessionInputSchema),
      async (c) => {
        const input = c.req.valid("json")
        try {
          const spec = await sessionSpec(input)
          const session = await registry.assign(spec, input.mode === "interactive" ? input.prompt : undefined)
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
          const spec = await sessionSpec(input)
          const result = await registry.handoff(spec, input.mode === "interactive" ? input.prompt : undefined)
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
          return c.json({ slug, output: await registry.tail(slug, lines) })
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
          return c.json(await registry.sendMessage(slug, prompt))
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
          return c.json(await registry.watch(slug))
        } catch (error) {
          return errorResponse(c, error, 404)
        }
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
          await registry.kill(slug, { removeWorktree })
          return c.json({ success: true, slug })
        } catch (error) {
          return errorResponse(c, error, 404)
        }
      },
    ),
)
