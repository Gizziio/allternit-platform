// D13 — subs model catalog derivation (P4 Phase 2). Health gating, badges,
// fabric block mapping, id format — all provider-agnostic fixtures.
import { describe, expect, it } from "vitest";
import type { SessionHealth } from "@allternit/subscription-fabric-contracts";
import { subsModelCatalog } from "../../src/catalog/subs_models.js";
import {
  makeAccount,
  makeCapability,
  makeManifest,
  makeSnapshot,
  POOL_ID,
} from "../router/fixtures.js";

const chatCaps = () => [
  makeCapability({ id: "chat.create" as ReturnType<typeof makeCapability>["id"] }),
  makeCapability({ id: "chat.continue" as ReturnType<typeof makeCapability>["id"] }),
];

describe("subsModelCatalog — entries for servable accounts", () => {
  it("publishes one entry per model class with the picker shape and fabric block", () => {
    const manifest = makeManifest({ capabilities: chatCaps() });
    const account = makeAccount({ label: "Fixture Plus" });
    const entries = subsModelCatalog(makeSnapshot({ accounts: [account], manifests: [manifest] }));

    // model classes = policy model_class_rank keys minus non-chat (`deep`);
    // entries are emitted sorted by id (deterministic; the picker re-orders).
    expect(entries.map((e) => e.id)).toEqual([
      "subs/prov-a:fast",
      "subs/prov-a:reasoning",
      "subs/prov-a:standard",
    ]);
    for (const entry of entries) {
      expect(entry.provider).toBe("prov-a");
      expect(entry.description).toBe("Subscription lane — no metered cost");
      expect(entry.supports_effort).toBe(false);
      expect(entry.health).toBe("ready");
      expect(entry.fabric.adapter_id).toBe("adapter-a");
      expect(entry.fabric.account_id).toBe("acct-1");
      expect(entry.fabric.pool_key).toBe(`prov-a:acct-1:${POOL_ID}`);
    }
    const reasoning = entries.find((e) => e.id === "subs/prov-a:reasoning");
    expect(reasoning?.name).toBe("Fixture Plus (subscription) · Reasoning");
    expect(reasoning?.tier).toBe("flagship");
    expect(entries.find((e) => e.id === "subs/prov-a:fast")?.tier).toBe("fast");
    expect(entries.find((e) => e.id === "subs/prov-a:standard")?.tier).toBe("standard");
    // Submission capability: the family's `.create` entry point, not continue.
    expect(reasoning?.fabric.capability).toBe("chat.create");
    expect(reasoning?.fabric.options).toEqual({ model_class: "reasoning" });
  });

  it("degraded health shows with the degraded badge", () => {
    const manifest = makeManifest();
    const account = makeAccount({ session_health: "degraded" });
    const entries = subsModelCatalog(makeSnapshot({ accounts: [account], manifests: [manifest] }));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.health === "degraded")).toBe(true);
  });

  it("snapshot session_health overrides the account row (breaker-mapped ui_drift hides)", () => {
    const manifest = makeManifest();
    const account = makeAccount({ session_health: "ready" });
    const entries = subsModelCatalog(
      makeSnapshot({ accounts: [account], manifests: [manifest], session_health: { "acct-1": "ui_drift" } })
    );
    expect(entries).toEqual([]);
  });

  it.each([
    "auth_required",
    "challenge_presented",
    "account_restricted",
    "ui_drift",
    "provider_down",
    "profile_locked",
  ] as SessionHealth[])("health %s hides every entry (needs a human)", (health) => {
    const manifest = makeManifest();
    const account = makeAccount({ session_health: health });
    expect(subsModelCatalog(makeSnapshot({ accounts: [account], manifests: [manifest] }))).toEqual([]);
  });

  it("disabled accounts publish nothing", () => {
    const manifest = makeManifest();
    const account = makeAccount({ enabled: false });
    expect(subsModelCatalog(makeSnapshot({ accounts: [account], manifests: [manifest] }))).toEqual([]);
  });

  it("plan gate: an account plan the capability does not list publishes nothing; unknown plan passes", () => {
    const manifest = makeManifest({ capabilities: [makeCapability({ plans: ["plus"] })] });
    const free = makeAccount({ plan: "free" });
    expect(subsModelCatalog(makeSnapshot({ accounts: [free], manifests: [manifest] }))).toEqual([]);
    const unknown = makeAccount({ plan: null });
    expect(
      subsModelCatalog(makeSnapshot({ accounts: [unknown], manifests: [manifest] })).length
    ).toBeGreaterThan(0);
  });

  it("manifests without an enabled chat-family capability publish nothing", () => {
    const imageOnly = makeManifest({
      capabilities: [makeCapability({ id: "image.generate" as ReturnType<typeof makeCapability>["id"] })],
    });
    const disabledChat = makeManifest({
      adapter_id: "adapter-b",
      capabilities: [makeCapability({ status: "disabled" })],
    });
    const account = makeAccount();
    expect(subsModelCatalog(makeSnapshot({ accounts: [account], manifests: [imageOnly] }))).toEqual([]);
    expect(subsModelCatalog(makeSnapshot({ accounts: [account], manifests: [disabledChat] }))).toEqual([]);
  });

  it("a chat family without a .create capability falls back to its first capability", () => {
    const manifest = makeManifest({
      capabilities: [makeCapability({ id: "chat.continue" as ReturnType<typeof makeCapability>["id"] })],
    });
    const account = makeAccount();
    const entries = subsModelCatalog(makeSnapshot({ accounts: [account], manifests: [manifest] }));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.fabric.capability).toBe("chat.continue");
  });

  it("sorts entries by id; multiple accounts and adapters all publish", () => {
    const manifestB = makeManifest({ adapter_id: "adapter-b", provider: "prov-b" as ReturnType<typeof makeAccount>["provider"] });
    const accountB = makeAccount({ account_id: "acct-b", provider: "prov-b" as ReturnType<typeof makeAccount>["provider"] });
    const entries = subsModelCatalog(
      makeSnapshot({ accounts: [makeAccount(), accountB], manifests: [makeManifest(), manifestB] })
    );
    const ids = entries.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    expect(ids.filter((id) => id.startsWith("subs/prov-a:")).length).toBe(3);
    expect(ids.filter((id) => id.startsWith("subs/prov-b:")).length).toBe(3);
  });
});
