/**
 * /v1/replies router
 *
 * POST   /v1/replies                     — create and start a reply
 * GET    /v1/replies/:replyId            — retrieve reply
 * GET    /v1/replies/:replyId/stream     — SSE stream of ReplyEvents
 * POST   /v1/replies/:replyId/cancel     — cancel
 * GET    /v1/replies/:replyId/artifacts  — list artifacts for reply
 */

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import type { ReplyEvent } from "@allternit/replies-contract";
import {
  createReply,
  createRun,
  getReply,
  updateReply,
  updateRun,
  subscribe,
  dispatchEvent,
} from "./store.js";

export const repliesRouter = Router();

// ---------------------------------------------------------------------------
// POST /v1/replies — create and start
// ---------------------------------------------------------------------------

repliesRouter.post("/", (req, res) => {
  const { conversationId, model = "default", input } = req.body as {
    conversationId?: string;
    model?: string;
    input: unknown;
  };

  const replyId = uuidv4();
  const runId = uuidv4();
  const now = Date.now();

  const reply = {
    id: replyId,
    runId,
    conversationId,
    status: "streaming" as const,
    startedAt: now,
    items: [],
  };

  createReply(reply);
  createRun({
    id: runId,
    replyId,
    status: "running",
    provider: "in-memory",
    startedAt: now,
  });

  // Emit reply.started immediately
  const startEvent: ReplyEvent = {
    type: "reply.started",
    replyId,
    runId,
    conversationId,
    ts: now,
  };
  dispatchEvent(replyId, startEvent);

  res.status(201).json({ id: replyId, runId, status: "streaming", conversationId });
});

// ---------------------------------------------------------------------------
// GET /v1/replies/:replyId
// ---------------------------------------------------------------------------

repliesRouter.get("/:replyId", (req, res) => {
  const reply = getReply(req.params.replyId);
  if (!reply) return res.status(404).json({ error: "reply not found" });
  res.json(reply);
});

// ---------------------------------------------------------------------------
// GET /v1/replies/:replyId/stream — SSE
// ---------------------------------------------------------------------------

repliesRouter.get("/:replyId/stream", (req, res) => {
  const { replyId } = req.params;
  const reply = getReply(replyId);
  if (!reply) return res.status(404).json({ error: "reply not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: ReplyEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const unsub = subscribe(replyId, send);

  // If already complete, send a synthetic completed event and close
  if (reply.status === "complete" || reply.status === "failed") {
    const terminal: ReplyEvent =
      reply.status === "complete"
        ? { type: "reply.completed", replyId, runId: reply.runId, ts: reply.completedAt ?? Date.now() }
        : { type: "reply.failed", replyId, runId: reply.runId, error: reply.error ?? "unknown", ts: reply.completedAt ?? Date.now() };
    send(terminal);
    unsub();
    res.end();
    return;
  }

  req.on("close", () => {
    unsub();
  });
});

// ---------------------------------------------------------------------------
// POST /v1/replies/:replyId/cancel
// ---------------------------------------------------------------------------

repliesRouter.post("/:replyId/cancel", (req, res) => {
  const { replyId } = req.params;
  const reply = getReply(replyId);
  if (!reply) return res.status(404).json({ error: "reply not found" });

  const now = Date.now();
  updateReply(replyId, { status: "failed", error: "cancelled", completedAt: now });
  updateRun(reply.runId, { status: "cancelled", completedAt: now });

  const event: ReplyEvent = {
    type: "reply.failed",
    replyId,
    runId: reply.runId,
    error: "cancelled",
    ts: now,
  };
  dispatchEvent(replyId, event);

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /v1/replies/:replyId/artifacts — placeholder
// ---------------------------------------------------------------------------

repliesRouter.get("/:replyId/artifacts", (req, res) => {
  res.json({ artifacts: [] });
});
