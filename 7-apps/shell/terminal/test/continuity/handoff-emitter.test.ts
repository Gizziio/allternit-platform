import { describe, expect, it } from "bun:test"
import { HandoffEmitter } from "@/continuity/handoff-emitter"
import type { SessionContext } from "@/continuity/types"

describe("HandoffEmitter", () => {
  const mockContext: SessionContext = {
    session_id: "test-session-123",
    source_tool: "opencode",
    workspace_path: "/tmp/test-workspace",
    time_start: 1704067200000,
    time_end: 1704070800000,
    objective: "Implement session handoff feature",
    progress_summary: [
      "Created context types",
      "Implemented handoff emitter",
      "Added session discovery",
    ],
    decisions: [
      "Use JSONL for receipts",
      "Implement TTL-based caching",
    ],
    open_todos: [
      { task: "Add CI gates", priority: "high", blocking: false },
      { task: "Write documentation", priority: "medium", blocking: false },
    ],
    dag_tasks: [
      { id: "setup", name: "Setup", description: "Initial project setup", status: "completed", dependencies: [], priority: "high", blocking: false },
      { id: "types", name: "Types", description: "Create type definitions", status: "completed", dependencies: ["setup"], priority: "high", blocking: false },
      { id: "emitter", name: "Emitter", description: "Implement handoff emitter", status: "in_progress", dependencies: ["types"], priority: "medium", blocking: false },
    ],
    blockers: [],
    files_changed: [
      { path: "src/continuity/types.ts", summary: "Added session types", action: "created" },
      { path: "src/continuity/index.ts", summary: "Implemented session discovery", action: "modified" },
    ],
    commands_executed: {
      build: ["npm run build"],
      test: ["bun test"],
      lint: [],
      git: ["git add .", "git commit -m \"feat: continuity module\""],
      other: [],
    },
    errors_seen: [],
    next_actions: [
      { action: "test", description: "Run all tests", target: "test/continuity/" },
      { action: "edit", description: "Add CI gates" },
    ],
    limits: {
      context_ratio: 0.75,
      quota_ratio: 0.5,
      tokens_input: 15000,
      tokens_output: 5000,
      tokens_total: 20000,
      context_window: 200000,
      cost_estimate: 0.05,
      throttle_count: 0,
    },
  }

  describe("emitMarkdown", () => {
    it("should generate markdown with all sections", () => {
      const markdown = HandoffEmitter.emitMarkdown({
        context: mockContext,
        compact_reason: "threshold",
      })

      // Check header
      expect(markdown).toContain("# A2R Session Baton")
      expect(markdown).toContain("test-session-123")
      expect(markdown).toContain("opencode")

      // Check all 13 sections
      expect(markdown).toContain("## Objective")
      expect(markdown).toContain("## Current Plan")
      expect(markdown).toContain("## Work Completed")
      expect(markdown).toContain("## Files Changed")
      expect(markdown).toContain("## Commands Executed")
      expect(markdown).toContain("## Errors / Blockers")
      expect(markdown).toContain("## Decisions Made")
      expect(markdown).toContain("## Open TODOs")
      expect(markdown).toContain("## DAG Tasks")
      expect(markdown).toContain("## Next")
      expect(markdown).toContain("## Evidence Pointers")
      expect(markdown).toContain("## Limits Snapshot")
    })

    it("should include context information", () => {
      const markdown = HandoffEmitter.emitMarkdown({
        context: mockContext,
        compact_reason: "threshold",
      })

      expect(markdown).toContain("Implement session handoff feature")
      expect(markdown).toContain("src/continuity/types.ts")
      expect(markdown).toContain("Created")
      expect(markdown).toContain("npm run build")
      expect(markdown).toContain("bun test")
    })

    it("should include target tool when specified", () => {
      const markdown = HandoffEmitter.emitMarkdown({
        context: mockContext,
        target_tool: "claude_code",
        compact_reason: "quota",
      })

      expect(markdown).toContain("Target:** claude_code")
      expect(markdown).toContain("Reason:** quota")
    })

    it("should format TODOs with priority", () => {
      const markdown = HandoffEmitter.emitMarkdown({
        context: mockContext,
        compact_reason: "threshold",
      })

      expect(markdown).toContain("[HIGH]")
      expect(markdown).toContain("Add CI gates")
    })

    it("should format limits snapshot", () => {
      const markdown = HandoffEmitter.emitMarkdown({
        context: mockContext,
        compact_reason: "threshold",
      })

      expect(markdown).toContain("75.0%") // context ratio
      expect(markdown).toContain("20,000") // tokens total
      expect(markdown).toContain("$0.0500") // cost
    })
  })

  describe("emitJSON", () => {
    it("should generate valid JSON baton", () => {
      const baton = HandoffEmitter.emitJSON({
        context: mockContext,
        target_tool: "claude_code",
        compact_reason: "threshold",
      })

      expect(baton.version).toBe("1.0.0")
      expect(baton.session_context.session_id).toBe("test-session-123")
      expect(baton.target_tool).toBe("claude_code")
      expect(baton.compact_reason).toBe("threshold")
      expect(baton.generated_at).toBeGreaterThan(0)
    })

    it("should include all context fields", () => {
      const baton = HandoffEmitter.emitJSON({
        context: mockContext,
        compact_reason: "manual",
      })

      expect(baton.session_context.objective).toBe("Implement session handoff feature")
      expect(baton.session_context.files_changed.length).toBe(2)
      expect(baton.session_context.next_actions.length).toBe(2)
    })
  })

  describe("edge cases", () => {
    it("should handle empty context gracefully", () => {
      const emptyContext: SessionContext = {
        session_id: "empty-session",
        source_tool: "a2r_shell",
        workspace_path: "/tmp",
        time_start: Date.now(),
        objective: "",
        progress_summary: [],
        decisions: [],
        open_todos: [],
        dag_tasks: [],
        blockers: [],
        files_changed: [],
        commands_executed: { build: [], test: [], lint: [], git: [], other: [] },
        errors_seen: [],
        next_actions: [],
      }

      const markdown = HandoffEmitter.emitMarkdown({
        context: emptyContext,
        compact_reason: "error",
      })

      expect(markdown).toContain("# A2R Session Baton")
      expect(markdown).toContain("Reason:** error")
      expect(markdown).toContain("- No files modified")
      expect(markdown).toContain("- No commands recorded")
    })

    it("should handle blockers and errors", () => {
      const contextWithErrors: SessionContext = {
        ...mockContext,
        blockers: ["Tests failing"],
        errors_seen: [
          { message: "Syntax error in parser.ts", tool: "tsc", recoverable: false }
        ],
      }

      const markdown = HandoffEmitter.emitMarkdown({
        context: contextWithErrors,
        compact_reason: "error",
      })

      expect(markdown).toContain("Tests failing")
      expect(markdown).toContain("Syntax error in parser.ts")
      expect(markdown).toContain("[Blocking]")
    })
  })
})
