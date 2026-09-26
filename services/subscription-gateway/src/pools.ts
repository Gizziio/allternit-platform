// §A4 — quota-pool state machine. Pure transition functions (applySignal,
// effectiveState) plus the SQLite-backed composition the worker boundary uses
// (applySignalToPool, recordLocalUse, recordPoolSuccess). The contract's
// QuotaPool has no cooldown-rung or window-anchor field, so that rung state
// lives in the gateway-local quota_pool_meta table and is passed in.
//
// Recovery is only ever back to `unknown` — never `available` — except when a
// real task succeeds (§A4: "never trust without a real task"; a completed task
// IS the real task). No active probing anywhere.
import type { QuotaPool, QuotaSignal } from "@allternit/subscription-fabric-contracts";
import type { Db } from "./store/db.js";
import { getQuotaPool, upsertQuotaPool } from "./store/queries.js";

// §A4 cooldown ladder: 30 m → 1 h → 2 h → 4 h, doubling, capped at 24 h.
const LADDER_BASE_MS = [30, 60, 120, 240].map((m) => m * 60_000);
const COOLDOWN_CAP_MS = 24 * 3_600_000;

export function cooldownMsForRung(rung: number): number {
  if (rung < 0) return LADDER_BASE_MS[0];
  if (rung < LADDER_BASE_MS.length) return LADDER_BASE_MS[rung];
  return Math.min(LADDER_BASE_MS[LADDER_BASE_MS.length - 1] * 2 ** (rung - LADDER_BASE_MS.length + 1), COOLDOWN_CAP_MS);
}

// §A4 model_downgraded default window when the signal names no reset time.
export const MODEL_DOWNGRADE_WINDOW_MS = 3 * 3_600_000;

// Best-effort reset_at extraction from a provider error/banner excerpt:
// an ISO-8601 timestamp, or a relative "in 45 minutes" / "in 2 hours".
export function parseResetAt(rawExcerpt: string, signalTime: Date): Date | null {
  const iso = /\b(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\b/.exec(rawExcerpt);
  if (iso) {
    const parsed = Date.parse(iso[1].replace(" ", "T"));
    if (Number.isFinite(parsed)) return new Date(parsed);
  }
  const rel = /\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|h)\b/i.exec(rawExcerpt)
    ?? /\b(\d+)\s*(minutes?|mins?|hours?|hrs?|h)\s+from\s+now\b/i.exec(rawExcerpt);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms = unit.startsWith("h") ? n * 3_600_000 : n * 60_000;
    return new Date(signalTime.getTime() + ms);
  }
  return null;
}

export interface PoolTransition {
  pool: QuotaPool;
  rung: number;
}

// §A4 literal: one signal in, one pool state out. `rung` is the current
// cooldown-ladder rung (gateway-local state, see quota_pool_meta).
export function applySignal(
  pool: QuotaPool,
  signal: QuotaSignal,
  now: Date,
  rung = 0
): PoolTransition {
  const observed = Date.parse(signal.observed_at);
  const signalTime = Number.isFinite(observed) ? new Date(observed) : now;
  const base: QuotaPool = { ...pool, last_signal: signal, updated_at: now.toISOString() };

  switch (signal.kind) {
    case "limit_banner":
    case "slow_mode":
    case "counter_visible":
      // Soft signal → degraded; interactive work may continue, background skips.
      return { pool: { ...base, state: "degraded" }, rung };

    case "reset_notice":
      // §A4: a notice is never trusted on its own — back to unknown, NOT available.
      return { pool: { ...base, state: "unknown", cooldown_until: null }, rung };

    case "model_downgraded": {
      const parsed = parseResetAt(signal.raw_excerpt, signalTime);
      const resetAt = parsed ?? new Date(signalTime.getTime() + MODEL_DOWNGRADE_WINDOW_MS);
      return {
        pool: {
          ...base,
          state: "degraded",
          reset_at: resetAt.toISOString(),
          reset_at_source: parsed ? "error_message" : "inferred",
        },
        rung,
      };
    }

    case "hard_error": {
      const resetAt = parseResetAt(signal.raw_excerpt, signalTime);
      if (resetAt) {
        // The error names a reset time → exhausted until then.
        return {
          pool: {
            ...base,
            state: "exhausted",
            reset_at: resetAt.toISOString(),
            reset_at_source: "error_message",
          },
          rung,
        };
      }
      // Otherwise cooling_down with the exponential ladder; the rung advances.
      const ms = cooldownMsForRung(rung);
      return {
        pool: {
          ...base,
          state: "cooling_down",
          cooldown_until: new Date(now.getTime() + ms).toISOString(),
        },
        rung: rung + 1,
      };
    }
  }
}

// §A4 lazy expiry, recomputed by every consumer: an expired cooldown/reset
// window means the pool reads as `unknown` — never `available`.
export function effectiveState(pool: QuotaPool, now: Date): QuotaPool["state"] {
  const nowMs = now.getTime();
  if (pool.state === "cooling_down" && pool.cooldown_until && Date.parse(pool.cooldown_until) <= nowMs) {
    return "unknown";
  }
  if (pool.state === "exhausted" && pool.reset_at && Date.parse(pool.reset_at) <= nowMs) {
    return "unknown";
  }
  // model_downgraded pools carry a reset_at window; once it lapses the
  // downgrade is assumed over (still only back to unknown).
  if (pool.state === "degraded" && pool.reset_at && Date.parse(pool.reset_at) <= nowMs) {
    return "unknown";
  }
  return pool.state;
}

