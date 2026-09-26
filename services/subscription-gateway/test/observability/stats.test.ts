// P4 Phase 2 — observability stats over seeded attempts (deterministic fixed
// timestamps) + route_rejections ordering.
import { afterEach, describe, expect, it } from "vitest";
import type { TaskAttempt } from "@allternit/subscription-fabric-contracts";
import { recordAdapterUiFailure } from "../../src/breakers.js";
import { adapterStats, recentRejections } from "../../src/observability/stats.js";
import { openDatabase, type Db } from "../../src/store/db.js";
import { insertAttempt, insertTask, recordRouteRejections } from "../../src/store/queries.js";
import { FabricRouter } from "../../src/router/resolve.js";
import { sampleTask } from "../helpers.js";
import { makeAccount, makeManifest, makeSnapshot } from "../router/fixtures.js";

let db: Db | undefined;
afterEach(() => db?.close());

const T0 = Date.parse("2026-09-26T10:00:00.000Z");
const iso = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

function attempt(overrides: Partial<TaskAttempt>): TaskAttempt {
  return {
    attempt_no: 1,
    adapter_id: "adapter-a",
    adapter_version: "1.0.0",
    account_id: "acct-1",
    pool_key: "prov-a:acct-1:main-pool",
    submission_state: "acknowledged",
    prompt_fingerprint: "fp",
    provider_thread_id: null,
    requested_model_class: null,
    observed_model: null,
    started_at: iso(0),
    ended_at: iso(1000),
    outcome: "success",
    error: null,
    ...overrides,
  };
}

function seed(taskId: string, attempts: TaskAttempt[]): void {
  insertTask(db as Db, sampleTask({ task_id: taskId }));
  for (const a of attempts) insertAttempt(db as Db, taskId, a);
}

describe("adapterStats — rates, latency percentiles, failure classes", () => {
  it("aggregates per (adapter_id, adapter_version) with deterministic percentiles", () => {
    db = openDatabase(":memory:");
    seed("t1", [
      attempt({ attempt_no: 1, outcome: "success", started_at: iso(0), ended_at: iso(1000) }),
      attempt({ attempt_no: 2, outcome: "success", started_at: iso(2000), ended_at: iso(5000) }),
      attempt({
        attempt_no: 3,
        outcome: "failed",
        started_at: iso(6000),
        ended_at: iso(11000),
        error: {
          class: "provider_error",
          scope: "task",
          retryable: true,
          fallback_eligible: true,
          cooldown_s: null,
          user_action: null,
          detail: "boom",
          evidence_ref: null,
        },
      }),
      attempt({
        attempt_no: 4,
        outcome: "failed",
        started_at: iso(12000),
        ended_at: iso(14000),
        error: {
          class: "auth_required",
          scope: "account",
          retryable: false,
          fallback_eligible: true,
          cooldown_s: null,
          user_action: "log in again",
          detail: "session expired",
          evidence_ref: null,
        },
      }),
      // Older version of the same adapter: its own row.
      attempt({ attempt_no: 5, adapter_version: "0.9.0", outcome: "failed", started_at: iso(20000), ended_at: iso(20500) }),
    ]);
    recordAdapterUiFailure(db, "adapter-a", "1.0.0", new Date(T0));
    recordAdapterUiFailure(db, "adapter-a", "1.0.0", new Date(T0));

    const stats = adapterStats(db);
    expect(stats.map((s) => s.adapter_version)).toEqual(["0.9.0", "1.0.0"]);

    const v1 = stats.find((s) => s.adapter_version === "1.0.0");
    expect(v1?.attempts).toBe(4);
    expect(v1?.completed).toBe(2);
    expect(v1?.failed).toBe(1);
    expect(v1?.needs_user).toBe(1);
    expect(v1?.success_rate).toBe(0.5);
    // latencies [1000, 3000, 5000, 2000] sorted → [1000, 2000, 3000, 5000]
    expect(v1?.latency_ms.median).toBe(2000); // nearest-rank p50 of 4
    expect(v1?.latency_ms.p95).toBe(5000); // nearest-rank p95 of 4
    expect(v1?.failures_by_class).toEqual({ provider_error: 1, auth_required: 1 });
    expect(v1?.ui_drift).toEqual({ consecutive_failures: 2, state: "closed" });

    const v09 = stats.find((s) => s.adapter_version === "0.9.0");
    expect(v09?.attempts).toBe(1);
    expect(v09?.success_rate).toBe(0);
    expect(v09?.ui_drift.consecutive_failures).toBe(0);
  });

  it("honors the since filter (started_at >= since)", () => {
    db = openDatabase(":memory:");
    seed("t1", [
      attempt({ attempt_no: 1, outcome: "success", started_at: iso(0), ended_at: iso(1000) }),
      attempt({ attempt_no: 2, outcome: "success", started_at: iso(60_000), ended_at: iso(62_000) }),
    ]);
    expect(adapterStats(db)[0]?.attempts).toBe(2);
    const filtered = adapterStats(db, { since: iso(30_000) });
    expect(filtered[0]?.attempts).toBe(1);
    expect(filtered[0]?.latency_ms.median).toBe(2000);
  });

  it("attempts without ended_at contribute no latency", () => {
    db = openDatabase(":memory:");
    seed("t1", [
      attempt({ attempt_no: 1, outcome: "failed", ended_at: null }),
      attempt({ attempt_no: 2, outcome: "success", started_at: iso(0), ended_at: iso(4000) }),
    ]);
    const [row] = adapterStats(db);
    expect(row?.latency_ms.median).toBe(4000);
    expect(row?.latency_ms.p95).toBe(4000);
  });
});

describe("recentRejections — newest first, limit respected", () => {
  it("orders by insertion (latest decision first)", () => {
    db = openDatabase(":memory:");
    const account = makeAccount();
    const manifest = makeManifest({ capabilities: [] }); // nothing offered → rejections
    const router = new FabricRouter({ now: () => new Date(T0), idGen: () => "dec-1" });
    const snapshot = makeSnapshot({ accounts: [account], manifests: [manifest] });
    const t = sampleTask({ task_id: "rej-1" });

    const first = router.resolve(t, snapshot);
    recordRouteRejections(db, t.task_id, first, new Date(T0));
    const second = { ...first, decision_id: "dec-2" };
    recordRouteRejections(db, t.task_id, second, new Date(T0 + 60_000));

    const rows = recentRejections(db, 10);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.decision_id).toBe("dec-2");
    expect(rows[1]?.decision_id).toBe("dec-1");
    expect(rows[0]?.reason).toBe("capability_not_offered");
    expect(rows[0]?.account_id).toBe("acct-1");
    expect(recentRejections(db, 1)).toHaveLength(1);
  });
});
