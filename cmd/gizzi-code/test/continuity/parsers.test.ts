// @ts-nocheck
import { describe, expect, it, beforeAll, afterAll } from "bun:test"
import { ToolParsers } from "@/continuity/parsers"
import { mkdir, writeFile, rmdir } from "fs/promises"
import path from "path"

describe("Tool Parsers", () => {
  const testDir = "/tmp/allternit-parser-test"
  
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true })
  })
  
  afterAll(async () => {
    try {
      await rmdir(testDir, { recursive: true })
    } catch {}
  })

  describe("OpenCode Parser", () => {
    it("should parse basic OpenCode session", async () => {
      const sessionPath = path.join(testDir, "opencode-session")
      await mkdir(sessionPath, { recursive: true })
      
      const { source } = await ToolParsers.parseOpenCode(sessionPath, "test-123")
      
      expect(source.id).toBe("test-123")
      expect(source.tool).toBe("opencode")
      expect(source.workspace_path).toBe(sessionPath)
    })
  })

  describe("Claude Code Parser", () => {
    it("should parse Claude Code session with project.json", async () => {
      const sessionPath = path.join(testDir, "claude-session")
      await mkdir(sessionPath, { recursive: true })
      
      await writeFile(
        path.join(sessionPath, "project.json"),
        JSON.stringify({
          workspace: "/home/user/myproject",
          title: "Implement auth",
          created_at: "2026-01-15T10:00:00Z"
        })
      )
      
      const { source } = await ToolParsers.parseClaudeCode(sessionPath, "claude-456")
      
      expect(source.id).toBe("claude-456")
      expect(source.tool).toBe("claude_code")
      expect(source.workspace_path).toBe("/home/user/myproject")
      expect(source.title).toBe("Implement auth")
      expect(source.created_at).toBeGreaterThan(0)
    })

    it("should count messages from messages.jsonl", async () => {
      const sessionPath = path.join(testDir, "claude-session-2")
      await mkdir(sessionPath, { recursive: true })
      
      await writeFile(
        path.join(sessionPath, "messages.jsonl"),
        JSON.stringify({ role: "user", content: "Hello Claude" }) + "\n" +
        JSON.stringify({ role: "assistant", content: "Hello!" }) + "\n" +
        JSON.stringify({ role: "user", content: "Help me" }) + "\n"
      )
      
      const { source } = await ToolParsers.parseClaudeCode(sessionPath, "claude-789")
      
      expect(source.message_count).toBe(3)
      expect(source.title).toBe("Hello Claude")
    })
  })

  describe("Codex Parser", () => {
    it("should parse Codex session with metadata", async () => {
      const sessionPath = path.join(testDir, "codex-session")
      await mkdir(sessionPath, { recursive: true })
      
      await writeFile(
        path.join(sessionPath, "metadata.json"),
        JSON.stringify({
          workspace: "/home/user/codex-project",
          name: "Build API"
        })
      )
      
      await writeFile(
        path.join(sessionPath, "log.jsonl"),
        "{\"role\":\"user\"}\n{\"role\":\"assistant\"}\n"
      )
      
      const { source } = await ToolParsers.parseCodex(sessionPath, "codex-001")
      
      expect(source.tool).toBe("codex")
      expect(source.workspace_path).toBe("/home/user/codex-project")
      expect(source.title).toBe("Build API")
      expect(source.message_count).toBe(2)
    })
  })

  describe("Kimi Parser", () => {
    it("should parse Kimi session", async () => {
      const sessionPath = path.join(testDir, "kimi-session")
      await mkdir(sessionPath, { recursive: true })
      
      await writeFile(
        path.join(sessionPath, "session.json"),
        JSON.stringify({
          workspace: "/home/user/kimi-work",
          title: "Refactor code",
          created_at: 1704067200000,
          updated_at: 1704153600000
        })
      )
      
      await writeFile(
        path.join(sessionPath, "messages.json"),
        JSON.stringify([
          { role: "user", content: "Help refactor" },
          { role: "assistant", content: "Sure" },
          { role: "user", content: "Thanks" }
        ])
      )
      
      const { source } = await ToolParsers.parseKimi(sessionPath, "kimi-001")
      
      expect(source.tool).toBe("kimi")
      expect(source.workspace_path).toBe("/home/user/kimi-work")
      expect(source.title).toBe("Help refactor")
      expect(source.message_count).toBe(3)
      expect(source.created_at).toBe(1704067200000)
      expect(source.modified_at).toBe(1704153600000)
    })
  })

  describe("Qwen Parser", () => {
    it("should parse Qwen session", async () => {
      const sessionPath = path.join(testDir, "qwen-session")
      await mkdir(sessionPath, { recursive: true })
      
      await writeFile(
        path.join(sessionPath, "meta.json"),
        JSON.stringify({
          workspace: "/home/user/qwen-work",
          session_name: "Debug issue",
          created_at: 1704067200000,
          message_count: 15
        })
      )
      
      const { source } = await ToolParsers.parseQwen(sessionPath, "qwen-001")
      
      expect(source.tool).toBe("qwen")
      expect(source.workspace_path).toBe("/home/user/qwen-work")
      expect(source.title).toBe("Debug issue")
      expect(source.message_count).toBe(15)
    })
  })

  describe("MiniMax Parser", () => {
    it("should parse MiniMax session", async () => {
      const sessionPath = path.join(testDir, "minimax-session")
      await mkdir(sessionPath, { recursive: true })
      
      await writeFile(
        path.join(sessionPath, "session.json"),
        JSON.stringify({
          title: "Code review",
          message_count: 8,
          workspace: "/home/user/minimax-work"
        })
      )
      
      const { source } = await ToolParsers.parseMinimax(sessionPath, "minimax-001")
      
      expect(source.tool).toBe("minimax")
      expect(source.title).toBe("Code review")
      expect(source.message_count).toBe(8)
    })
  })

  describe("GLM Parser", () => {
    it("should parse GLM JSON session", async () => {
      const sessionPath = path.join(testDir, "glm-session")
      await mkdir(sessionPath, { recursive: true })
      
      await writeFile(
        path.join(sessionPath, "session.json"),
        JSON.stringify({
          title: "Generate docs",
          message_count: 5
        })
      )
      
      const { source } = await ToolParsers.parseGLM(sessionPath, "glm-001")
      
      expect(source.tool).toBe("glm")
      expect(source.title).toBe("Generate docs")
      expect(source.message_count).toBe(5)
    })

    it("should parse GLM JSONL session", async () => {
      const sessionPath = path.join(testDir, "glm-session-2")
      await mkdir(sessionPath, { recursive: true })
      
      await writeFile(
        path.join(sessionPath, "history.jsonl"),
        JSON.stringify({ role: "user" }) + "\n" +
        JSON.stringify({ role: "assistant" }) + "\n" +
        JSON.stringify({ role: "user" }) + "\n"
      )
      
      const { source } = await ToolParsers.parseGLM(sessionPath, "glm-002")
      
      expect(source.tool).toBe("glm")
      expect(source.message_count).toBe(3)
    })
  })

  describe("Generic Parser", () => {
    it("should parse generic session", async () => {
      const { source } = await ToolParsers.parseGeneric(
        "/tmp/test",
        "generic-001",
        "unknown"
      )
      
      expect(source.id).toBe("generic-001")
      expect(source.tool).toBe("unknown")
      expect(source.workspace_path).toBe("/tmp/test")
      expect(source.title).toBe("generic-001")
    })
  })
})
