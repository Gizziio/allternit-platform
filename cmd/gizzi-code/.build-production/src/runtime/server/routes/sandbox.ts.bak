import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod/v4"
import { SessionSandbox } from "@/runtime/context/sandbox/session-sandbox"
import { Sandbox } from "@/runtime/integrations/shell/sandbox"
import { errors } from "@/runtime/server/error"

const PolicyInput = z.object({
  allowWritePaths: z.string().array().optional(),
  allowNetwork: z.boolean().optional(),
})

const SandboxStateSchema = z.object({
  enabled: z.boolean(),
  driver: z.string(),
  policy: z.object({
    allowWritePaths: z.string().array(),
    allowNetwork: z.boolean(),
  }),
})

export function SandboxRoutes() {
  return new Hono()
    // ── GET /sandbox/:sessionID — get current state ──────────
    .get(
      "/:sessionID",
      describeRoute({
        summary: "Get sandbox state",
        description: "Get the current sandbox state for a session.",
        operationId: "sandbox.get",
        responses: {
          200: { description: "Sandbox state", content: { "application/json": { schema: resolver(z.any()) } } },
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      (c) => {
        const { sessionID } = c.req.valid("param")
        const state = SessionSandbox.get(sessionID)
        const driver = Sandbox.detect()
        return c.json({
          enabled: state?.enabled ?? false,
          driver,
          available: driver !== "none",
          policy: state?.policy ?? { allowWritePaths: [], allowNetwork: true },
        })
      },
    )

    // ── POST /sandbox/:sessionID/enable — enable sandbox ─────
    .post(
      "/:sessionID/enable",
      describeRoute({
        summary: "Enable sandbox",
        description: "Enable shell sandbox for a session.",
        operationId: "sandbox.enable",
        responses: {
          200: { description: "Sandbox enabled", content: { "application/json": { schema: resolver(z.any()) } } },
          ...errors(400),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      validator("json", PolicyInput.optional()),
      (c) => {
        const { sessionID } = c.req.valid("param")
        const policy = c.req.valid("json")
        if (Sandbox.detect() === "none") {
          return c.json({ error: "No sandbox driver available on this platform" }, 400)
        }
        const state = SessionSandbox.enable(sessionID, policy ?? undefined)
        return c.json(state)
      },
    )

    // ── POST /sandbox/:sessionID/disable — disable sandbox ───
    .post(
      "/:sessionID/disable",
      describeRoute({
        summary: "Disable sandbox",
        description: "Disable shell sandbox for a session.",
        operationId: "sandbox.disable",
        responses: {
          200: { description: "Sandbox disabled", content: { "application/json": { schema: resolver(z.any()) } } },
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        await SessionSandbox.disable(sessionID)
        return c.json({ enabled: false })
      },
    )

    // ── POST /sandbox/:sessionID/toggle — toggle sandbox ─────
    .post(
      "/:sessionID/toggle",
      describeRoute({
        summary: "Toggle sandbox",
        description: "Toggle shell sandbox on/off for a session.",
        operationId: "sandbox.toggle",
        responses: {
          200: { description: "New sandbox state", content: { "application/json": { schema: resolver(z.any()) } } },
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      validator("json", PolicyInput.optional()),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const policy = c.req.valid("json")
        const state = await SessionSandbox.toggle(sessionID, policy ?? undefined)
        return c.json(state)
      },
    )

    // ── PATCH /sandbox/:sessionID/policy — update policy ─────
    .patch(
      "/:sessionID/policy",
      describeRoute({
        summary: "Update sandbox policy",
        description: "Update network access or add write paths to an active sandbox.",
        operationId: "sandbox.policy",
        responses: {
          200: { description: "Updated policy", content: { "application/json": { schema: resolver(z.any()) } } },
          ...errors(404),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      validator("json", PolicyInput),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const { allowWritePaths, allowNetwork } = c.req.valid("json")
        const state = SessionSandbox.get(sessionID)
        if (!state) return c.json({ error: "Session sandbox not active" }, 404)
        if (allowWritePaths) {
          for (const p of allowWritePaths) SessionSandbox.allowWritePath(sessionID, p)
        }
        if (allowNetwork !== undefined) {
          SessionSandbox.setNetwork(sessionID, allowNetwork)
        }
        return c.json(SessionSandbox.get(sessionID))
      },
    )
}
