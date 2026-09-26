// §A4 last bullet — ui_drift circuit breaker per adapter version (plan
// verify-list scenario 4): >3 consecutive UI failures across any capability
// open the breaker; it stays open until a probe passes.
import { afterEach, describe, expect, it } from "vitest";
import {
  getBreaker,
  listOpenBreakers,
  nextBreakerState,
  recordAdapterProbePassed,
  recordAdapterSuccess,
  recordAdapterUiFailure,
  type AdapterBreaker,
} from "../../src/breakers.js";
import { buildSnapshot } from "../../src/router/snapshot.js";
import { FabricRouter } from "../../src/router/resolve.js";
import { openDatabase, type Db } from "../../src/store/db.js";
import { upsertAccount, upsertQuotaPool } from "../../src/store/queries.js";
import type { AdapterRegistry } from "../../src/adapters/registry.js";
import { sampleTask } from "../helpers.js";
import { makeAccount, makeManifest, makePool, NOW } from "./fixtures.js";

function breaker(overrides: Partial<AdapterBreaker> = {}): AdapterBreaker {
  return {
    adapter_id: "adapter-a",
    adapter_version: "1.0.0",
    consecutive_ui_failures: 0,
    state: "closed",
    opened_at: null,
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

describe("nextBreakerState — pure transitions", () => {
  it("3 consecutive UI failures stay closed; the 4th opens (§A4 '>3 consecutive')", () => {
    let b = breaker();
    for (let i = 0; i < 3; i++) b = nextBreakerState(b, "ui_failure", NOW);
    expect(b.state).toBe("closed");
    expect(b.consecutive_ui_failures).toBe(3);
    b = nextBreakerState(b, "ui_failure", NOW);
    expect(b.state).toBe("open");
    expect(b.consecutive_ui_failures).toBe(4);
    expect(b.opened_at).toBe(NOW.toISOString());
  });

  it("a success resets the consecutive count (failures must be consecutive)", () => {
    let b = breaker({ consecutive_ui_failures: 3 });
    b = nextBreakerState(b, "success", NOW);
    expect(b.consecutive_ui_failures).toBe(0);
    b = nextBreakerState(b, "ui_failure", NOW);
    expect(b.state).toBe("closed");
  });

  it("an open breaker closes only on probe_passed — not on success", () => {
    let b = breaker({ consecutive_ui_failures: 4, state: "open", opened_at: NOW.toISOString() });
    b = nextBreakerState(b, "probe_passed", NOW);
    expect(b.state).toBe("closed");
    expect(b.consecutive_ui_failures).toBe(0);
    expect(b.opened_at).toBeNull();
  });
});

describe("breaker → snapshot → router (scenario 4 end to end)", () => {
  let db: Db;
  afterEach(() => db.close());

  function setup() {
    db = openDatabase(":memory:");
    const manifest = makeManifest();
    const account = makeAccount();
    upsertAccount(db, account);
    upsertQuotaPool(db, makePool({ state: "available" }));
    const registry: AdapterRegistry = {
      adapters: [{ dir: "/fixture", manifest }],
      byId: (id) => (id === manifest.adapter_id ? { dir: "/fixture", manifest } : undefined),
      capabilities: () => [],
    };
    const router = new FabricRouter({ now: () => NOW, idGen: () => "dec-1" });
    const t = sampleTask({
      routing: { mode: "auto", allow_fallback: true, allow_metered: false, allow_thread_migration: false },
    });
    return { manifest, account, registry, router, t };
  }

  it("4 consecutive UI failures across capabilities → ui_drift rejection; probe pass → eligible", () => {
    const { manifest, registry, router, t } = setup();

    // Healthy baseline: routes.
    expect(router.resolve(t, buildSnapshot(db, registry, NOW)).primary?.adapter_id).toBe(manifest.adapter_id);

    // Four consecutive selector_not_found/provider_ui_changed failures —
    // observed across different capabilities; the breaker is per adapter
    // version and counts across any capability (§A4).
    for (let i = 0; i < 4; i++) {
      recordAdapterUiFailure(db, manifest.adapter_id, manifest.adapter_version, NOW);
    }
    expect(getBreaker(db, manifest.adapter_id, manifest.adapter_version).state).toBe("open");
    expect(listOpenBreakers(db)).toHaveLength(1);

    // The snapshot surfaces the open breaker as ui_drift health → no routes.
    const driftingSnapshot = buildSnapshot(db, registry, NOW);
    expect(driftingSnapshot.session_health["acct-1"]).toBe("ui_drift");
    const drifting = router.resolve(t, driftingSnapshot);
    expect(drifting.primary).toBeNull();
    expect(drifting.rejected).toEqual([
      { adapter_id: manifest.adapter_id, account_id: "acct-1", reason: "ui_drift" },
    ]);

    // Health flip to probe-passed: breaker closes and the adapter is eligible
    // again on the very next snapshot.
    recordAdapterProbePassed(db, manifest.adapter_id, manifest.adapter_version, NOW);
    const recoveredSnapshot = buildSnapshot(db, registry, NOW);
    expect(recoveredSnapshot.session_health["acct-1"]).toBe("ready");
    expect(router.resolve(t, recoveredSnapshot).primary?.adapter_id).toBe(manifest.adapter_id);
  });

  it("a success between failures keeps the breaker closed (consecutiveness)", () => {
    const { manifest } = setup();
    recordAdapterUiFailure(db, manifest.adapter_id, manifest.adapter_version, NOW);
    recordAdapterUiFailure(db, manifest.adapter_id, manifest.adapter_version, NOW);
    recordAdapterUiFailure(db, manifest.adapter_id, manifest.adapter_version, NOW);
    recordAdapterSuccess(db, manifest.adapter_id, manifest.adapter_version, NOW);
    recordAdapterUiFailure(db, manifest.adapter_id, manifest.adapter_version, NOW);
    const b = getBreaker(db, manifest.adapter_id, manifest.adapter_version);
    expect(b.state).toBe("closed");
    expect(b.consecutive_ui_failures).toBe(1);
  });
});
