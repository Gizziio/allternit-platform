// P4 Phase 2 — observability. Query-only: everything here is computed on read
// from task_attempts / adapter_breakers / route_rejections. No measurement
// events are emitted into the ledger on a stats read — stats are derivable
// from data the gateway already persists, and an event per query would spam
// the append-only log (see P4_PHASE_2_NOTES.md).
import type { FailureClass } from "@allternit/subscription-fabric-contracts";
import type { Db } from "../store/db.js";
import { listRouteRejections, type RouteRejectionRow } from "../store/queries.js";

// Attempt error classes that parked the task in needs_user rather than
// failing it (mirrors the worker's needsUserError mapping).
const NEEDS_USER_CLASSES: ReadonlySet<string> = new Set([
  "auth_required",
  "challenge_presented",
  "user_intervention_required",
]);

export interface AdapterStatsRow {
  adapter_id: string;
  adapter_version: string;
  attempts: number;
  completed: number;
  failed: number;
  needs_user: number;
  success_rate: number; // completed / attempts (0 when no attempts)
  latency_ms: { median: number | null; p95: number | null }; // ended attempts only
  failures_by_class: Partial<Record<FailureClass, number>>;
  ui_drift: { consecutive_failures: number; state: "closed" | "open" };
}

interface AttemptStatsRow {
  adapter_id: string;
  adapter_version: string;
  outcome: string;
  error: string | null;
  started_at: string;
  ended_at: string | null;
}

interface BreakerStatsRow {
  adapter_id: string;
  adapter_version: string;
  consecutive_ui_failures: number;
  state: string;
}

// Nearest-rank percentile over sorted values (deterministic, no interpolation).
function nearestRank(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

export function adapterStats(db: Db, opts: { since?: string } = {}): AdapterStatsRow[] {
  const rows = (
    opts.since
      ? db
          .prepare(
            `SELECT adapter_id, adapter_version, outcome, error, started_at, ended_at
             FROM task_attempts WHERE started_at >= ? ORDER BY adapter_id, adapter_version`
          )
          .all(opts.since)
      : db
          .prepare(
            `SELECT adapter_id, adapter_version, outcome, error, started_at, ended_at
             FROM task_attempts ORDER BY adapter_id, adapter_version`
          )
          .all()
  ) as AttemptStatsRow[];

  const breakers = new Map<string, BreakerStatsRow>();
  for (const b of db.prepare("SELECT * FROM adapter_breakers").all() as BreakerStatsRow[]) {
    breakers.set(`${b.adapter_id} ${b.adapter_version}`, b);
  }

  const groups = new Map<string, AttemptStatsRow[]>();
  for (const row of rows) {
    const key = `${row.adapter_id} ${row.adapter_version}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const out: AdapterStatsRow[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    let completed = 0;
    let failed = 0;
    let needsUser = 0;
    const failuresByClass: Partial<Record<FailureClass, number>> = {};
    const latencies: number[] = [];
    for (const row of group) {
      if (row.outcome === "success" || row.outcome === "partial") completed += 1;
      if (row.ended_at) {
        const ms = Date.parse(row.ended_at) - Date.parse(row.started_at);
        if (Number.isFinite(ms)) latencies.push(ms);
      }
      if (row.error) {
        const parsed = JSON.parse(row.error) as { class?: FailureClass };
        const cls = parsed.class;
        if (cls) failuresByClass[cls] = (failuresByClass[cls] ?? 0) + 1;
        if (cls && NEEDS_USER_CLASSES.has(cls)) needsUser += 1;
        else if (row.outcome === "failed" || row.outcome === "ambiguous") failed += 1;
      } else if (row.outcome === "failed" || row.outcome === "ambiguous") {
        failed += 1;
      }
    }
    latencies.sort((a, b) => a - b);
    const breaker = breakers.get(`${first.adapter_id} ${first.adapter_version}`);
    out.push({
      adapter_id: first.adapter_id,
      adapter_version: first.adapter_version,
      attempts: group.length,
      completed,
      failed,
      needs_user: needsUser,
      success_rate: group.length === 0 ? 0 : completed / group.length,
      latency_ms: { median: nearestRank(latencies, 50), p95: nearestRank(latencies, 95) },
      failures_by_class: failuresByClass,
      ui_drift: {
        consecutive_failures: breaker?.consecutive_ui_failures ?? 0,
        state: breaker?.state === "open" ? "open" : "closed",
      },
    });
  }
  // Deterministic order: adapter_id, then version.
  return out.sort(
    (a, b) => a.adapter_id.localeCompare(b.adapter_id) || a.adapter_version.localeCompare(b.adapter_version)
  );
}

// Latest route-decision rejections, newest first (route_rejections, migration
// 0003 — written wherever a decision is persisted).
export function recentRejections(db: Db, limit = 50): RouteRejectionRow[] {
  return listRouteRejections(db, limit);
}
