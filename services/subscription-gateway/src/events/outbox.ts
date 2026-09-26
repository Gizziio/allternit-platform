// D12 — durable per-caller outbox over the caller_outbox table. At-least-once
// delivery, idempotent on event_id: enqueue is INSERT OR IGNORE, re-ack is a
// no-op, and acked/delivered rows never replay.
import type { Db } from "../store/db.js";
import {
  outboxAck,
  outboxEnqueue,
  outboxFetchUndelivered,
  outboxMarkDelivered,
  type StoredEvent,
} from "../store/queries.js";

export interface DeliverOptions {
  // Only events after this one (ledger insertion order) — reconnect cursor.
  sinceEventId?: string;
  // Restrict delivery to one task (SSE per-task streams).
  taskId?: string;
  limit?: number;
}

export class CallerOutbox {
  constructor(private readonly db: Db) {}

  enqueue(event: StoredEvent, callerId: string): void {
    outboxEnqueue(this.db, event.event_id, [callerId]);
  }

  // Live-delivery confirmation: the event reached the consumer's transport.
  markDelivered(eventId: string, callerId: string): void {
    outboxMarkDelivered(this.db, eventId, callerId);
  }

  // Reconnect replay: everything never delivered, marked delivered as it is
  // handed out. Callers dedupe on event_id (at-least-once). A sinceEventId
  // cursor means "already received up to here": those rows are marked
  // delivered too, and only later events are handed out.
  deliverUndelivered(callerId: string, options: DeliverOptions = {}): StoredEvent[] {
    let events = outboxFetchUndelivered(this.db, callerId, options.limit ?? 1000);
    if (options.taskId) events = events.filter((e) => e.task_id === options.taskId);
    if (options.sinceEventId) {
      const cursor = events.findIndex((e) => e.event_id === options.sinceEventId);
      if (cursor >= 0) {
        for (const skipped of events.slice(0, cursor + 1)) {
          outboxMarkDelivered(this.db, skipped.event_id, callerId);
        }
        events = events.slice(cursor + 1);
      }
    }
    const delivered: StoredEvent[] = [];
    for (const event of events) {
      outboxMarkDelivered(this.db, event.event_id, callerId);
      delivered.push(event);
    }
    return delivered;
  }

  replay(callerId: string, options: DeliverOptions = {}): StoredEvent[] {
    return this.deliverUndelivered(callerId, options);
  }

  ack(callerId: string, eventId: string): void {
    outboxAck(this.db, eventId, callerId);
  }

  // D12 retention: acked rows older than `days` are pruned. Call site owns
  // scheduling (no timer here).
  pruneAckedOlderThan(days = 7): number {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = this.db
      .prepare("DELETE FROM caller_outbox WHERE acked_at IS NOT NULL AND acked_at < ?")
      .run(cutoff);
    return result.changes;
  }

  undeliveredCount(callerId: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) AS n FROM caller_outbox WHERE caller_id = ? AND delivered_at IS NULL"
      )
      .get(callerId) as { n: number };
    return row.n;
  }
}
