import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod/v4"
import { VmSession } from "@/runtime/context/vm/vm-session"
import { Flag } from "@/runtime/context/flag/flag"
import { errors } from "@/runtime/server/error"
import { Instance } from "@/runtime/context/project/instance"

const VmSessionStateSchema = z.object({
  enabled: z.boolean(),
  vmBacked: z.boolean(),
  sessionId: z.string().optional(),
  workdir: z.string().optional(),
  apiUrl: z.string().optional(),
})

export function VmSessionRoutes() {
  return new Hono()
    // ── GET /vm-session/:sessionID — get current VM session state ────────
    .get(
      "/:sessionID",
      describeRoute({
        summary: "Get VM session state",
        description: "Get the current VM session state for a gizzi session.",
        operationId: "vm-session.get",
        responses: {
          200: {
            description: "VM session state",
            content: { "application/json": { schema: resolver(z.any()) } },
          },
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      (c) => {
        const { sessionID } = c.req.valid("param")
        const state = VmSession.get(sessionID)
        return c.json({
          enabled: state !== null,
          vmBacked: state?.vmBacked ?? false,
          available: VmSession.isEnabled(),
          sessionId: state?.sessionId,
          workdir: state?.workdir,
          apiUrl: state?.apiUrl,
        })
      },
    )

    // ── POST /vm-session/:sessionID/enable — provision a VM ──────────────
    .post(
      "/:sessionID/enable",
      describeRoute({
        summary: "Enable VM session",
        description: "Provision a VM for this gizzi session.",
        operationId: "vm-session.enable",
        responses: {
          200: {
            description: "VM session state",
            content: { "application/json": { schema: resolver(z.any()) } },
          },
          ...errors(400),
          ...errors(503),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      validator(
        "json",
        z
          .object({
            workdir: z.string().optional(),
            networkEnabled: z.boolean().optional(),
            cpuCores: z.number().optional(),
            memoryMb: z.number().optional(),
          })
          .optional(),
      ),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const opts = c.req.valid("json")
        if (!Flag.GIZZI_VM_API_URL) {
          return c.json({ error: "GIZZI_VM_API_URL is not configured" }, 503)
        }
        try {
          const state = await VmSession.provision(sessionID, {
            workdir: opts?.workdir ?? Instance.directory,
            networkEnabled: opts?.networkEnabled,
            cpuCores: opts?.cpuCores,
            memoryMb: opts?.memoryMb,
          })
          return c.json({ enabled: true, vmBacked: state.vmBacked, sessionId: state.sessionId, workdir: state.workdir })
        } catch (err) {
          return c.json({ error: err instanceof Error ? err.message : String(err) }, 503)
        }
      },
    )

    // ── POST /vm-session/:sessionID/disable — destroy the VM ─────────────
    .post(
      "/:sessionID/disable",
      describeRoute({
        summary: "Disable VM session",
        description: "Destroy the VM for this gizzi session.",
        operationId: "vm-session.disable",
        responses: {
          200: {
            description: "Disabled",
            content: { "application/json": { schema: resolver(z.any()) } },
          },
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        await VmSession.destroy(sessionID)
        return c.json({ enabled: false })
      },
    )

    // ── POST /vm-session/:sessionID/toggle — toggle VM on/off ────────────
    .post(
      "/:sessionID/toggle",
      describeRoute({
        summary: "Toggle VM session",
        description: "Toggle VM session on or off for a gizzi session.",
        operationId: "vm-session.toggle",
        responses: {
          200: {
            description: "New VM session state",
            content: { "application/json": { schema: resolver(z.any()) } },
          },
          ...errors(503),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        const existing = VmSession.get(sessionID)
        if (existing) {
          await VmSession.destroy(sessionID)
          return c.json({ enabled: false, vmBacked: false })
        }
        if (!Flag.GIZZI_VM_API_URL) {
          return c.json({ error: "GIZZI_VM_API_URL is not configured" }, 503)
        }
        try {
          const state = await VmSession.provision(sessionID, {
            workdir: Instance.directory,
          })
          return c.json({ enabled: true, vmBacked: state.vmBacked, sessionId: state.sessionId })
        } catch (err) {
          return c.json({ error: err instanceof Error ? err.message : String(err) }, 503)
        }
      },
    )

    // ── DELETE /vm-session/:sessionID — destroy (REST-style) ─────────────
    .delete(
      "/:sessionID",
      describeRoute({
        summary: "Destroy VM session",
        description: "Destroy the VM session (same as disable, REST-style).",
        operationId: "vm-session.destroy",
        responses: {
          200: {
            description: "Destroyed",
            content: { "application/json": { schema: resolver(z.any()) } },
          },
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const { sessionID } = c.req.valid("param")
        await VmSession.destroy(sessionID)
        return c.json({ destroyed: true, session_id: sessionID })
      },
    )
}