export function defaultPool(poolKey: string, poolId: string, now: Date): QuotaPool {
  return {
    pool_key: poolKey,
    pool_id: poolId,
    state: "unknown",
    remaining: null,
    remaining_confidence: "none",
    window: { kind: "unknown", seconds: null },
    reset_at: null,
    reset_at_source: null,
    local_used_in_window: 0,
    local_budget: null,
    cooldown_until: null,
    last_signal: null,
    updated_at: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// quota_pool_meta — cooldown rung + rolling-window anchor (gateway-local;
// the contract schema has no field for either).
// ---------------------------------------------------------------------------

export interface PoolMeta {
  rung: number;
  windowAnchor: string | null;
}

interface PoolMetaRow {
  pool_key: string;
  cooldown_rung: number;
  window_anchor: string | null;
}

export function getPoolMeta(db: Db, poolKey: string): PoolMeta {
  const row = db
    .prepare("SELECT * FROM quota_pool_meta WHERE pool_key = ?")
    .get(poolKey) as PoolMetaRow | undefined;
  return row
    ? { rung: row.cooldown_rung, windowAnchor: row.window_anchor }
    : { rung: 0, windowAnchor: null };
}

export function savePoolMeta(db: Db, poolKey: string, meta: PoolMeta): void {
  db.prepare(
    `INSERT INTO quota_pool_meta (pool_key, cooldown_rung, window_anchor)
     VALUES (?, ?, ?)
     ON CONFLICT (pool_key) DO UPDATE SET
       cooldown_rung = excluded.cooldown_rung,
       window_anchor = excluded.window_anchor`
  ).run(poolKey, meta.rung, meta.windowAnchor);
}

// ---------------------------------------------------------------------------
// Store-backed compositions used at the worker boundary.
// ---------------------------------------------------------------------------

// load pool + rung → applySignal → persist both. Creates the pool row when the
// first signal for it arrives (mirrors the P3 recordQuotaSignal behavior).
export function applySignalToPool(
  db: Db,
  poolKey: string,
  poolId: string,
  signal: QuotaSignal,
  now: Date
): QuotaPool {
  const meta = getPoolMeta(db, poolKey);
  const existing = getQuotaPool(db, poolKey) ?? defaultPool(poolKey, poolId, now);
  const { pool, rung } = applySignal(existing, signal, now, meta.rung);
  upsertQuotaPool(db, pool);
  savePoolMeta(db, poolKey, { ...meta, rung });
  return pool;
}

// §A4 local soft budget: count real tasks against the rolling window anchored
// in quota_pool_meta; the window length comes from the pool record. A lapsed
// (or never-started) window restarts the count. No-op when the pool row does
// not exist yet — the router only demotes on rows it can read.
export function recordLocalUse(db: Db, poolKey: string, now: Date): QuotaPool | null {
  const pool = getQuotaPool(db, poolKey);
  if (!pool) return null;
  const meta = getPoolMeta(db, poolKey);
  const windowSeconds = pool.window.seconds;
  const anchorMs = meta.windowAnchor ? Date.parse(meta.windowAnchor) : null;
  let used = pool.local_used_in_window;
  let anchor = meta.windowAnchor;
  if (
    anchorMs === null ||
    (windowSeconds !== null && now.getTime() - anchorMs >= windowSeconds * 1000)
  ) {
    used = 0;
    anchor = now.toISOString();
  }
  const updated: QuotaPool = { ...pool, local_used_in_window: used + 1, updated_at: now.toISOString() };
  upsertQuotaPool(db, updated);
  savePoolMeta(db, poolKey, { ...meta, windowAnchor: anchor });
  return updated;
}

// §A4 "the first task after cooldown is treated as a normal attempt" — when it
// succeeds, that success is the one trustworthy recovery signal and the ladder
// rung resets. Hard/uncertain states (unknown, cooling_down, exhausted)
// recover to available with their windows cleared. A soft-signal `degraded`
// state is NOT erased: the limit banner/downgrade was really observed during
// the task, and recovery from it stays lazy (reset_at expiry / reset_notice).
export function recordPoolSuccess(db: Db, poolKey: string, now: Date): QuotaPool | null {
  const pool = getQuotaPool(db, poolKey);
  if (!pool) return null;
  const meta = getPoolMeta(db, poolKey);
  const recovers = pool.state === "unknown" || pool.state === "cooling_down" || pool.state === "exhausted";
  const updated: QuotaPool = recovers
    ? {
        ...pool,
        state: "available",
        cooldown_until: null,
        reset_at: null,
        reset_at_source: null,
        updated_at: now.toISOString(),
      }
    : { ...pool, updated_at: now.toISOString() };
  upsertQuotaPool(db, updated);
  savePoolMeta(db, poolKey, { ...meta, rung: 0 });
  return updated;
}
