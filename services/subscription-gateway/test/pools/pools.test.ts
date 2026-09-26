// §A4 — quota-pool state machine table tests (plan verify-list scenarios 3
// and 7, plus the signal-kind table and the rolling local-use window).
import { afterEach, describe, expect, it } from "vitest";
import type { QuotaPool, QuotaSignal } from "@allternit/subscription-fabric-contracts";
import {
  applySignal,
  applySignalToPool,
  cooldownMsForRung,
  effectiveState,
  getPoolMeta,
  MODEL_DOWNGRADE_WINDOW_MS,
  recordLocalUse,
  recordPoolSuccess,
} from "../../src/pools.js";
import { openDatabase, type Db } from "../../src/store/db.js";
import { getQuotaPool, upsertQuotaPool } from "../../src/store/queries.js";
import { makePool, makeSignal, NOW } from "../router/fixtures.js";

const MIN = 60_000;
const HOUR = 3_600_000;

function at(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}

describe("applySignal — signal kind → state (§A4)", () => {
  const soft: Array<QuotaSignal["kind"]> = ["limit_banner", "slow_mode", "counter_visible"];
  for (const kind of soft) {
    it(`${kind} → degraded (rung untouched)`, () => {
      const { pool, rung } = applySignal(makePool({ state: "available" }), makeSignal({ kind }), NOW, 2);
      expect(pool.state).toBe("degraded");
      expect(pool.last_signal?.kind).toBe(kind);
      expect(rung).toBe(2);
    });
  }

  it("reset_notice → unknown, never available, cooldown cleared", () => {
    const hot = makePool({ state: "cooling_down", cooldown_until: at(30 * MIN).toISOString() });
    const { pool } = applySignal(hot, makeSignal({ kind: "reset_notice" }), NOW);
    expect(pool.state).toBe("unknown");
    expect(pool.cooldown_until).toBeNull();
  });

  it("hard_error naming an ISO reset → exhausted until reset_at (error_message source)", () => {
    const resetIso = at(2 * HOUR).toISOString();
    const { pool, rung } = applySignal(
      makePool(),
      makeSignal({ raw_excerpt: `quota exhausted, try again after ${resetIso}` }),
      NOW,
      1
    );
    expect(pool.state).toBe("exhausted");
    expect(pool.reset_at).toBe(resetIso);
    expect(pool.reset_at_source).toBe("error_message");
    expect(rung).toBe(1); // named reset does not consume the ladder
  });

  it("hard_error naming a relative reset ('in 45 minutes') → exhausted until signal time + 45 m", () => {
    const { pool } = applySignal(
      makePool(),
      makeSignal({ raw_excerpt: "rate limit reached, retry in 45 minutes" }),
      NOW
    );
    expect(pool.state).toBe("exhausted");
    expect(Date.parse(pool.reset_at as string)).toBe(NOW.getTime() + 45 * MIN);
  });

  it("hard_error with no named reset → cooling_down on the ladder rung", () => {
    const { pool, rung } = applySignal(makePool(), makeSignal(), NOW, 0);
    expect(pool.state).toBe("cooling_down");
    expect(Date.parse(pool.cooldown_until as string)).toBe(NOW.getTime() + 30 * MIN);
    expect(rung).toBe(1);
  });

  it("model_downgraded → degraded with reset_at = signal time + 3 h (inferred)", () => {
    const { pool, rung } = applySignal(makePool(), makeSignal({ kind: "model_downgraded" }), NOW, 3);
    expect(pool.state).toBe("degraded");
    expect(Date.parse(pool.reset_at as string)).toBe(NOW.getTime() + MODEL_DOWNGRADE_WINDOW_MS);
    expect(pool.reset_at_source).toBe("inferred");
    expect(rung).toBe(3);
  });
});

describe("effectiveState — lazy expiry, recovery only ever to unknown (§A4)", () => {
  const cases: Array<[string, QuotaPool, number, QuotaPool["state"]]> = [
    ["cooling_down before cooldown_until", makePool({ state: "cooling_down", cooldown_until: at(30 * MIN).toISOString() }), 10 * MIN, "cooling_down"],
    ["cooling_down at cooldown_until → unknown", makePool({ state: "cooling_down", cooldown_until: at(30 * MIN).toISOString() }), 30 * MIN, "unknown"],
    ["cooling_down past cooldown_until → unknown", makePool({ state: "cooling_down", cooldown_until: at(30 * MIN).toISOString() }), 90 * MIN, "unknown"],
    ["exhausted before reset_at", makePool({ state: "exhausted", reset_at: at(HOUR).toISOString() }), 30 * MIN, "exhausted"],
    ["exhausted past reset_at → unknown", makePool({ state: "exhausted", reset_at: at(HOUR).toISOString() }), 2 * HOUR, "unknown"],
    ["exhausted with no reset_at stays exhausted", makePool({ state: "exhausted" }), 48 * HOUR, "exhausted"],
    ["degraded past reset_at (downgrade window lapsed) → unknown", makePool({ state: "degraded", reset_at: at(3 * HOUR).toISOString() }), 4 * HOUR, "unknown"],
    ["degraded with no reset_at stays degraded", makePool({ state: "degraded" }), 48 * HOUR, "degraded"],
    ["available/estimated/unknown pass through", makePool({ state: "estimated" }), 48 * HOUR, "estimated"],
  ];
  for (const [name, pool, advanceMs, expected] of cases) {
    it(name, () => {
      expect(effectiveState(pool, at(advanceMs))).toBe(expected);
      // §A4: expiry recovers to unknown — never available.
      expect(expected === "available").toBe(false);
    });
  }
});

