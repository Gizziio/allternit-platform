// Shared fixture builders for router/pools table tests. Provider-agnostic
// fixture names only (HARDENING §6 grep gate covers test/router + test/pools).
import type {
  Account,
  AdapterManifest,
  CapabilityId,
  FabricSnapshot,
  ManifestCapability,
  ProviderId,
  QuotaPool,
  QuotaSignal,
  RouteLane,
  SessionHealth,
} from "@allternit/subscription-fabric-contracts";

export const NOW = new Date("2026-09-26T12:00:00.000Z");
export const POOL_ID = "main-pool";

let idSeq = 0;
export function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

export function makeCapability(overrides: Partial<ManifestCapability> = {}): ManifestCapability {
  return {
    id: "chat.create" as CapabilityId,
    min_capability_version: 1,
    plans: ["free"],
    pool_id: POOL_ID,
    detachable: false,
    export_formats: [],
    status: "stable",
    ...overrides,
  };
}

export function makeManifest(
  overrides: Partial<AdapterManifest> & { lane?: RouteLane } = {}
): AdapterManifest {
  const provider = overrides.provider ?? ("prov-a" as ProviderId);
  const { lane: _lane, ...rest } = overrides;
  const manifest: AdapterManifest = {
    adapter_id: "adapter-a",
    adapter_version: "1.0.0",
    provider,
    interface: "ui_bridge_web",
    origins: ["https://fixture-a.test"],
    auth: { login_url: "https://fixture-a.test/login", logged_in_probe: "probe" },
    plans: [{ plan_id: "free", label: "Free" }],
    capabilities: [makeCapability()],
    pacing: {
      min_action_gap_ms: [1, 2],
      min_task_gap_s: 0,
      max_tasks_per_hour: 1000,
      max_tasks_per_day: 5000,
    },
    selectors_version: "v1",
    ...rest,
  };
  if (_lane) (manifest as AdapterManifest & { lane?: RouteLane }).lane = _lane;
  return manifest;
}

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    account_id: "acct-1",
    provider: "prov-a" as ProviderId,
    label: "Fixture Account",
    plan: "free",
    plan_observed_at: null,
    profile_ref: "profile-1",
    session_health: "ready",
    enabled: true,
    ...overrides,
  };
}

export function makePool(overrides: Partial<QuotaPool> = {}): QuotaPool {
  return {
    pool_key: "prov-a:acct-1:main-pool",
    pool_id: POOL_ID,
    state: "unknown",
    remaining: null,
    remaining_confidence: "none",
    window: { kind: "rolling", seconds: 3600 },
    reset_at: null,
    reset_at_source: null,
    local_used_in_window: 0,
    local_budget: null,
    cooldown_until: null,
    last_signal: null,
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

export function makeSignal(overrides: Partial<QuotaSignal> = {}): QuotaSignal {
  return {
    kind: "hard_error",
    raw_excerpt: "rate limit reached",
    observed_at: NOW.toISOString(),
    task_id: "task-1",
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<FabricSnapshot> = {}): FabricSnapshot {
  const accounts = overrides.accounts ?? [];
  return {
    accounts,
    manifests: [],
    pools: [],
    session_health: Object.fromEntries(accounts.map((a) => [a.account_id, a.session_health])) as Record<
      string,
      SessionHealth
    >,
    captured_at: NOW.toISOString(),
    ...overrides,
  };
}
