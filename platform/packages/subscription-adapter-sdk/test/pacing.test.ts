import { describe, expect, it } from "vitest";
import { PacingCapExceeded, createPacer } from "../src/index";
import type { PacingProfile } from "@allternit/subscription-fabric-contracts";

const base: PacingProfile = {
  min_action_gap_ms: [800, 2500],
  min_task_gap_s: 5,
  max_tasks_per_hour: 10,
  max_tasks_per_day: 40,
};

function fakeClock(start = 1_700_000_000_000) {
  let t = start;
  const sleeps: number[] = [];
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
    sleeps,
  };
}

function localTime(hour: number): number {
  return new Date(2026, 8, 26, hour, 0, 0).getTime();
}

describe("pacer (§A5)", () => {
  it("beforeAction sleeps a random gap inside min_action_gap_ms", async () => {
    const clock = fakeClock();
    const pacer = createPacer(base, { now: clock.now, rng: () => 0, sleep: clock.sleep });
    await pacer.beforeAction();
    expect(clock.sleeps).toEqual([800]);

    const clock2 = fakeClock();
    const pacer2 = createPacer(base, { now: clock2.now, rng: () => 1, sleep: clock2.sleep });
    await pacer2.beforeAction();
    expect(clock2.sleeps).toEqual([2500]);
  });

  it("beforeTask sleeps the remainder of min_task_gap_s since the last task", async () => {
    const clock = fakeClock();
    const pacer = createPacer(base, { now: clock.now, rng: () => 0, sleep: clock.sleep });
    await pacer.beforeTask();
    expect(clock.sleeps).toEqual([]);
    clock.advance(1000);
    await pacer.beforeTask();
    expect(clock.sleeps).toEqual([4000]);
  });

  it("throws PacingCapExceeded(tasks_per_hour) over the hourly cap", async () => {
    const clock = fakeClock();
    const pacer = createPacer(
      { ...base, min_task_gap_s: 0, max_tasks_per_hour: 2 },
      { now: clock.now, rng: () => 0, sleep: clock.sleep }
    );
    await pacer.beforeTask();
    await pacer.beforeTask();
    const err = await pacer.beforeTask().catch((e) => e);
    expect(err).toBeInstanceOf(PacingCapExceeded);
    expect(err.cap).toBe("tasks_per_hour");
    expect(err.retryAfterS).toBe(3600);
  });

  it("throws PacingCapExceeded(tasks_per_day) over the daily cap", async () => {
    const clock = fakeClock();
    const pacer = createPacer(
      { ...base, min_task_gap_s: 0, max_tasks_per_hour: 100, max_tasks_per_day: 1 },
      { now: clock.now, rng: () => 0, sleep: clock.sleep }
    );
    await pacer.beforeTask();
    const err = await pacer.beforeTask().catch((e) => e);
    expect(err).toBeInstanceOf(PacingCapExceeded);
    expect(err.cap).toBe("tasks_per_day");
  });

  it("rolling window: the hourly cap frees up after an hour", async () => {
    const clock = fakeClock();
    const pacer = createPacer(
      { ...base, min_task_gap_s: 0, max_tasks_per_hour: 1 },
      { now: clock.now, rng: () => 0, sleep: clock.sleep }
    );
    await pacer.beforeTask();
    await expect(pacer.beforeTask()).rejects.toThrow(PacingCapExceeded);
    clock.advance(3_600_001);
    await pacer.beforeTask();
  });

  it("quiet_hours blocks inside a midnight-wrapping window", async () => {
    const quiet: PacingProfile = { ...base, quiet_hours: [22, 6] };
    const night = fakeClock(localTime(2));
    const pacer = createPacer(quiet, { now: night.now, rng: () => 0, sleep: night.sleep });
    const err = await pacer.beforeTask().catch((e) => e);
    expect(err).toBeInstanceOf(PacingCapExceeded);
    expect(err.cap).toBe("quiet_hours");

    const morning = fakeClock(localTime(10));
    const pacer2 = createPacer(quiet, { now: morning.now, rng: () => 0, sleep: morning.sleep });
    await pacer2.beforeTask();
  });

  it("quiet_hours non-wrapping window blocks only inside it", async () => {
    const quiet: PacingProfile = { ...base, quiet_hours: [1, 5] };
    const inside = createPacer(quiet, {
      now: () => localTime(3),
      rng: () => 0,
      sleep: async () => {},
    });
    await expect(inside.beforeTask()).rejects.toThrow(PacingCapExceeded);
    const outside = createPacer(quiet, {
      now: () => localTime(6),
      rng: () => 0,
      sleep: async () => {},
    });
    await outside.beforeTask();
  });
});
