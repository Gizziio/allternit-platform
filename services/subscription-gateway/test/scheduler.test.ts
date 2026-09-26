// §A8 — scheduler priority/fairness table tests (pure, no I/O).
import { describe, expect, it } from "vitest";
import type { Task } from "@allternit/subscription-fabric-contracts";
import { createScheduler, queueKeyOf } from "../src/queue/scheduler.js";
import { sampleTask } from "./helpers.js";

function task(id: string, priority: Task["priority"], provider = "fixture-web", account = "acct-1"): Task {
  return sampleTask({
    task_id: id,
    priority,
    routing: {
      mode: "auto",
      provider: provider as Task["routing"]["provider"],
      account_id: account,
      allow_fallback: true,
      allow_metered: false,
      allow_thread_migration: false,
    },
  });
}

describe("scheduler", () => {
  it("dequeues interactive > normal > background regardless of insertion order", () => {
    const s = createScheduler();
    const cases: Array<[string, Task["priority"]]> = [
      ["b1", "background"],
      ["n1", "normal"],
      ["b2", "background"],
      ["i1", "interactive"],
      ["n2", "normal"],
      ["i2", "interactive"],
    ];
    for (const [id, p] of cases) s.enqueue(task(id, p));

    const order: string[] = [];
    let t: Task | null;
    while ((t = s.next("fixture-web", "acct-1"))) order.push(t.task_id);
    expect(order).toEqual(["i1", "i2", "n1", "n2", "b1", "b2"]);
  });

  it("never returns a background task while interactive/normal waits for the same worker", () => {
    const s = createScheduler();
    s.enqueue(task("bg", "background"));
    expect(s.peek("fixture-web", "acct-1")?.task_id).toBe("bg");
    s.enqueue(task("norm", "normal"));
    // background was queued first, but normal must win (§A8 fairness)
    expect(s.next("fixture-web", "acct-1")?.task_id).toBe("norm");
    s.enqueue(task("int", "interactive"));
    expect(s.next("fixture-web", "acct-1")?.task_id).toBe("int");
    expect(s.next("fixture-web", "acct-1")?.task_id).toBe("bg");
    expect(s.next("fixture-web", "acct-1")).toBeNull();
  });

  it("is FIFO within a priority lane", () => {
    const s = createScheduler();
    s.enqueue(task("n1", "normal"));
    s.enqueue(task("n2", "normal"));
    s.enqueue(task("n3", "normal"));
    expect(s.next("fixture-web", "acct-1")?.task_id).toBe("n1");
    expect(s.next("fixture-web", "acct-1")?.task_id).toBe("n2");
    expect(s.next("fixture-web", "acct-1")?.task_id).toBe("n3");
  });

  it("isolates queues per (provider, account_id)", () => {
    const s = createScheduler();
    s.enqueue(task("a1", "normal", "fixture-web", "acct-1"));
    s.enqueue(task("a2", "interactive", "fixture-web", "acct-2"));
    s.enqueue(task("a3", "normal", "other-fixture", "acct-1"));
    expect(s.next("fixture-web", "acct-2")?.task_id).toBe("a2");
    expect(s.next("other-fixture", "acct-1")?.task_id).toBe("a3");
    expect(s.next("fixture-web", "acct-1")?.task_id).toBe("a1");
    expect(s.size()).toBe(0);
  });

  it("peek is non-destructive; remove cancels a queued task", () => {
    const s = createScheduler();
    s.enqueue(task("t1", "normal"));
    s.enqueue(task("t2", "normal"));
    expect(s.peek("fixture-web", "acct-1")?.task_id).toBe("t1");
    expect(s.size("fixture-web", "acct-1")).toBe(2);
    expect(s.remove("t1")).toBe(true);
    expect(s.remove("t1")).toBe(false);
    expect(s.peek("fixture-web", "acct-1")?.task_id).toBe("t2");
    expect(s.remove("gone")).toBe(false);
  });

  it("rejects duplicate task_ids and keys unrouted tasks under the unrouted lane", () => {
    const s = createScheduler();
    const t1 = task("dup", "normal");
    s.enqueue(t1);
    expect(() => s.enqueue(t1)).toThrow(/already queued/);

    const unrouted = sampleTask({ task_id: "unrouted-1" });
    expect(queueKeyOf(unrouted)).toEqual({ provider: "unrouted", accountId: "unrouted" });
    s.enqueue(unrouted);
    expect(s.next("unrouted", "unrouted")?.task_id).toBe("unrouted-1");
  });
});
