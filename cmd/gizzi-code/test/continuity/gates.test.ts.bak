// @ts-nocheck
import { describe, expect, it, beforeAll, afterAll } from "bun:test"
import { CIGates } from "@/continuity/gates"
import type { HandoffBaton, SessionContext, DAGTask } from "@/continuity/types"
import { Filesystem } from "@/util/filesystem"
import path from "path"
import { mkdir, writeFile, rmdir } from "fs/promises"

describe("CI Gates", () => {
  const testWorkspace = "/tmp/a2r-gates-test"
  
  beforeAll(async () => {
    // Create test workspace
    await mkdir(testWorkspace, { recursive: true })
    await writeFile(path.join(testWorkspace, "test.ts"), "// test file")
  })
  
  afterAll(async () => {
    // Cleanup
    try {
      await rmdir(testWorkspace, { recursive: true })
    } catch {}
  })

  const baseContext: SessionContext = {
    session_id: "test-session-12345",
    source_tool: "opencode",
    workspace_path: testWorkspace,
    time_start: Date.now(),
    objective: "Implement feature X",
    progress_summary: ["Created types", "Implemented core"],
    decisions: ["Use TypeScript for type safety"],
    open_todos: [
      { task: "Add unit tests for edge cases", priority: "high", blocking: false }
    ],
    dag_tasks: [
      { id: "t1", name: "Setup", description: "Initial setup", status: "completed", dependencies: [], priority: "medium", blocking: false },
      { id: "t2", name: "Implement", description: "Build the feature", status: "in_progress", dependencies: ["t1"], priority: "high", blocking: true },
    ],
    blockers: [],
    files_changed: [
      { path: "test.ts", summary: "Added test file", action: "created" }
    ],
    commands_executed: {
      build: ["npm run build"],
      test: [],
      lint: [],
      git: [],
      other: [],
    },
    errors_seen: [],
    next_actions: [
      { action: "test", description: "Run test suite for feature X", target: "test.ts" }
    ],
  }

  const baseBaton: HandoffBaton = {
    version: "1.0.0",
    session_context: baseContext,
    generated_at: Date.now(),
    compact_reason: "threshold",
  }

  describe("Evidence Gate", () => {
    it("should pass when all evidence is valid", async () => {
      const result = await CIGates.evidenceGate(baseBaton)
      
      expect(result.passed).toBe(true)
      expect(result.gate).toBe("evidence")
      expect(result.errors).toHaveLength(0)
    })

    it("should fail when referenced file doesn't exist", async () => {
      const badBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          files_changed: [
            { path: "nonexistent.ts", summary: "This file doesn't exist", action: "created" }
          ]
        }
      }

      const result = await CIGates.evidenceGate(badBaton)
      
      expect(result.passed).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain("nonexistent.ts")
    })

    it("should warn when no files changed", async () => {
      const emptyBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          files_changed: []
        }
      }

      const result = await CIGates.evidenceGate(emptyBaton)
      
      expect(result.warnings.some(w => w.includes("No files changed"))).toBe(true)
    })

    it("should validate receipt offset", async () => {
      const badBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          evidence: { receipt_offset: -5 }
        }
      }

      const result = await CIGates.evidenceGate(badBaton)
      
      expect(result.errors.some(e => e.includes("Invalid receipt offset"))).toBe(true)
    })

    it("should validate state hash format", async () => {
      const badBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          evidence: { state_hash: "invalid-hash!!!" }
        }
      }

      const result = await CIGates.evidenceGate(badBaton)
      
      expect(result.warnings.some(w => w.includes("State hash"))).toBe(true)
    })
  })

  describe("No-Lazy Gate", () => {
    it("should pass with concrete actions", async () => {
      const result = await CIGates.noLazyGate(baseBaton)
      
      expect(result.passed).toBe(true)
    })

    it("should fail on lazy patterns in objective", async () => {
      const lazyBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          objective: "I'll let you handle the rest of this feature"
        }
      }

      const result = await CIGates.noLazyGate(lazyBaton)
      
      expect(result.passed).toBe(false)
      expect(result.errors.some(e => e.includes("deferring responsibility"))).toBe(true)
    })

    it("should detect AI disclaimer patterns", async () => {
      const lazyBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          objective: "As an AI language model, I cannot complete this"
        }
      }

      const result = await CIGates.noLazyGate(lazyBaton)
      
      expect(result.errors.some(e => e.includes("AI disclaimer"))).toBe(true)
    })

    it("should fail when no next actions defined", async () => {
      const emptyBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          next_actions: []
        }
      }

      const result = await CIGates.noLazyGate(emptyBaton)
      
      expect(result.passed).toBe(false)
      expect(result.errors.some(e => e.includes("No next actions"))).toBe(true)
    })

    it("should warn on vague actions without targets", async () => {
      const vagueBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          next_actions: [
            { action: "edit", description: "Continue working on it" } // vague, no target
          ]
        }
      }

      const result = await CIGates.noLazyGate(vagueBaton)
      
      expect(result.warnings.some(w => w.includes("Vague action"))).toBe(true)
    })

    it("should warn on short TODO descriptions", async () => {
      const shortBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          open_todos: [
            { task: "Fix it", priority: "high", blocking: false } // too short
          ]
        }
      }

      const result = await CIGates.noLazyGate(shortBaton)
      
      expect(result.warnings.some(w => w.includes("TODO too vague"))).toBe(true)
    })

    it("should enforce strict mode", async () => {
      const warningBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          open_todos: [
            { task: "Fix it", priority: "high", blocking: false }
          ]
        }
      }

      const result = await CIGates.noLazyGate(warningBaton, { strict: true })
      
      // In strict mode, warnings become failures
      expect(result.passed).toBe(false)
    })
  })

  describe("Resume Gate", () => {
    it("should pass with valid context", async () => {
      const result = await CIGates.resumeGate(baseBaton)
      
      expect(result.passed).toBe(true)
    })

    it("should fail when workspace doesn't exist", async () => {
      const badBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          workspace_path: "/nonexistent/workspace"
        }
      }

      const result = await CIGates.resumeGate(badBaton)
      
      expect(result.passed).toBe(false)
      expect(result.errors.some(e => e.includes("Workspace does not exist"))).toBe(true)
    })

    it("should fail on missing objective", async () => {
      const badBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          objective: ""
        }
      }

      const result = await CIGates.resumeGate(badBaton)
      
      expect(result.errors.some(e => e.includes("objective"))).toBe(true)
    })

    it("should fail on invalid session ID", async () => {
      const badBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          session_id: "abc" // too short
        }
      }

      const result = await CIGates.resumeGate(badBaton)
      
      expect(result.errors.some(e => e.includes("Invalid session ID"))).toBe(true)
    })

    it("should fail without actionable items", async () => {
      const emptyBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          next_actions: [],
          open_todos: [],
          dag_tasks: []
        }
      }

      const result = await CIGates.resumeGate(emptyBaton)
      
      expect(result.errors.some(e => e.includes("No actionable items"))).toBe(true)
    })

    it("should warn on old sessions", async () => {
      const oldBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          time_start: Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago
        }
      }

      const result = await CIGates.resumeGate(oldBaton)
      
      expect(result.warnings.some(w => w.includes("30 days"))).toBe(true)
    })

    it("should warn on incomplete blocking tasks", async () => {
      const blockedBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          dag_tasks: [
            { id: "block", name: "Blocker", description: "Blocking task", status: "failed", dependencies: [], priority: "critical", blocking: true }
          ]
        }
      }

      const result = await CIGates.resumeGate(blockedBaton)
      
      expect(result.warnings.some(w => w.includes("blocking tasks incomplete"))).toBe(true)
    })

    it("should warn on baton near context limit", async () => {
      // Create a very large baton (need ~9000+ tokens with 10000 limit for 90% threshold)
      const largeContext: SessionContext = {
        ...baseContext,
        objective: "x".repeat(36000), // ~9000 tokens
        progress_summary: Array(100).fill("x".repeat(400)), // ~10000 tokens
      }
      const largeBaton: HandoffBaton = {
        ...baseBaton,
        session_context: largeContext,
      }

      const result = await CIGates.resumeGate(largeBaton, { maxContextTokens: 10000 })
      
      // With such a large baton, it will actually fail the size check, not just warn
      expect(result.errors.some(e => e.includes("Baton too large")) || 
             result.warnings.some(w => w.includes("near context limit"))).toBe(true)
    })

    it("should warn on target tool mismatch", async () => {
      const targetedBaton: HandoffBaton = {
        ...baseBaton,
        target_tool: "codex"
      }
      const result = await CIGates.resumeGate(targetedBaton, { targetTool: "claude_code" })
      
      expect(result.warnings.some(w => w.includes("targets codex"))).toBe(true)
    })
  })

  describe("Full Validation", () => {
    it("should run all gates and return report", async () => {
      const report = await CIGates.validate(baseBaton)
      
      expect(report.session_id).toBe("test-session-12345")
      expect(report.gates).toHaveLength(3)
      expect(report.gates.map(g => g.gate).sort()).toEqual(["evidence", "no-lazy", "resume"])
      expect(report.timestamp).toBeGreaterThan(0)
    })

    it("should indicate overall pass/fail", async () => {
      const goodReport = await CIGates.validate(baseBaton)
      expect(goodReport.passed).toBe(true)

      const badBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          workspace_path: "/nonexistent"
        }
      }
      const badReport = await CIGates.validate(badBaton)
      expect(badReport.passed).toBe(false)
    })
  })

  describe("Report Formatting", () => {
    it("should format report as markdown", async () => {
      const report = await CIGates.validate(baseBaton)
      const formatted = CIGates.formatReport(report)
      
      expect(formatted).toContain("# CI Gates Report")
      expect(formatted).toContain("test-session-12345")
      expect(formatted).toContain("✅ PASSED")
      expect(formatted).toContain("EVIDENCE")
      expect(formatted).toContain("NO-LAZY")
      expect(formatted).toContain("RESUME")
    })

    it("should show errors in formatted report", async () => {
      const badBaton: HandoffBaton = {
        ...baseBaton,
        session_context: {
          ...baseContext,
          objective: "I'll let you handle this", // lazy
          workspace_path: "/nonexistent", // bad path
        }
      }
      const report = await CIGates.validate(badBaton)
      const formatted = CIGates.formatReport(report)
      
      expect(formatted).toContain("❌ FAILED")
      expect(formatted).toContain("❌") // error marker
    })
  })
})
