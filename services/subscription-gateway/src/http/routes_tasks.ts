// POST /v1/tasks, GET /v1/tasks/:id, POST /v1/tasks/:id/cancel.
// Full worker execution is later phases: tasks persist as `queued` and a
// `task.created` ledger event fanned out to the submitting caller.
import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  capabilityIdSchema,
  requesterSchema,
  taskConstraintsSchema,
  taskInputSchema,
  taskRoutingSchema,
  type Task,
} from "@allternit/subscription-fabric-contracts";
import {
  getTask,
  getTaskByIdempotency,
  insertTask,
  updateTaskStatus,
} from "../store/queries.js";
import { callerOf, requireScope, type GatewayDeps } from "./server.js";

const submitTaskSchema = z.object({
  capability: capabilityIdSchema,
  prompt: z.string().min(1),
  inputs: z.array(taskInputSchema).optional(),
  options: z.record(z.unknown()).optional(),
  routing: taskRoutingSchema.partial().optional(),
  constraints: taskConstraintsSchema.partial().optional(),
  priority: z.enum(["interactive", "normal", "background"]).optional(),
  thread_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  parent_task_id: z.string().nullable().optional(),
  idempotency_key: z.string().nullable().optional(),
  requester_kind: requesterSchema.shape.kind.optional(),
});

export function tasksRouter(deps: GatewayDeps): Router {
  const router = Router();

  router.post("/v1/tasks", requireScope("tasks:submit"), (req: Request, res: Response) => {
    const parsed = submitTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_task", detail: parsed.error.issues });
      return;
    }
    const body = parsed.data;
    const caller = callerOf(req);

    if (body.idempotency_key) {
      const existing = getTaskByIdempotency(deps.db, caller.caller_id, body.idempotency_key);
      if (existing) {
        res.status(200).json(existing);
        return;
      }
    }

    const now = new Date().toISOString();
    const task: Task = {
      task_id: randomUUID(),
      idempotency_key: body.idempotency_key ?? null,
      capability: body.capability,
      capability_version: 1,
      requester: { kind: body.requester_kind ?? "bot", id: caller.caller_id },
      thread_id: body.thread_id ?? null,
      project_id: body.project_id ?? null,
      parent_task_id: body.parent_task_id ?? null,
      prompt: body.prompt,
      inputs: body.inputs ?? [],
      options: body.options ?? {},
      routing: {
        mode: "auto",
        allow_fallback: true,
        allow_metered: false,
        allow_thread_migration: false,
        ...body.routing,
      },
      constraints: {
        sensitivity: "internal",
        deadline_at: null,
        max_metered_usd: null,
        required_export_format: null,
        ...body.constraints,
      },
      approval_id: null,
      priority: body.priority ?? "normal",
      status: "queued",
      status_detail: null,
      route_decision: null,
      attempts: [],
      result: null,
      error: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
    };
    insertTask(deps.db, task);
    deps.log.append({
      task_id: task.task_id,
      kind: "task.created",
      payload: {
        task_id: task.task_id,
        status: task.status,
        capability: task.capability,
        thread_id: task.thread_id,
      },
      callers: [caller.caller_id],
    });
    res.status(201).json(task);
  });

  router.get("/v1/tasks/:id", requireScope("tasks:read"), (req: Request, res: Response) => {
    const task = getTask(deps.db, req.params.id);
    if (!task) {
      res.status(404).json({ error: "task_not_found", task_id: req.params.id });
      return;
    }
    res.json(task);
  });

  router.post("/v1/tasks/:id/cancel", requireScope("tasks:submit"), (req: Request, res: Response) => {
    const task = getTask(deps.db, req.params.id);
    if (!task) {
      res.status(404).json({ error: "task_not_found", task_id: req.params.id });
      return;
    }
    if (task.status !== "queued" && task.status !== "needs_user") {
      res.status(409).json({ error: "not_cancellable", status: task.status });
      return;
    }
    const completedAt = new Date().toISOString();
    updateTaskStatus(deps.db, task.task_id, "cancelled", { completedAt });
    deps.log.append({
      task_id: task.task_id,
      kind: "task.status",
      payload: { task_id: task.task_id, status: "cancelled", thread_id: task.thread_id },
      callers: [task.requester.id],
    });
    res.json(getTask(deps.db, task.task_id));
  });

  return router;
}
