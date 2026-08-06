// @ts-nocheck
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "@/runtime/server/openapi"
import { streamSSE } from "hono/streaming"
import z from "zod/v4"
import { Sidecar } from "@/runtime/sidecar"
import { lazy } from "@/shared/util/lazy"
import { errors } from "@/runtime/server/error"

export const SidecarRoutes = lazy(() =>
  new Hono()
    .get(
      "/models",
      describeRoute({
        summary: "List installed local models",
        description:
          "Return all models currently installed in the embedded sidecar's isolated Ollama instance (embedded default + any custom GGUF pulls).",
        operationId: "sidecar.models.list",
        responses: {
          200: {
            description: "Installed models",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    models: z.array(
                      z.object({
                        tag: z.string(),
                        sizeBytes: z.number().optional(),
                      }),
                    ),
                  }),
                ),
              },
            },
          },
          ...errors(400, 502),
        },
      }),
      async (c) => {
        const models = await Sidecar.listInstalledModels()
        return c.json({ models })
      },
    )
    .get(
      "/models/search",
      describeRoute({
        summary: "Search HuggingFace for GGUF models",
        description:
          "Search HuggingFace's public model API for GGUF-tagged repos, ordered by downloads. No auth required for public repos.",
        operationId: "sidecar.models.search",
        responses: {
          200: {
            description: "Search results",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    models: z.array(
                      z.object({
                        repoId: z.string(),
                        downloads: z.number(),
                        likes: z.number(),
                      }),
                    ),
                  }),
                ),
              },
            },
          },
          ...errors(400, 502),
        },
      }),
      validator(
        "query",
        z.object({
          q: z.string().default(""),
          limit: z.coerce.number().int().min(1).max(50).default(20),
        }),
      ),
      async (c) => {
        const { q, limit } = c.req.valid("query")
        const models = await Sidecar.searchHuggingFace(q, limit)
        return c.json({ models })
      },
    )
    .post(
      "/models/install",
      describeRoute({
        summary: "Install a HuggingFace GGUF model",
        description:
          "Pull an arbitrary GGUF model into the sidecar's isolated Ollama instance via Ollama's native hf.co/<repo> support. Streams progress as server-sent events.",
        operationId: "sidecar.models.install",
        responses: {
          200: {
            description: "Install progress stream",
            content: {
              "text/event-stream": {
                schema: resolver(z.any()),
              },
            },
          },
          ...errors(400, 502),
        },
      }),
      validator(
        "json",
        z.object({
          repoId: z.string().min(1),
          quantTag: z.string().optional(),
        }),
      ),
      async (c) => {
        const { repoId, quantTag } = c.req.valid("json")

        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")

        return streamSSE(c, async (stream) => {
          const writeStatus = (payload: Record<string, unknown>) => {
            return stream.writeSSE({ data: JSON.stringify(payload) })
          }

          const result = await Sidecar.installCustomModel(
            repoId,
            quantTag,
            async (line) => {
              // Forward raw Ollama pull log lines; try to parse progress JSON.
              const trimmed = line.trim()
              if (!trimmed) return
              try {
                const parsed = JSON.parse(trimmed)
                await writeStatus(parsed)
              } catch {
                await writeStatus({ status: trimmed })
              }
            },
          )

          if (result.ok) {
            await writeStatus({ status: "success", tag: result.tag })
          } else {
            await writeStatus({ status: "error", error: result.error ?? "Install failed" })
          }
        })
      },
    )
    .delete(
      "/models/:tag",
      describeRoute({
        summary: "Remove an installed local model",
        description:
          "Delete a model from the sidecar's isolated Ollama instance by its full tag (e.g. 'hf.co/bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M').",
        operationId: "sidecar.models.remove",
        responses: {
          200: {
            description: "Removal result",
            content: {
              "application/json": {
                schema: resolver(z.object({ removed: z.boolean() })),
              },
            },
          },
          ...errors(400, 502),
        },
      }),
      validator("param", z.object({ tag: z.string().min(1) })),
      async (c) => {
        const { tag } = c.req.valid("param")
        const removed = await Sidecar.removeModel(tag)
        return c.json({ removed })
      },
    ),
)
