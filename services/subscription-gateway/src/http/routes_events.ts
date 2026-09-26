// GET /v1/tasks/:id/events (SSE, §A7) + POST /v1/events/ack (D12).
// The stream starts with outbox replay for the requesting caller — a
// reconnected caller receives missed events before live ones, idempotent on
// event_id — then live hub events, with a heartbeat comment every 15 s.
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createSubscriber, type GapEvent, type HubEvent } from "../events/sse.js";
import type { StoredEvent } from "../store/queries.js";
import { callerOf, requireScope, type GatewayDeps } from "./server.js";

const HEARTBEAT_MS = 15_000;

const ackSchema = z.object({ event_ids: z.array(z.string()).max(1000) });

function isGap(event: HubEvent): event is GapEvent {
  return !("event_id" in event);
}

function writeSse(res: Response, event: HubEvent): boolean {
  if (isGap(event)) {
    return res.write(`event: gap\ndata: ${JSON.stringify({ dropped: event.dropped })}\n\n`);
  }
  return res.write(
    `id: ${event.event_id}\nevent: ${event.kind}\ndata: ${JSON.stringify(event.payload)}\n\n`
  );
}

export function eventsRouter(deps: GatewayDeps): Router {
  const router = Router();

  router.get("/v1/tasks/:id/events", requireScope("tasks:read"), (req: Request, res: Response) => {
    const caller = callerOf(req);
    const taskId = req.params.id;
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(": connected\n\n");

    // D12 replay first: missed events, marked delivered as handed out.
    for (const event of deps.outbox.replay(caller.caller_id, { taskId })) {
      writeSse(res, event);
    }

    // Live events: enqueue to the caller's outbox first (INSERT OR IGNORE),
    // then mark delivered only when the write succeeds — a dead connection
    // leaves the row undelivered for the next replay.
    const sub = createSubscriber((event) => {
      if (isGap(event)) return writeSse(res, event);
      deps.outbox.enqueue(event, caller.caller_id);
      const ok = writeSse(res, event);
      if (!ok) return false;
      deps.outbox.markDelivered(event.event_id, caller.caller_id);
      return true;
    });
    const unsubscribe = deps.hub.subscribe(taskId, sub);

    const heartbeat = setInterval(() => {
      res.write(": hb\n\n");
    }, HEARTBEAT_MS);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  });

  router.post("/v1/events/ack", requireScope("tasks:read"), (req: Request, res: Response) => {
    const parsed = ackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_ack", detail: parsed.error.issues });
      return;
    }
    const caller = callerOf(req);
    for (const eventId of parsed.data.event_ids) {
      deps.outbox.ack(caller.caller_id, eventId);
    }
    res.json({ acked: parsed.data.event_ids.length });
  });

  return router;
}
