import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendEvent, type StoredEvent } from "../src/store/queries.js";
import { createSubscriber, SSE_QUEUE_CAP, type GapEvent, type HubEvent } from "../src/events/sse.js";
import { cleanupDir, makeDeps, tmpStateDir, type TestDeps } from "./helpers.js";

let dir: string;
let deps: TestDeps;

beforeEach(() => {
  dir = tmpStateDir();
  deps = makeDeps(dir);
});

afterEach(() => {
  deps.cleanup();
  cleanupDir(dir);
});

function stored(taskId: string, n: number): StoredEvent {
  return appendEvent(deps.db, {
    taskId,
    callerId: "system",
    kind: "progress",
    payload: { n },
  });
}

describe("SseHub", () => {
  it("delivers published events to task subscribers", () => {
    const got: HubEvent[] = [];
    deps.hub.subscribe("t1", createSubscriber((e) => (got.push(e), true)));
    const ev = stored("t1", 1);
    deps.hub.publish("t1", ev);
    expect(got).toEqual([ev]);
  });

  it("per-thread subscription receives only that thread's events", () => {
    const got: HubEvent[] = [];
    deps.hub.subscribeThread("thread-1", createSubscriber((e) => (got.push(e), true)));
    const a = stored("t1", 1);
    const b = stored("t2", 2);
    deps.hub.publish("t1", a, "thread-1");
    deps.hub.publish("t2", b, "thread-2");
    expect(got).toEqual([a]);
  });

  it("unsubscribe stops delivery", () => {
    const got: HubEvent[] = [];
    const unsub = deps.hub.subscribe("t1", createSubscriber((e) => (got.push(e), true)));
    unsub();
    deps.hub.publish("t1", stored("t1", 1));
    expect(got).toEqual([]);
    expect(deps.hub.subscriberCount("t1")).toBe(0);
  });

  it("drops oldest beyond the queue cap for a stuck subscriber and emits a gap marker", () => {
    let writable = false;
    const got: HubEvent[] = [];
    deps.hub.subscribe(
      "t1",
      createSubscriber((e) => {
        if (!writable) return false;
        got.push(e);
        return true;
      })
    );
    const total = SSE_QUEUE_CAP + 5;
    for (let i = 1; i <= total; i++) deps.hub.publish("t1", stored("t1", i));
    expect(got).toEqual([]); // stuck consumer receives nothing

    writable = true;
    const last = stored("t1", total + 1);
    deps.hub.publish("t1", last); // triggers flush (and itself drops one more)

    const gap = got[0] as GapEvent;
    expect(gap.kind).toBe("gap");
    expect(gap.dropped).toBe(6);
    const events = got.slice(1) as StoredEvent[];
    expect(events).toHaveLength(SSE_QUEUE_CAP);
    expect((events[0].payload as { n: number }).n).toBe(7); // 1..6 dropped
    expect(events[events.length - 1]).toEqual(last);
  });
});

describe("EventLog fan-out", () => {
  it("appends to the ledger, outbox, and hub in one call", () => {
    const got: HubEvent[] = [];
    deps.hub.subscribe("t1", createSubscriber((e) => (got.push(e), true)));
    const ev = deps.log.append({
      task_id: "t1",
      kind: "progress",
      payload: { label: "working" },
      callers: ["bot-1", "bot-2"],
    });
    expect(ev.seq).toBe(1);
    expect(deps.outbox.undeliveredCount("bot-1")).toBe(1);
    expect(deps.outbox.undeliveredCount("bot-2")).toBe(1);
    expect(deps.outbox.undeliveredCount("bot-3")).toBe(0);
    expect(got).toEqual([ev]);
  });

  it("keeps seq monotonic per task across appends", () => {
    const a = deps.log.append({ task_id: "t1", kind: "progress", payload: {}, callers: [] });
    const b = deps.log.append({ task_id: "t1", kind: "progress.heartbeat", payload: { elapsed_s: 15 }, callers: [] });
    const c = deps.log.append({ task_id: "t2", kind: "progress", payload: {}, callers: [] });
    expect([a.seq, b.seq, c.seq]).toEqual([1, 2, 1]);
  });
});
