/**
 * Cowork Runtime API Routes
 *
 * REST API for run orchestration backed by SQLite/Drizzle.
 * Event streaming via SSE.
 */

import { Hono } from "hono"
import { describeRoute, validator, resolver } from "@/runtime/server/openapi"
import { streamSSE } from "hono/streaming"
import z from "zod/v4"
import { errors } from "@/runtime/server/error"
import { Log } from "@/shared/util/log"
import { RunService, ScheduleService, ApprovalService, CheckpointService, subscribeToRunEvents } from "@/runtime/cowork/cowork.service"
import { CoworkRuntime } from "@/runtime/cowork/cowork.runtime"
import type { RunEvent } from "@/runtime/cowork/cowork.service"

const log = Log.create({ service: "cowork-api" })

const RunModeSchema = z.enum(["local", "vm", "remote", "cloud"])
const RunStatusSchema = z.enum(["pending", "planning", "queued", "running", "paused", "completed", "failed", "cancelled"])

const RunSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mode: RunModeSchema,
  status: RunStatusSchema,
  step_cursor: z.string().optional(),
  total_steps: z.number().optional(),
  completed_steps: z.number(),
  config: z.record(z.any()).optional(),
  created_at: z.number(),
  started_at: z.number().optional(),
  completed_at: z.number().optional(),
  error_message: z.string().optional(),
})

const EventSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  sequence: z.number(),
  event_type: z.string(),
  payload: z.record(z.any()).optional(),
  created_at: z.number(),
})

const ScheduleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  cron_expr: z.string(),
  natural_lang: z.string().optional(),
  next_run_at: z.number().optional(),
  run_count: z.number(),
  mode: RunModeSchema,
  job_template: z.object({ command: z.string(), working_dir: z.string().optional() }).optional(),
})

const ApprovalSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  step_cursor: z.string().optional(),
  status: z.enum(["pending", "approved", "denied", "timeout"]),
  priority: z.enum(["low", "medium", "high"]),
  title: z.string(),
  description: z.string().optional(),
  action_type: z.string().optional(),
  action_params: z.record(z.any()).optional(),
  reasoning: z.string().optional(),
  requested_by: z.string().optional(),
  responded_by: z.string().optional(),
  response_message: z.string().optional(),
  created_at: z.number(),
  responded_at: z.number().optional(),
})

const CheckpointSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  step_cursor: z.string(),
  workspace_state: z.record(z.any()).optional(),
  approval_state: z.record(z.any()).optional(),
  context: z.record(z.any()).optional(),
  resumable: z.boolean(),
  created_at: z.number(),
  restored_at: z.number().optional(),
})

