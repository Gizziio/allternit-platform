// §A7/D11 — in-process pub/sub hub for SSE fan-out. Delivery is queued per
// subscriber; a slow subscriber that accumulates more than QUEUE_CAP events
// drops oldest and receives a `gap` marker (D12: the durable outbox, not the
// hub, is the recovery path for anything dropped here).
import type { StoredEvent } from "../store/queries.js";

export const SSE_QUEUE_CAP = 1000;

export interface GapEvent {
  kind: "gap";
  task_id: string;
  dropped: number;
}

export type HubEvent = StoredEvent | GapEvent;

export interface Subscriber {
  // Returns false when the consumer is back-pressured; the hub keeps the
  // remainder queued and retries on the next publish.
  write(event: HubEvent): boolean;
  queue: HubEvent[];
  dropped: number;
}

export function createSubscriber(write: (event: HubEvent) => boolean): Subscriber {
  return { write, queue: [], dropped: 0 };
}

function flush(sub: Subscriber): void {
  while (sub.queue.length > 0) {
    if (sub.dropped > 0) {
      const next = sub.queue[0];
      const gap: GapEvent = {
        kind: "gap",
        task_id: "task_id" in next ? next.task_id : "",
        dropped: sub.dropped,
      };
      if (!sub.write(gap)) return;
      sub.dropped = 0;
    }
    if (!sub.write(sub.queue[0])) return;
    sub.queue.shift();
  }
}

export class SseHub {
  private channels = new Map<string, Set<Subscriber>>();

  subscribe(taskId: string, sub: Subscriber): () => void {
    return this.add(`task:${taskId}`, sub);
  }

  subscribeThread(threadId: string, sub: Subscriber): () => void {
    return this.add(`thread:${threadId}`, sub);
  }

  private add(channel: string, sub: Subscriber): () => void {
    let subs = this.channels.get(channel);
    if (!subs) {
      subs = new Set();
      this.channels.set(channel, subs);
    }
    subs.add(sub);
    return () => {
      subs.delete(sub);
      if (subs.size === 0) this.channels.delete(channel);
    };
  }

  publish(taskId: string, event: StoredEvent, threadId?: string | null): void {
    const targets = [this.channels.get(`task:${taskId}`)];
    if (threadId) targets.push(this.channels.get(`thread:${threadId}`));
    for (const subs of targets) {
      if (!subs) continue;
      for (const sub of subs) {
        if (sub.queue.length >= SSE_QUEUE_CAP) {
          sub.queue.shift();
          sub.dropped += 1;
        }
        sub.queue.push(event);
        flush(sub);
      }
    }
  }

  subscriberCount(taskId: string): number {
    return this.channels.get(`task:${taskId}`)?.size ?? 0;
  }
}
