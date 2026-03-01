import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { Checkpoint } from "../../src/agent-workspace/checkpoint"
import { AgentWorkspace } from "../../src/agent-workspace/artifacts"
import { tmpdir } from "../fixture/fixture"

describe("checkpoint", () => {
  describe("create()", () => {
    test("creates checkpoint with basic options", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const checkpoint = await Checkpoint.create(tmp.path, {
        reason: "test",
        description: "Test checkpoint",
      })

      expect(checkpoint.id).toMatch(/^checkpoint-/)
      expect(checkpoint.timestamp).toBeGreaterThan(0)
      expect(checkpoint.description).toBe("Test checkpoint")
      expect(checkpoint.reason).toBe("test")
      expect(checkpoint.stateHash).toBeTruthy()
      expect(typeof checkpoint.files).toBe("object")
      expect(checkpoint.receiptOffset).toBe(0)
    })

    test("creates checkpoint with tags", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const checkpoint = await Checkpoint.create(tmp.path, {
        reason: "test",
        tags: ["important", "pre-change"],
      })

      expect(checkpoint.tags).toEqual(["important", "pre-change"])
    })

    test("includes file snapshots in checkpoint", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create a test file
      const testFile = path.join(tmp.path, "test.txt")
      await fs.writeFile(testFile, "Hello, World!", "utf-8")

      const checkpoint = await Checkpoint.create(tmp.path, { reason: "test" })

      expect(Object.keys(checkpoint.files).length).toBeGreaterThan(0)
      expect(checkpoint.files["test.txt"]).toBeDefined()
      expect(checkpoint.files["test.txt"].hash).toBeTruthy()
      expect(checkpoint.files["test.txt"].size).toBe(13)
      expect(checkpoint.files["test.txt"].content).toBe("Hello, World!")
    })

    test("excludes .a2r directory from snapshots", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create a file in .a2r
      const a2rFile = path.join(tmp.path, ".a2r", "test.txt")
      await fs.writeFile(a2rFile, "should not be included", "utf-8")

      const checkpoint = await Checkpoint.create(tmp.path, { reason: "test" })

      expect(checkpoint.files[".a2r/test.txt"]).toBeUndefined()
    })

    test("excludes node_modules from snapshots", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create node_modules structure
      await fs.mkdir(path.join(tmp.path, "node_modules", "test-pkg"), { recursive: true })
      await fs.writeFile(
        path.join(tmp.path, "node_modules", "test-pkg", "index.js"),
        "module.exports = {}",
        "utf-8"
      )

      const checkpoint = await Checkpoint.create(tmp.path, { reason: "test" })

      const nodeModulesFiles = Object.keys(checkpoint.files).filter(f => f.startsWith("node_modules"))
      expect(nodeModulesFiles.length).toBe(0)
    })

    test("includes content for small files only", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create small file
      await fs.writeFile(path.join(tmp.path, "small.txt"), "small", "utf-8")
      
      // Create large file (> 10KB)
      const largeContent = "x".repeat(15 * 1024)
      await fs.writeFile(path.join(tmp.path, "large.txt"), largeContent, "utf-8")

      const checkpoint = await Checkpoint.create(tmp.path, { 
        reason: "test",
        includeContent: true 
      })

      expect(checkpoint.files["small.txt"].content).toBe("small")
      expect(checkpoint.files["large.txt"].content).toBeUndefined()
    })

    test("auto-prunes after creation", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create more than 10 checkpoints quickly
      for (let i = 0; i < 12; i++) {
        await Checkpoint.create(tmp.path, { reason: "test" })
      }

      const checkpoints = await Checkpoint.list(tmp.path)
      // Should be pruned to 10
      expect(checkpoints.length).toBeLessThanOrEqual(10)
    })
  })

  describe("list()", () => {
    test("returns empty array when no checkpoints exist", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const checkpoints = await Checkpoint.list(tmp.path)

      expect(checkpoints).toEqual([])
    })

    test("returns checkpoints sorted by timestamp (newest first)", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create checkpoints with small delay
      await Checkpoint.create(tmp.path, { reason: "test" })
      await new Promise(r => setTimeout(r, 10))
      await Checkpoint.create(tmp.path, { reason: "test" })
      await new Promise(r => setTimeout(r, 10))
      await Checkpoint.create(tmp.path, { reason: "test" })

      const checkpoints = await Checkpoint.list(tmp.path)

      expect(checkpoints.length).toBe(3)
      // Verify descending order
      for (let i = 1; i < checkpoints.length; i++) {
        expect(checkpoints[i - 1].timestamp).toBeGreaterThanOrEqual(checkpoints[i].timestamp)
      }
    })

    test("filters out corrupted checkpoints", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create a valid checkpoint
      await Checkpoint.create(tmp.path, { reason: "test" })

      // Create a corrupted checkpoint file
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(
        path.join(paths.l1_checkpoints, "checkpoint-corrupt.json"),
        JSON.stringify({ id: "corrupt", stateHash: "invalid" }),
        "utf-8"
      )

      const checkpoints = await Checkpoint.list(tmp.path)

      // Should only return the valid one
      expect(checkpoints.length).toBe(1)
      expect(checkpoints[0].reason).toBe("test")
    })
  })

  describe("get()", () => {
    test("returns checkpoint by id", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const created = await Checkpoint.create(tmp.path, { 
        reason: "test",
        description: "Specific checkpoint" 
      })

      const retrieved = await Checkpoint.get(tmp.path, created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(created.id)
      expect(retrieved!.description).toBe("Specific checkpoint")
    })

    test("returns null for non-existent checkpoint", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const retrieved = await Checkpoint.get(tmp.path, "non-existent")

      expect(retrieved).toBeNull()
    })

    test("returns null for corrupted checkpoint", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create a corrupted checkpoint file
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.mkdir(paths.l1_checkpoints, { recursive: true })
      await fs.writeFile(
        path.join(paths.l1_checkpoints, "checkpoint-bad.json"),
        JSON.stringify({ 
          id: "checkpoint-bad", 
          stateHash: "tampered",
          timestamp: Date.now(),
          files: {},
          receiptOffset: 0,
          description: "Corrupted"
        }),
        "utf-8"
      )

      const retrieved = await Checkpoint.get(tmp.path, "checkpoint-bad")

      expect(retrieved).toBeNull()
    })
  })

  describe("getLatest()", () => {
    test("returns most recent checkpoint", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      await Checkpoint.create(tmp.path, { reason: "test", description: "First" })
      await new Promise(r => setTimeout(r, 10))
      await Checkpoint.create(tmp.path, { reason: "test", description: "Second" })

      const latest = await Checkpoint.getLatest(tmp.path)

      expect(latest).not.toBeNull()
      expect(latest!.description).toBe("Second")
    })

    test("returns null when no checkpoints exist", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const latest = await Checkpoint.getLatest(tmp.path)

      expect(latest).toBeNull()
    })
  })

  describe("restore()", () => {
    test("restores file content from checkpoint", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create and checkpoint a file
      const testFile = path.join(tmp.path, "restore-test.txt")
      await fs.writeFile(testFile, "original content", "utf-8")
      const checkpoint = await Checkpoint.create(tmp.path, { reason: "test" })

      // Modify the file
      await fs.writeFile(testFile, "modified content", "utf-8")

      // Restore from checkpoint
      await Checkpoint.restore(tmp.path, checkpoint.id)

      // Verify restoration
      const content = await fs.readFile(testFile, "utf-8")
      expect(content).toBe("original content")
    })

    test("throws error for non-existent checkpoint", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      await expect(Checkpoint.restore(tmp.path, "non-existent")).rejects.toThrow()
    })

    test("throws error for corrupted checkpoint", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create a corrupted checkpoint file
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.mkdir(paths.l1_checkpoints, { recursive: true })
      await fs.writeFile(
        path.join(paths.l1_checkpoints, "checkpoint-bad.json"),
        JSON.stringify({ 
          id: "checkpoint-bad",
          timestamp: Date.now(),
          description: "Bad",
          files: {},
          receiptOffset: 0,
          stateHash: "tampered"
        }),
        "utf-8"
      )

      await expect(Checkpoint.restore(tmp.path, "checkpoint-bad")).rejects.toThrow()
    })

    test("truncates memory.jsonl to receipt offset", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Add entries to memory
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(
        paths.l1_memory_jsonl,
        JSON.stringify({ type: "entry1" }) + "\n" +
        JSON.stringify({ type: "entry2" }) + "\n" +
        JSON.stringify({ type: "entry3" }) + "\n",
        "utf-8"
      )

      // Create checkpoint after 2 entries
      const checkpoint = await Checkpoint.create(tmp.path, { reason: "test" })

      // Add more entries
      await fs.appendFile(paths.l1_memory_jsonl, JSON.stringify({ type: "entry4" }) + "\n", "utf-8")

      // Restore checkpoint
      await Checkpoint.restore(tmp.path, checkpoint.id)

      // Verify memory was truncated
      const memory = await fs.readFile(paths.l1_memory_jsonl, "utf-8")
      const lines = memory.trim().split("\n").filter(Boolean)
      expect(lines.length).toBe(checkpoint.receiptOffset)
    })
  })

  describe("prune()", () => {
    test("keeps specified number of checkpoints", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create 5 checkpoints
      for (let i = 0; i < 5; i++) {
        await Checkpoint.create(tmp.path, { reason: "test" })
        await new Promise(r => setTimeout(r, 10))
      }

      const removed = await Checkpoint.prune(tmp.path, { keepCount: 2 })

      expect(removed).toBe(3)
      const remaining = await Checkpoint.list(tmp.path)
      expect(remaining.length).toBe(2)
    })

    test("removes checkpoints older than specified age", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create checkpoint
      await Checkpoint.create(tmp.path, { reason: "test" })

      // Wait a bit
      await new Promise(r => setTimeout(r, 100))

      // Create another checkpoint
      await Checkpoint.create(tmp.path, { reason: "test" })

      // Prune checkpoints older than 50ms
      const removed = await Checkpoint.prune(tmp.path, { 
        keepCount: 0, 
        olderThan: 50 
      })

      expect(removed).toBe(1)
      const remaining = await Checkpoint.list(tmp.path)
      expect(remaining.length).toBe(1)
    })

    test("preserves checkpoints with excluded tags", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Create checkpoint with important tag
      await Checkpoint.create(tmp.path, { 
        reason: "test", 
        tags: ["important"] 
      })
      await new Promise(r => setTimeout(r, 10))

      // Create checkpoint without tag
      await Checkpoint.create(tmp.path, { reason: "test" })

      // Prune but preserve important
      const removed = await Checkpoint.prune(tmp.path, { 
        keepCount: 0,
        excludeTags: ["important"]
      })

      expect(removed).toBe(1)
      const remaining = await Checkpoint.list(tmp.path)
      expect(remaining[0].tags).toContain("important")
    })

    test("returns 0 when no checkpoints to prune", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const removed = await Checkpoint.prune(tmp.path, { keepCount: 5 })

      expect(removed).toBe(0)
    })
  })

  describe("deleteCheckpoint()", () => {
    test("deletes specific checkpoint", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const checkpoint = await Checkpoint.create(tmp.path, { reason: "test" })
      
      const deleted = await Checkpoint.deleteCheckpoint(tmp.path, checkpoint.id)

      expect(deleted).toBe(true)
      const retrieved = await Checkpoint.get(tmp.path, checkpoint.id)
      expect(retrieved).toBeNull()
    })

    test("returns false for non-existent checkpoint", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const deleted = await Checkpoint.deleteCheckpoint(tmp.path, "non-existent")

      expect(deleted).toBe(false)
    })
  })

  describe("startAutoCheckpoint()", () => {
    test("starts auto-checkpoint timer", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      expect(Checkpoint.isAutoCheckpointActive(tmp.path)).toBe(false)

      await Checkpoint.startAutoCheckpoint(tmp.path, 100) // 100ms interval

      expect(Checkpoint.isAutoCheckpointActive(tmp.path)).toBe(true)

      // Clean up
      Checkpoint.stopAutoCheckpoint(tmp.path)
    })

    test("creates initial checkpoint immediately", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      await Checkpoint.startAutoCheckpoint(tmp.path, 60000) // 60s interval

      // Should have created one checkpoint immediately
      const checkpoints = await Checkpoint.list(tmp.path)
      expect(checkpoints.length).toBe(1)
      expect(checkpoints[0].reason).toBe("auto")

      // Clean up
      Checkpoint.stopAutoCheckpoint(tmp.path)
    })

    test("replaces existing timer when called again", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      await Checkpoint.startAutoCheckpoint(tmp.path, 60000)
      await Checkpoint.startAutoCheckpoint(tmp.path, 30000)

      expect(Checkpoint.isAutoCheckpointActive(tmp.path)).toBe(true)

      // Clean up
      Checkpoint.stopAutoCheckpoint(tmp.path)
    })
  })

  describe("stopAutoCheckpoint()", () => {
    test("stops auto-checkpoint timer", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      await Checkpoint.startAutoCheckpoint(tmp.path, 60000)
      expect(Checkpoint.isAutoCheckpointActive(tmp.path)).toBe(true)

      Checkpoint.stopAutoCheckpoint(tmp.path)
      expect(Checkpoint.isAutoCheckpointActive(tmp.path)).toBe(false)
    })

    test("does nothing when no timer exists", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Should not throw
      Checkpoint.stopAutoCheckpoint(tmp.path)
      expect(Checkpoint.isAutoCheckpointActive(tmp.path)).toBe(false)
    })
  })

  describe("isAutoCheckpointActive()", () => {
    test("returns false when no auto-checkpoint is running", async () => {
      await using tmp = await tmpdir()

      expect(Checkpoint.isAutoCheckpointActive(tmp.path)).toBe(false)
    })

    test("returns true when auto-checkpoint is running", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      await Checkpoint.startAutoCheckpoint(tmp.path, 60000)

      expect(Checkpoint.isAutoCheckpointActive(tmp.path)).toBe(true)

      Checkpoint.stopAutoCheckpoint(tmp.path)
    })
  })

  describe("stateHash verification", () => {
    test("creates verifiable state hash", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const checkpoint = await Checkpoint.create(tmp.path, { 
        reason: "test",
        description: "Hash test"
      })

      expect(checkpoint.stateHash).toBeTruthy()
      expect(checkpoint.stateHash.length).toBe(64) // SHA-256 hex length
    })

    test("checkpoint fails integrity check when tampered", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      await Checkpoint.create(tmp.path, { reason: "test" })

      // Tamper with the checkpoint file
      const paths = AgentWorkspace.getPaths(tmp.path)
      const checkpointFiles = await fs.readdir(paths.l1_checkpoints)
      const checkpointFile = checkpointFiles.find(f => f.endsWith(".json"))
      expect(checkpointFile).toBeTruthy()

      const checkpointPath = path.join(paths.l1_checkpoints, checkpointFile!)
      const data = JSON.parse(await fs.readFile(checkpointPath, "utf-8"))
      data.description = "Tampered"
      await fs.writeFile(checkpointPath, JSON.stringify(data), "utf-8")

      // Should not appear in list due to failed integrity check
      const checkpoints = await Checkpoint.list(tmp.path)
      expect(checkpoints.length).toBe(0)
    })
  })

  describe("receiptOffset", () => {
    test("tracks memory.jsonl line count", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Add some entries
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(
        paths.l1_memory_jsonl,
        JSON.stringify({ type: "test1" }) + "\n" +
        JSON.stringify({ type: "test2" }) + "\n",
        "utf-8"
      )

      const checkpoint = await Checkpoint.create(tmp.path, { reason: "test" })

      expect(checkpoint.receiptOffset).toBe(2)
    })

    test("handles empty memory.jsonl", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const checkpoint = await Checkpoint.create(tmp.path, { reason: "test" })

      expect(checkpoint.receiptOffset).toBe(0)
    })
  })
})