export function CoworkRoutes() {
  return (
    new Hono()
      // ── GET /runs ──
      .get(
        "/runs",
        describeRoute({
          summary: "List runs",
          operationId: "cowork.runs.list",
          responses: {
            200: { description: "List of runs", content: { "application/json": { schema: resolver(z.array(RunSchema)) } } },
          },
        }),
        validator("query", z.object({ status: z.string().optional(), mode: z.string().optional(), limit: z.coerce.number().default(20) })),
        (c) => {
          const { status, mode, limit } = c.req.valid("query")
          const runs = RunService.list({ status, mode, limit })
          return c.json(runs)
        },
      )

      // ── POST /runs ──
      .post(
        "/runs",
        describeRoute({
          summary: "Create run",
          operationId: "cowork.runs.create",
          responses: {
            200: { description: "Created run", content: { "application/json": { schema: resolver(RunSchema) } } },
            ...errors(400),
          },
        }),
        validator("json", z.object({ name: z.string(), mode: RunModeSchema.default("local"), config: z.record(z.any()).optional(), auto_start: z.boolean().default(true) })),
        async (c) => {
          const body = c.req.valid("json")
          const run = RunService.create({
            name: body.name,
            mode: body.mode,
            config: body.config as any,
            auto_start: body.auto_start,
          })

          if (body.auto_start) {
            setTimeout(() => CoworkRuntime.execute(run), 0)
          }

          return c.json(run)
        },
      )

      // ── GET /runs/:id ──
      .get(
        "/runs/:id",
        describeRoute({
          summary: "Get run",
          operationId: "cowork.runs.get",
          responses: {
            200: { description: "Run details", content: { "application/json": { schema: resolver(RunSchema) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          const run = RunService.get(id)
          if (!run) return c.json({ error: "Run not found" }, 404)
          return c.json(run)
        },
      )

      // ── POST /runs/:id/cancel ──
      .post(
        "/runs/:id/cancel",
        describeRoute({
          summary: "Cancel run",
          operationId: "cowork.runs.cancel",
          responses: {
            200: { description: "Run cancelled", content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          const run = RunService.get(id)
          if (!run) return c.json({ error: "Run not found" }, 404)
          RunService.updateStatus(id, "cancelled", { completed_at: Date.now() as any })
          RunService.appendEvent(id, "run_cancelled", { run_id: id })
          return c.json({ success: true })
        },
      )

      // ── POST /runs/:id/pause ──
      .post(
        "/runs/:id/pause",
        describeRoute({
          summary: "Pause run",
          operationId: "cowork.runs.pause",
          responses: {
            200: { description: "Run paused", content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          const run = RunService.get(id)
          if (!run) return c.json({ error: "Run not found" }, 404)
          if (run.status !== "running") return c.json({ error: "Run is not running" }, 400)
          RunService.updateStatus(id, "paused")
          RunService.appendEvent(id, "run_paused", { run_id: id })
          return c.json({ success: true })
        },
      )

      // ── POST /runs/:id/resume ──
      .post(
        "/runs/:id/resume",
        describeRoute({
          summary: "Resume run",
          operationId: "cowork.runs.resume",
          responses: {
            200: { description: "Run resumed", content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          const run = RunService.get(id)
          if (!run) return c.json({ error: "Run not found" }, 404)
          if (run.status !== "paused") return c.json({ error: "Run is not paused" }, 400)
          RunService.updateStatus(id, "running")
          RunService.appendEvent(id, "run_resumed", { run_id: id })
          setTimeout(() => CoworkRuntime.execute(run), 0)
          return c.json({ success: true })
        },
      )

      // ── GET /runs/:id/events ──
      .get(
        "/runs/:id/events",
        describeRoute({
          summary: "List run events",
          operationId: "cowork.runs.events.list",
          responses: {
            200: { description: "List of events", content: { "application/json": { schema: resolver(z.array(EventSchema)) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        validator("query", z.object({ limit: z.coerce.number().default(100), cursor: z.coerce.number().default(0) })),
        (c) => {
          const { id } = c.req.valid("param")
          const { limit, cursor } = c.req.valid("query")
          const runEvents = RunService.getEvents(id, { limit, cursor })
          return c.json(runEvents)
        },
      )

      // ── GET /runs/:id/events/stream ──
      .get(
        "/runs/:id/events/stream",
        describeRoute({
          summary: "Stream run events",
          operationId: "cowork.runs.events.stream",
          responses: {
            200: { description: "SSE stream of events" },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        validator("query", z.object({ cursor: z.coerce.number().default(0) })),
        async (c) => {
          const { id } = c.req.valid("param")
          const { cursor } = c.req.valid("query")
          if (!RunService.get(id)) return c.json({ error: "Run not found" }, 404)

          return streamSSE(c, async (stream) => {
            // Send historical events
            const historical = RunService.getEvents(id, { cursor })
            for (const event of historical) {
              await stream.write(`data: ${JSON.stringify(event)}\n\n`)
            }

            // Listen for new events
            let running = true
            const unsubscribe = subscribeToRunEvents(id, (event: RunEvent) => {
              if (!running) return
              stream.write(`data: ${JSON.stringify(event)}\n\n`).catch(() => {
                running = false
              })
            })

            c.req.raw.signal.addEventListener("abort", () => {
              running = false
              unsubscribe()
            })

            // Keep alive
            while (running) {
              await new Promise((r) => setTimeout(r, 1000))
              if (!running) break
              try {
                await stream.write(":\n\n")
              } catch {
                running = false
              }
            }
            unsubscribe()
          })
        },
      )

      // ── GET /runs/:id/checkpoints ──
      .get(
        "/runs/:id/checkpoints",
        describeRoute({
          summary: "List checkpoints",
          operationId: "cowork.runs.checkpoints.list",
          responses: {
            200: { description: "List of checkpoints", content: { "application/json": { schema: resolver(z.array(CheckpointSchema)) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          if (!RunService.get(id)) return c.json({ error: "Run not found" }, 404)
          return c.json(CheckpointService.listForRun(id))
        },
      )

      // ── POST /runs/:id/checkpoints ──
      .post(
        "/runs/:id/checkpoints",
        describeRoute({
          summary: "Create checkpoint",
          operationId: "cowork.runs.checkpoints.create",
          responses: {
            200: { description: "Created checkpoint", content: { "application/json": { schema: resolver(CheckpointSchema) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        validator("json", z.object({ name: z.string().optional(), description: z.string().optional() })),
        (c) => {
          const { id } = c.req.valid("param")
          const body = c.req.valid("json")
          if (!RunService.get(id)) return c.json({ error: "Run not found" }, 404)
          const checkpoint = CheckpointService.create({ run_id: id, name: body.name, description: body.description })
          return c.json(checkpoint)
        },
      )

      // ── POST /runs/:id/restore ──
      .post(
        "/runs/:id/restore",
        describeRoute({
          summary: "Restore checkpoint",
          operationId: "cowork.runs.restore",
          responses: {
            200: { description: "Run restored", content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        validator("json", z.object({ checkpoint_id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          const { checkpoint_id } = c.req.valid("json")
          const run = RunService.get(id)
          const checkpoint = CheckpointService.get(checkpoint_id)
          if (!run) return c.json({ error: "Run not found" }, 404)
          if (!checkpoint) return c.json({ error: "Checkpoint not found" }, 404)

          CheckpointService.restore(checkpoint_id)
          RunService.updateStatus(id, "paused", { step_cursor: checkpoint.step_cursor })
          RunService.appendEvent(id, "checkpoint_restored", { checkpoint_id, run_id: id })
          return c.json({ success: true })
        },
      )

      // ── GET /schedules ──
      .get(
        "/schedules",
        describeRoute({
          summary: "List schedules",
          operationId: "cowork.schedules.list",
          responses: {
            200: { description: "List of schedules", content: { "application/json": { schema: resolver(z.array(ScheduleSchema)) } } },
          },
        }),
        validator("query", z.object({ enabled: z.coerce.boolean().optional() })),
        (c) => {
          const { enabled } = c.req.valid("query")
          return c.json(ScheduleService.list({ enabled }))
        },
      )

      // ── POST /schedules ──
      .post(
        "/schedules",
        describeRoute({
          summary: "Create schedule",
          operationId: "cowork.schedules.create",
          responses: {
            200: { description: "Created schedule", content: { "application/json": { schema: resolver(ScheduleSchema) } } },
            ...errors(400),
          },
        }),
        validator("json", z.object({
          name: z.string(),
          cron_expr: z.string(),
          job_template: z.object({ command: z.string(), working_dir: z.string().optional() }),
          enabled: z.boolean().default(true),
          mode: RunModeSchema.default("local"),
        })),
        (c) => {
          const body = c.req.valid("json")
          const schedule = ScheduleService.create({
            name: body.name,
            cron_expr: body.cron_expr,
            job_template: body.job_template,
            enabled: body.enabled,
            mode: body.mode,
          })
          return c.json(schedule)
        },
      )

      // ── POST /schedules/:id/enable ──
      .post(
        "/schedules/:id/enable",
        describeRoute({
          summary: "Enable schedule",
          operationId: "cowork.schedules.enable",
          responses: {
            200: { description: "Schedule enabled", content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          if (!ScheduleService.get(id)) return c.json({ error: "Schedule not found" }, 404)
          ScheduleService.updateEnabled(id, true)
          return c.json({ success: true })
        },
      )

      // ── POST /schedules/:id/disable ──
      .post(
        "/schedules/:id/disable",
        describeRoute({
          summary: "Disable schedule",
          operationId: "cowork.schedules.disable",
          responses: {
            200: { description: "Schedule disabled", content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          if (!ScheduleService.get(id)) return c.json({ error: "Schedule not found" }, 404)
          ScheduleService.updateEnabled(id, false)
          return c.json({ success: true })
        },
      )

      // ── POST /schedules/:id/trigger ──
      .post(
        "/schedules/:id/trigger",
        describeRoute({
          summary: "Trigger schedule",
          operationId: "cowork.schedules.trigger",
          responses: {
            200: { description: "Schedule triggered", content: { "application/json": { schema: resolver(RunSchema) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        async (c) => {
          const { id } = c.req.valid("param")
          try {
            const run = await CoworkRuntime.triggerSchedule(id)
            return c.json(run)
          } catch (err: any) {
            return c.json({ error: err.message }, 404)
          }
        },
      )

      // ── DELETE /schedules/:id ──
      .delete(
        "/schedules/:id",
        describeRoute({
          summary: "Delete schedule",
          operationId: "cowork.schedules.delete",
          responses: {
            200: { description: "Schedule deleted", content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          if (!ScheduleService.get(id)) return c.json({ error: "Schedule not found" }, 404)
          ScheduleService.delete_(id)
          return c.json({ success: true })
        },
      )

      // ── GET /approvals ──
      .get(
        "/approvals",
        describeRoute({
          summary: "List approvals",
          operationId: "cowork.approvals.list",
          responses: {
            200: { description: "List of approvals", content: { "application/json": { schema: resolver(z.array(ApprovalSchema)) } } },
          },
        }),
        validator("query", z.object({ run_id: z.string().optional(), status: z.string().optional() })),
        (c) => {
          const { run_id, status } = c.req.valid("query")
          return c.json(ApprovalService.list({ run_id, status }))
        },
      )

      // ── GET /approvals/:id ──
      .get(
        "/approvals/:id",
        describeRoute({
          summary: "Get approval",
          operationId: "cowork.approvals.get",
          responses: {
            200: { description: "Approval details", content: { "application/json": { schema: resolver(ApprovalSchema) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          const approval = ApprovalService.get(id)
          if (!approval) return c.json({ error: "Approval not found" }, 404)
          return c.json(approval)
        },
      )

      // ── POST /approvals/:id/approve ──
      .post(
        "/approvals/:id/approve",
        describeRoute({
          summary: "Approve request",
          operationId: "cowork.approvals.approve",
          responses: {
            200: { description: "Approval granted", content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        validator("json", z.object({ message: z.string().optional() })),
        (c) => {
          const { id } = c.req.valid("param")
          const body = c.req.valid("json")
          const approval = ApprovalService.get(id)
          if (!approval) return c.json({ error: "Approval not found" }, 404)
          if (approval.status !== "pending") return c.json({ error: "Approval is not pending" }, 400)

          ApprovalService.resolve(id, "approved", { message: body.message, responded_by: "user" })
          RunService.appendEvent(approval.run_id, "approval_given", { approval_id: id, message: body.message })
          return c.json({ success: true })
        },
      )

      // ── POST /approvals/:id/deny ──
      .post(
        "/approvals/:id/deny",
        describeRoute({
          summary: "Deny request",
          operationId: "cowork.approvals.deny",
          responses: {
            200: { description: "Approval denied", content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        validator("json", z.object({ reason: z.string().optional() })),
        (c) => {
          const { id } = c.req.valid("param")
          const body = c.req.valid("json")
          const approval = ApprovalService.get(id)
          if (!approval) return c.json({ error: "Approval not found" }, 404)
          if (approval.status !== "pending") return c.json({ error: "Approval is not pending" }, 400)

          ApprovalService.resolve(id, "denied", { message: body.reason, responded_by: "user" })
          RunService.appendEvent(approval.run_id, "approval_denied", { approval_id: id, reason: body.reason })
          return c.json({ success: true })
        },
      )

      // ── DELETE /checkpoints/:id ──
      .delete(
        "/checkpoints/:id",
        describeRoute({
          summary: "Delete checkpoint",
          operationId: "cowork.checkpoints.delete",
          responses: {
            200: { description: "Checkpoint deleted", content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } } },
            ...errors(404),
          },
        }),
        validator("param", z.object({ id: z.string() })),
        (c) => {
          const { id } = c.req.valid("param")
          if (!CheckpointService.get(id)) return c.json({ error: "Checkpoint not found" }, 404)
          CheckpointService.delete_(id)
          return c.json({ success: true })
        },
      )
  )
}
