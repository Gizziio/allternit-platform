import { describe, expect, it, beforeAll, afterAll } from "bun:test"
import { AgentWorkspace } from "@/agent-workspace"
import { rmdir, mkdir, writeFile, readFile } from "fs/promises"
import path from "path"

describe("AgentWorkspace", () => {
  const testWorkspace = "/tmp/a2r-agent-workspace-test"
  
  beforeAll(async () => {
    await mkdir(testWorkspace, { recursive: true })
  })
  
  afterAll(async () => {
    try {
      await rmdir(testWorkspace, { recursive: true })
    } catch {}
  })

  describe("getPaths", () => {
    it("should return all 5-layer paths", () => {
      const paths = AgentWorkspace.getPaths(testWorkspace)
      
      expect(paths.root).toContain(".a2r")
      expect(paths.manifest).toContain("manifest.json")
      expect(paths.l1_cognitive).toContain("L1-COGNITIVE")
      expect(paths.l2_identity).toContain("L2-IDENTITY")
      expect(paths.l3_governance).toContain("L3-GOVERNANCE")
      expect(paths.l4_skills).toContain("L4-SKILLS")
      expect(paths.l5_business).toContain("L5-BUSINESS")
    })

    it("should have correct L1 paths", () => {
      const paths = AgentWorkspace.getPaths(testWorkspace)
      
      expect(paths.l1_brain_md).toContain("BRAIN.md")
      expect(paths.l1_state).toContain("state.json")
      expect(paths.l1_taskgraph).toContain("taskgraph.json")
      expect(paths.l1_memory_jsonl).toContain("memory.jsonl")
      expect(paths.l1_handoff).toContain("handoff.md")
    })

    it("should have correct L2 paths", () => {
      const paths = AgentWorkspace.getPaths(testWorkspace)
      
      expect(paths.l2_identity_md).toContain("IDENTITY.md")
      expect(paths.l2_policy_md).toContain("POLICY.md")
      expect(paths.l2_conventions_md).toContain("CONVENTIONS.md")
    })
  })

  describe("initialize", () => {
    it("should create all 5 layers", async () => {
      const testDir = path.join(testWorkspace, "test-init")
      const paths = await AgentWorkspace.initialize(testDir, {
        sessionId: "test-session-123",
        runner: "opencode",
      })
      
      // Check manifest exists
      const manifest = await AgentWorkspace.readManifest(testDir)
      expect(manifest).not.toBeNull()
      expect(manifest.session.session_id).toBe("test-session-123")
      expect(manifest.session.runner).toBe("opencode")
      
      // Check all L1 directories exist
      expect(await Bun.file(paths.l1_state).exists()).toBe(true)
      expect(await Bun.file(paths.l1_memory_jsonl).exists()).toBe(true)
      expect(await Bun.file(paths.l1_brain_md).exists()).toBe(true)
      
      // Check L2
      expect(await Bun.file(paths.l2_identity_md).exists()).toBe(true)
      expect(await Bun.file(paths.l2_policy_md).exists()).toBe(true)
      
      // Check L3
      expect(await Bun.file(paths.l3_playbook_md).exists()).toBe(true)
      
      // Check L4
      expect(await Bun.file(paths.l4_index_md).exists()).toBe(true)
      
      // L5 should NOT exist (not enabled)
      expect(await Bun.file(paths.l5_clients_md).exists()).toBe(false)
    })

    it("should create L5 when enabled", async () => {
      const testDir = path.join(testWorkspace, "test-l5")
      const paths = await AgentWorkspace.initialize(testDir, {
        enableL5: true,
      })
      
      expect(await Bun.file(paths.l5_clients_md).exists()).toBe(true)
    })

    it("should generate session ID if not provided", async () => {
      const testDir = path.join(testWorkspace, "test-auto-id")
      await AgentWorkspace.initialize(testDir)
      
      const manifest = await AgentWorkspace.readManifest(testDir)
      expect(manifest.session.session_id).toMatch(/^sess-/)
    })
  })

  describe("exists", () => {
    it("should return true for initialized workspace", async () => {
      const testDir = path.join(testWorkspace, "test-exists")
      await AgentWorkspace.initialize(testDir)
      
      expect(await AgentWorkspace.exists(testDir)).toBe(true)
    })

    it("should return false for non-initialized workspace", async () => {
      const testDir = path.join(testWorkspace, "nonexistent-workspace")
      
      expect(await AgentWorkspace.exists(testDir)).toBe(false)
    })
  })

  describe("readManifest", () => {
    it("should read manifest correctly", async () => {
      const testDir = path.join(testWorkspace, "test-manifest")
      await AgentWorkspace.initialize(testDir, { runner: "claude_code" })
      
      const manifest = await AgentWorkspace.readManifest(testDir)
      expect(manifest).not.toBeNull()
      expect(manifest.workspace.root).toBe(testDir)
      expect(manifest.layers.l1_cognitive.enabled).toBe(true)
      expect(manifest.layers.l5_business.enabled).toBe(false)
      expect(manifest.thresholds.warn_context_ratio).toBe(0.70)
    })

    it("should return null for missing manifest", async () => {
      const manifest = await AgentWorkspace.readManifest("/nonexistent")
      expect(manifest).toBeNull()
    })
  })

  describe("memory operations", () => {
    it("should append and read memory entries", async () => {
      const testDir = path.join(testWorkspace, "test-memory")
      await AgentWorkspace.initialize(testDir)
      
      await AgentWorkspace.appendMemory(testDir, {
        ts: 1704067200000,
        tool: "bash",
        status: "ok",
      })
      
      await AgentWorkspace.appendMemory(testDir, {
        ts: 1704067201000,
        tool: "write",
        status: "ok",
      })
      
      const entries = await AgentWorkspace.readMemory(testDir)
      expect(entries).toHaveLength(2)
      expect((entries[0] as any).tool).toBe("bash")
      expect((entries[1] as any).tool).toBe("write")
    })

    it("should filter memory by since", async () => {
      const testDir = path.join(testWorkspace, "test-memory-since")
      await AgentWorkspace.initialize(testDir)
      
      await AgentWorkspace.appendMemory(testDir, { ts: 1000, tool: "old" })
      await AgentWorkspace.appendMemory(testDir, { ts: 2000, tool: "new" })
      
      const entries = await AgentWorkspace.readMemory(testDir, { since: 1500 })
      expect(entries).toHaveLength(1)
      expect((entries[0] as any).tool).toBe("new")
    })

    it("should limit memory entries", async () => {
      const testDir = path.join(testWorkspace, "test-memory-limit")
      await AgentWorkspace.initialize(testDir)
      
      for (let i = 0; i < 10; i++) {
        await AgentWorkspace.appendMemory(testDir, { ts: i, tool: `tool-${i}` })
      }
      
      const entries = await AgentWorkspace.readMemory(testDir, { limit: 3 })
      expect(entries).toHaveLength(3)
      expect((entries[0] as any).tool).toBe("tool-7")
    })
  })

  describe("handoff operations", () => {
    it("should update and get latest handoff", async () => {
      const testDir = path.join(testWorkspace, "test-handoff")
      await AgentWorkspace.initialize(testDir)
      
      const batonPath = path.join(testDir, ".a2r", "L1-COGNITIVE", "brain", "batons", "test.md")
      await mkdir(path.dirname(batonPath), { recursive: true })
      await writeFile(batonPath, "# Test Baton")
      
      await AgentWorkspace.updateHandoff(testDir, batonPath, {
        objective: "Test objective",
        progress: "50%",
        contextRatio: 0.75,
        targetTool: "claude_code",
      })
      
      const latest = await AgentWorkspace.getLatestBaton(testDir)
      expect(latest).not.toBeNull()
      expect(latest).toContain("test.md")
    })

    it("should return null when no handoff exists", async () => {
      const testDir = path.join(testWorkspace, "test-no-handoff")
      await AgentWorkspace.initialize(testDir)
      
      const latest = await AgentWorkspace.getLatestBaton(testDir)
      expect(latest).toBeNull()
    })
  })
})
