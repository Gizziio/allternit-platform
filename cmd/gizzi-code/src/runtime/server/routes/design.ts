import { Hono } from "hono"
import { describeRoute, resolver, validator } from "@/runtime/server/openapi"
import { errors } from "@/runtime/server/error"
import {
  readDesignAck,
  writeDesignAck,
  type DesignPromptAck,
} from "@/shared/utils/designPromptAck"
import z from "zod/v4"

// Local acknowledgement channel for `/design [prompt]` deep links. The studio
// (web surface or desktop design window) POSTs here when it applies an
// initialPrompt into the composer; the CLI reads the same receipt back to
// confirm pickup. Local file only — no external network surface.

const AckSchema = z.object({
  prompt: z.string().min(1).max(8_000),
  consumedAt: z.string().min(1).max(64),
  sessionId: z.string().max(128).optional(),
})

const AckResponseSchema = z.object({
  ok: z.boolean(),
  receipt: z.object({
    prompt: z.string(),
    consumedAt: z.string(),
    sessionId: z.string().optional(),
  }),
})

export const DesignRoutes = () =>
  new Hono()
    .post(
      "/ack",
      describeRoute({
        summary: "Report design-prompt consumption",
        description:
          "The A:// Studio reports that it applied a deep-linked /design prompt " +
          "into the composer. Persisted as a local receipt (~/.allternit/design-prompt-ack.json) " +
          "that the gizzi-code /design command reads to confirm pickup.",
        operationId: "design.ack",
        responses: {
          200: {
            description: "Receipt persisted",
            content: { "application/json": { schema: resolver(AckResponseSchema) } },
          },
          ...errors(400),
        },
      }),
      validator("json", AckSchema),
      async (c) => {
        const body = c.req.valid("json")
        const receipt: DesignPromptAck = {
          prompt: body.prompt,
          consumedAt: body.consumedAt,
          ...(body.sessionId ? { sessionId: body.sessionId } : {}),
        }
        await writeDesignAck(receipt)
        return c.json({ ok: true, receipt })
      },
    )
    .get(
      "/ack",
      describeRoute({
        summary: "Read the design-prompt acknowledgement receipt",
        description:
          "Returns the most recent /design prompt-consumption receipt, or 404 " +
          "when the studio has never reported one.",
        operationId: "design.ack.get",
        responses: {
          200: {
            description: "Current receipt",
            content: { "application/json": { schema: resolver(AckResponseSchema) } },
          },
          404: { description: "No receipt yet" },
        },
      }),
      async (c) => {
        const receipt = await readDesignAck()
        if (!receipt) return c.json({ error: "no design-prompt ack receipt yet" }, 404)
        return c.json({ ok: true, receipt })
      },
    )
