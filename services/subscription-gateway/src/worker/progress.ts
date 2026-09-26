// D11 — thin bridge: adapter progress/heartbeat events → ledger append, plus
// the per-task activity stamp the supervisor watchdog reads (§A8). The heavy
// lifting (extraction, heartbeat emission) lives in the SDK; this file only
// maps kinds and keeps last_change_at fresh.
import type { AdapterEvent } from "@allternit/subscription-fabric-contracts";
import type { EventLog } from "../events/log.js";
import type { StoredEvent } from "../store/queries.js";

export interface ActivityTracker {
  touch(taskId: string): void;
  lastChangeAt(taskId: string): number | null;
  forget(taskId: string): void;
}

export function createActivityTracker(now: () => number = () => Date.now()): ActivityTracker {
  const stamps = new Map<string, number>();
  return {
    touch(taskId) {
      stamps.set(taskId, now());
    },
    lastChangeAt(taskId) {
      return stamps.get(taskId) ?? null;
    },
    forget(taskId) {
      stamps.delete(taskId);
    },
  };
}

// Ledger kind is the event tag verbatim — EventKind already covers the full
// AdapterEvent union plus progress.heartbeat. artifact.partial previews are
// bytes; only their size is ledgered.
export function appendAdapterEvent(
  log: EventLog,
  task: { task_id: string; thread_id: string | null; requester: { id: string } },
  event: AdapterEvent,
  activity?: ActivityTracker
): StoredEvent {
  activity?.touch(task.task_id);
  const payload =
    event.t === "artifact.partial"
      ? {
          t: event.t,
          ref: event.ref,
          preview_bytes: event.preview ? event.preview.length : 0,
          thread_id: task.thread_id,
        }
      : { ...event, thread_id: task.thread_id };
  return log.append({
    task_id: task.task_id,
    kind: event.t,
    payload,
    callers: [task.requester.id],
  });
}
