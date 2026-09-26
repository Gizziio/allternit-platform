// §A8/Critical #3 — detached watch polling: resume fires on the backoff
// schedule (doubling, 15 min cap); terminal polls stop the watch; cancel works.
import { describe, expect, it } from "vitest";
import type { ResumeToken } from "@allternit/subscription-fabric-contracts";
import { createWatchScheduler } from "../src/worker/detach.js";

function token(id: string): ResumeToken {
  return {
    token: id,
    adapter_id: "fixture-web",
    attempt_no: 1,
    issued_at: new Date().toISOString(),
    poll_after_s: 5,
  };
}

function fakeTimers() {
  let now = 0;
  const timers: Array<{ at: number; fn: () => void }> = [];
  return {
    setTimeoutFn: (fn: () => void, ms: number) => {
      const t = { at: now + ms, fn };
      timers.push(t);
      return t;
    },
    clearTimeoutFn: (h: unknown) => {
      const i = timers.indexOf(h as { at: number; fn: () => void });
      if (i >= 0) timers.splice(i, 1);
    },
    async advance(ms: number) {
      now += ms;
      for (;;) {
        const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers.splice(timers.indexOf(due), 1);
        due.fn();
        await new Promise((r) => setImmediate(r)); // flush the async poll chain
      }
    },
    pending: () => timers.length,
  };
}

describe("watch scheduler backoff", () => {
  it("fires resume on the doubling schedule and stops at a terminal poll", async () => {
    const timers = fakeTimers();
    const ws = createWatchScheduler({
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });
    const polls: number[] = [];
    ws.scheduleWatch(token("rt-1"), 5, async () => {
      polls.push(1);
      return polls.length >= 3; // terminal on the third poll
    });

    expect(polls).toHaveLength(0);
    await timers.advance(4_999);
    expect(polls).toHaveLength(0);
    await timers.advance(1); // t=5s
    expect(polls).toHaveLength(1);
    await timers.advance(9_999);
    expect(polls).toHaveLength(1);
    await timers.advance(1); // t=15s (5 + 10)
    expect(polls).toHaveLength(2);
    await timers.advance(20_000); // t=35s (15 + 20)
    expect(polls).toHaveLength(3);
    await timers.advance(60_000); // terminal → no further polls
    expect(polls).toHaveLength(3);
    expect(ws.pending()).toBe(0);
  });

  it("caps the backoff at 15 minutes", async () => {
    const timers = fakeTimers();
    const ws = createWatchScheduler({
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });
    const polls: number[] = [];
    ws.scheduleWatch(token("rt-cap"), 600, async () => {
      polls.push(1);
      return false;
    });
    await timers.advance(600_000); // first poll at 600 s
    expect(polls).toHaveLength(1);
    await timers.advance(899_999);
    expect(polls).toHaveLength(1);
    await timers.advance(1); // second poll at 600 + 900 (capped, not 1200)
    expect(polls).toHaveLength(2);
  });

  it("cancel stops future polls", async () => {
    const timers = fakeTimers();
    const ws = createWatchScheduler({
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });
    const polls: number[] = [];
    const handle = ws.scheduleWatch(token("rt-2"), 5, async () => {
      polls.push(1);
      return false;
    });
    await timers.advance(5_000);
    expect(polls).toHaveLength(1);
    handle.cancel();
    await timers.advance(60_000);
    expect(polls).toHaveLength(1);
    expect(ws.pending()).toBe(0);
  });

  it("a throwing poll reschedules instead of killing the watch (the stall watchdog owns failing the task)", async () => {
    const timers = fakeTimers();
    const ws = createWatchScheduler({
      setTimeoutFn: timers.setTimeoutFn,
      clearTimeoutFn: timers.clearTimeoutFn,
    });
    const polls: number[] = [];
    ws.scheduleWatch(token("rt-3"), 5, async () => {
      polls.push(1);
      throw new Error("transient watch failure");
    });
    await timers.advance(5_000);
    await timers.advance(10_000);
    expect(polls).toHaveLength(2);
  });
});