describe("cooldown ladder (scenario 3): 30 m → 1 h → 2 h → 4 h, doubling, capped 24 h", () => {
  let db: Db | undefined;
  afterEach(() => db?.close());

  it("cooldownMsForRung matches the ladder and the cap", () => {
    const expected = [30 * MIN, HOUR, 2 * HOUR, 4 * HOUR, 8 * HOUR, 16 * HOUR, 24 * HOUR, 24 * HOUR, 24 * HOUR];
    expected.forEach((ms, rung) => expect(cooldownMsForRung(rung)).toBe(ms));
  });

  it("successive hard errors walk the ladder via persisted rungs; expiry → unknown", () => {
    db = openDatabase(":memory:");
    const key = "prov-a:acct-1:main-pool";
    let now = NOW;
    const expected = [30 * MIN, HOUR, 2 * HOUR, 4 * HOUR, 8 * HOUR, 16 * HOUR, 24 * HOUR, 24 * HOUR];
    for (const ms of expected) {
      const pool = applySignalToPool(db, key, "main-pool", makeSignal({ observed_at: now.toISOString() }), now);
      expect(pool.state).toBe("cooling_down");
      expect(Date.parse(pool.cooldown_until as string)).toBe(now.getTime() + ms);
      // Before the cooldown lapses the pool reads cooling_down…
      expect(effectiveState(pool, new Date(now.getTime() + ms - 1))).toBe("cooling_down");
      // …and once it lapses it recovers to unknown, not available.
      now = new Date(now.getTime() + ms);
      expect(effectiveState(getQuotaPool(db, key) as QuotaPool, now)).toBe("unknown");
    }
    expect(getPoolMeta(db, key).rung).toBe(expected.length);
  });

  it("a successful task after expiry resets the rung and recovers the pool", () => {
    db = openDatabase(":memory:");
    const key = "prov-a:acct-1:main-pool";
    let now = NOW;
    for (const _ of [0, 1]) {
      applySignalToPool(db, key, "main-pool", makeSignal({ observed_at: now.toISOString() }), now);
      now = at(HOUR);
    }
    expect(getPoolMeta(db, key).rung).toBe(2);
    now = new Date(now.getTime() + 25 * HOUR); // past every cooldown
    const pool = recordPoolSuccess(db, key, now);
    expect(getPoolMeta(db, key).rung).toBe(0);
    expect(pool?.state).toBe("available");
    expect(pool?.cooldown_until).toBeNull();
    // The next hard error starts the ladder from the bottom again.
    const again = applySignalToPool(db, key, "main-pool", makeSignal({ observed_at: now.toISOString() }), now);
    expect(Date.parse(again.cooldown_until as string)).toBe(now.getTime() + 30 * MIN);
  });

  it("success preserves a soft-signal degraded state (the banner really was shown)", () => {
    db = openDatabase(":memory:");
    const key = "prov-a:acct-1:main-pool";
    applySignalToPool(db, key, "main-pool", makeSignal({ kind: "limit_banner" }), NOW);
    const pool = recordPoolSuccess(db, key, NOW);
    expect(pool?.state).toBe("degraded");
    expect(pool?.last_signal?.kind).toBe("limit_banner");
  });
});

describe("recordLocalUse — rolling-window soft budget (§A4)", () => {
  let db: Db | undefined;
  afterEach(() => db?.close());

  it("counts within the window, anchors it, and restarts after it lapses", () => {
    db = openDatabase(":memory:");
    const key = "prov-a:acct-1:main-pool";
    upsertQuotaPool(db, makePool({ window: { kind: "rolling", seconds: 3600 } }));

    const first = recordLocalUse(db, key, NOW);
    expect(first?.local_used_in_window).toBe(1);
    expect(getPoolMeta(db, key).windowAnchor).toBe(NOW.toISOString());

    const second = recordLocalUse(db, key, at(30 * MIN));
    expect(second?.local_used_in_window).toBe(2);
    expect(getPoolMeta(db, key).windowAnchor).toBe(NOW.toISOString()); // window still open

    const third = recordLocalUse(db, key, at(61 * MIN));
    expect(third?.local_used_in_window).toBe(1); // lapsed window restarted
    expect(getPoolMeta(db, key).windowAnchor).toBe(at(61 * MIN).toISOString());
  });

  it("is a no-op when the pool row does not exist", () => {
    db = openDatabase(":memory:");
    expect(recordLocalUse(db, "prov-a:acct-1:nope", NOW)).toBeNull();
  });
});
