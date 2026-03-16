// @ts-nocheck
import { describe, expect, it } from "bun:test"
import type { SessionContext, SessionSource, ToolType, HandoffBaton, UnifiedIndex } from "@/continuity/types"

describe("Continuity Types", () => {
  describe("SessionSource", () => {
    it("should allow valid session source", () => {
      const source: SessionSource = {
        id: "test-session-123",
        tool: "opencode",
        workspace_path: "/tmp/test",
        created_at: Date.now(),
        modified_at: Date.now(),
        message_count: 5,
        title: "Test Session",
      }
      
      expect(source.id).toBe("test-session-123")
      expect(source.tool).toBe("opencode")
      expect(source.title).toBe("Test Session")
    })
    
    it("should allow unknown tool type", () => {
      const source: SessionSource = {
        id: "test-session",
        tool: "unknown",
        workspace_path: "/tmp/test",
        created_at: Date.now(),
        modified_at: Date.now(),
        message_count: 0,
      }
      
      expect(source.tool).toBe("unknown")
    })
  })
  
  describe("SessionContext", () => {
    it("should allow valid session context", () => {
      const context: SessionContext = {
        session_id: "test-session",
        source_tool: "claude_code",
        workspace_path: "/tmp/test",
        time_start: Date.now(),
        time_end: Date.now(),
        objective: "Test objective",
        progress_summary: ["Step 1 completed", "Step 2 completed"],
        decisions: ["Use TypeScript"],
        open_todos: [
          { task: "Finish tests", priority: "high", blocking: false }
        ],
        dag_tasks: [
          { id: "task-1", name: "Setup", description: "Initial setup", status: "completed", dependencies: [], priority: "high", blocking: false }
        ],
        blockers: [],
        files_changed: [
          { path: "test.ts", summary: "Added tests", action: "created" }
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
          { action: "edit", description: "Add more tests" }
        ],
      }
      
      expect(context.session_id).toBe("test-session")
      expect(context.progress_summary.length).toBe(2)
      expect(context.files_changed[0].action).toBe("created")
    })
  })
  
  describe("HandoffBaton", () => {
    it("should allow valid handoff baton", () => {
      const baton: HandoffBaton = {
        version: "1.0.0",
        session_context: {
          session_id: "test-session",
          source_tool: "opencode",
          workspace_path: "/tmp/test",
          time_start: Date.now(),
          objective: "Test",
          progress_summary: [],
          decisions: [],
          open_todos: [],
          dag_tasks: [],
          blockers: [],
          files_changed: [],
          commands_executed: { build: [], test: [], lint: [], git: [], other: [] },
          errors_seen: [],
          next_actions: [],
        },
        generated_at: Date.now(),
        target_tool: "claude_code",
        compact_reason: "threshold",
      }
      
      expect(baton.version).toBe("1.0.0")
      expect(baton.compact_reason).toBe("threshold")
    })
  })
  
  describe("UnifiedIndex", () => {
    it("should allow valid unified index", () => {
      const index: UnifiedIndex = {
        entries: [
          {
            session_id: "test-1",
            tool: "opencode",
            workspace_path: "/tmp/test",
            modified_at: Date.now(),
            ttl_expires_at: Date.now() + 300000,
          }
        ],
        last_scan_at: Date.now(),
        scan_ttl_ms: 300000,
      }
      
      expect(index.entries.length).toBe(1)
      expect(index.scan_ttl_ms).toBe(300000)
    })
  })
  
  describe("ToolType", () => {
    const allTools: ToolType[] = [
      "opencode",
      "claude_code",
      "codex",
      "copilot",
      "cursor",
      "gemini_cli",
      "droid",
      "a2r_shell",
      "qwen",
      "kimi",
      "minimax",
      "glm",
      "unknown",
    ]
    
    it("should allow all defined tool types", () => {
      for (const tool of allTools) {
        const source: SessionSource = {
          id: "test",
          tool,
          workspace_path: "/tmp",
          created_at: 0,
          modified_at: 0,
          message_count: 0,
        }
        expect(source.tool).toBe(tool)
      }
    })
    
    it("should support Chinese AI tools", () => {
      const chineseTools: ToolType[] = ["qwen", "kimi", "minimax", "glm"]
      for (const tool of chineseTools) {
        const source: SessionSource = {
          id: `${tool}-session`,
          tool,
          workspace_path: `/tmp/${tool}`,
          created_at: Date.now(),
          modified_at: Date.now(),
          message_count: 10,
        }
        expect(source.tool).toBe(tool)
      }
    })
  })
})
