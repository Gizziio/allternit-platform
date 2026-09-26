// §A4 last bullet — circuit breaker per adapter version. More than 3
// CONSECUTIVE provider_ui_changed failures (§A9 folds selector_not_found into
// that class; both trip the breaker) across any capability open the breaker:
// state ui_drift, no routes. It closes only when a probe passes (surfaced to
// the router via session_health — see router/snapshot.ts for that mapping).
// A successful attempt resets the consecutive count while closed.
import type { Db } from "./store/db.js";

export type BreakerState = "closed" | "open";

export interface AdapterBreaker {
  adapter_id: string;
  adapter_version: string;
  consecutive_ui_failures: number;
  state: BreakerState;
  opened_at: string | null;
  updated_at: string;
}

// §A4: "more than 3 consecutive" → the 4th consecutive UI failure opens it.
export const UI_DRIFT_CONSECUTIVE_THRESHOLD = 3;

export type BreakerEvent = "ui_failure" | "success" | "probe_passed";

// Pure transition — no I/O, no clocks (now is passed in).
export function nextBreakerState(
  breaker: AdapterBreaker,
  event: BreakerEvent,
  now: Date
): AdapterBreaker {
  const updated_at = now.toISOString();
  switch (event) {
    case "ui_failure": {
      const consecutive = breaker.consecutive_ui_failures + 1;
      const opens = consecutive > UI_DRIFT_CONSECUTIVE_THRESHOLD;
      return {
        ...breaker,
        consecutive_ui_failures: consecutive,
        state: opens ? "open" : breaker.state,
        opened_at: opens ? (breaker.opened_at ?? updated_at) : breaker.opened_at,
        updated_at,
      };
    }
    case "success":
      // Only reachable while closed (an open breaker gets no routes): reset
      // the consecutive count, keep state.
      return { ...breaker, consecutive_ui_failures: 0, updated_at };
    case "probe_passed":
      return {
        ...breaker,
        consecutive_ui_failures: 0,
        state: "closed",
        opened_at: null,
        updated_at,
      };
  }
}

interface BreakerRow {
  adapter_id: string;
  adapter_version: string;
  consecutive_ui_failures: number;
  state: string;
  opened_at: string | null;
  updated_at: string;
}

function breakerFromRow(row: BreakerRow): AdapterBreaker {
  return { ...row, state: row.state as BreakerState };
}

export function getBreaker(db: Db, adapterId: string, adapterVersion: string): AdapterBreaker {
  const row = db
    .prepare("SELECT * FROM adapter_breakers WHERE adapter_id = ? AND adapter_version = ?")
    .get(adapterId, adapterVersion) as BreakerRow | undefined;
  return (
    row ? breakerFromRow(row) : {
      adapter_id: adapterId,
      adapter_version: adapterVersion,
      consecutive_ui_failures: 0,
      state: "closed" as BreakerState,
      opened_at: null,
      updated_at: new Date(0).toISOString(),
    }
  );
}

function saveBreaker(db: Db, breaker: AdapterBreaker): void {
  db.prepare(
    `INSERT INTO adapter_breakers (
       adapter_id, adapter_version, consecutive_ui_failures, state, opened_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (adapter_id, adapter_version) DO UPDATE SET
       consecutive_ui_failures = excluded.consecutive_ui_failures,
       state = excluded.state,
       opened_at = excluded.opened_at,
       updated_at = excluded.updated_at`
  ).run(
    breaker.adapter_id,
    breaker.adapter_version,
    breaker.consecutive_ui_failures,
    breaker.state,
    breaker.opened_at,
    breaker.updated_at
  );
}

function applyBreakerEvent(
  db: Db,
  adapterId: string,
  adapterVersion: string,
  event: BreakerEvent,
  now: Date
): AdapterBreaker {
  const next = nextBreakerState(getBreaker(db, adapterId, adapterVersion), event, now);
  saveBreaker(db, next);
  return next;
}

export function recordAdapterUiFailure(db: Db, adapterId: string, adapterVersion: string, now: Date): AdapterBreaker {
  return applyBreakerEvent(db, adapterId, adapterVersion, "ui_failure", now);
}

export function recordAdapterSuccess(db: Db, adapterId: string, adapterVersion: string, now: Date): AdapterBreaker {
  return applyBreakerEvent(db, adapterId, adapterVersion, "success", now);
}

export function recordAdapterProbePassed(db: Db, adapterId: string, adapterVersion: string, now: Date): AdapterBreaker {
  return applyBreakerEvent(db, adapterId, adapterVersion, "probe_passed", now);
}

export function listOpenBreakers(db: Db): AdapterBreaker[] {
  const rows = db
    .prepare("SELECT * FROM adapter_breakers WHERE state = 'open' ORDER BY adapter_id ASC")
    .all() as BreakerRow[];
  return rows.map(breakerFromRow);
}
