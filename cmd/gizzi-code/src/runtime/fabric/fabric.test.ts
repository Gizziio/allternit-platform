import { describe, it, expect, beforeEach } from "bun:test"
import { LeaseAuthority } from "./lease-authority"
import { FabricJournal } from "./journal"
import { buildNodeDirectory, buildNodeDirectoryEntry, buildNodeCapabilityRecord, buildNodeIdentity } from "./capability-catalog"

describe("Fabric lease authority", () => {
  beforeEach(() => {
    LeaseAuthority.resetSecret()
  })

  it("issues a dev lease that matches the canonical schema", async () => {
    const lease = LeaseAuthority.issue({
      capabilityId: "harness.shell",
      grantee: "test-agent",
      ttlSeconds: 60,
    })
    expect(lease.status).toBe("active")
    expect(lease.capabilityId).toBe("harness.shell")
    const check = await LeaseAuthority.check(lease)
    expect(check.ok).toBe(true)
  })

  it("rejects an expired lease", async () => {
    const lease = LeaseAuthority.issue({
      capabilityId: "harness.file.read",
      grantee: "test-agent",
      ttlSeconds: -1,
    })
    const check = await LeaseAuthority.check(lease)
    expect(check.ok).toBe(false)
  })

  it("includes policy constraints when requested", async () => {
    const lease = LeaseAuthority.issue({
      capabilityId: "harness.browser.navigate",
      grantee: "test-agent",
      policy: { workloadId: "wl-1", principalId: "user-1", budgetId: "budget-1" },
    })
    expect(lease.policy).toEqual({ workloadId: "wl-1", principalId: "user-1", budgetId: "budget-1" })
    const check = await LeaseAuthority.check(lease)
    expect(check.ok).toBe(true)
  })
})

describe("Canonical CapabilityLease acceptance", () => {
  it("accepts a canonical AllternitOS CapabilityLease", async () => {
    const canonical = {
      id: "lease_test_001",
      revision: 1,
      subject: "ios-client",
      issuer: "allternitos-lease-authority",
      workload_id: "wl_test_001",
      capability: "harness.session.message",
      purpose: "send a chat message",
      state: "active" as const,
      issued_at: new Date().toISOString(),
      not_after: new Date(Date.now() + 60_000).toISOString(),
      policy_ref: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      limits: { maxInvocations: 10 },
    }
    const check = await LeaseAuthority.check(canonical)
    expect(check.ok).toBe(true)
    if (check.ok) {
      expect(check.lease.capabilityId).toBe("harness.session.message")
      expect(check.lease.grantee).toBe("ios-client")
    }
  })

  it("rejects a canonical lease that is not active", async () => {
    const canonical = {
      id: "lease_test_002",
      subject: "ios-client",
      issuer: "allternitos-lease-authority",
      capability: "harness.session.message",
      purpose: "send a chat message",
      state: "revoked" as const,
      issued_at: new Date().toISOString(),
      not_after: new Date(Date.now() + 60_000).toISOString(),
    }
    const check = await LeaseAuthority.check(canonical)
    expect(check.ok).toBe(false)
  })
})

describe("Canonical NodeDirectory mapping", () => {
  it("builds a NodeCapabilityRecord with required fields", () => {
    const identity = buildNodeIdentity({ nodeId: "node-test-host", endpoints: [] })
    const record = buildNodeCapabilityRecord(identity)
    expect(record.schema_version).toBe("1.1.0")
    expect(record.node_id).toMatch(/^node_[a-z0-9_-]+$/)
    expect(record.hardware.cpu.cores).toBeGreaterThan(0)
    expect(record.hardware.memory.total_bytes).toBeGreaterThan(0)
    expect(record.software.fabric_os_version).toBeDefined()
    expect(record.workers?.capabilities?.length).toBeGreaterThan(0)
  })

  it("builds a canonical NodeDirectory entry", () => {
    const identity = buildNodeIdentity({ nodeId: "node-test-host", endpoints: [] })
    const entry = buildNodeDirectoryEntry(identity) as Record<string, unknown>
    expect(entry.node_id).toMatch(/^node_[a-z0-9_-]+$/)
    expect(entry.capability_record).toBeDefined()
    expect(entry.last_seen).toBeDefined()
    expect(entry.reachable).toBe(true)
    expect(entry.health).toBeOneOf(["healthy", "degraded", "unavailable"])
    expect(entry.transport_kind).toBeOneOf(["wireguard", "tailscale", "lan", "relay"])
  })

  it("builds a canonical NodeDirectory envelope", () => {
    const identity = buildNodeIdentity({ nodeId: "node-test-host", endpoints: [] })
    const directory = buildNodeDirectory(identity) as Record<string, unknown>
    expect(directory.schema_version).toBe("1.0.0")
    expect(directory.recorded_at).toBeDefined()
    expect(Array.isArray(directory.entries)).toBe(true)
    expect((directory.entries as unknown[]).length).toBe(1)
  })
})

describe("Fabric journal", () => {
  it("writes and reads a receipt", async () => {
    await FabricJournal.write({
      capability: "harness.shell",
      nodeId: "node-test",
      requestId: "req-3",
      ok: true,
      result: { stdout: "hi" },
      inputKeys: ["command"],
    })
    const recent = await FabricJournal.readRecent(10)
    const found = recent.find((r) => r.requestId === "req-3")
    expect(found).toBeDefined()
    expect(found?.capability).toBe("harness.shell")
    expect(found?.ok).toBe(true)
  })
})


describe("Fabric worker manifest", () => {
  it("advertises the permission and question session capabilities", async () => {
    const manifestPath = new URL("../../../runtime.fabric.worker.json", import.meta.url)
    const manifest = await Bun.file(manifestPath).json()
    const capabilities = manifest.functions.map((f: { capability: string }) => f.capability)
    expect(capabilities).toContain("harness.session.permissions.list")
    expect(capabilities).toContain("harness.session.permissions.reply")
    expect(capabilities).toContain("harness.session.questions.list")
    expect(capabilities).toContain("harness.session.questions.reply")
    expect(capabilities).toContain("harness.session.questions.reject")
  })
})
