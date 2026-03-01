/**
 * A2R Continuity - Tool Parsers
 * 
 * Tool-specific parsers for extracting rich session data
 */

import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
import path from "path"
import type { SessionSource, ToolType, SessionContext } from "../types"

const log = Log.create({ service: "continuity.parsers" })

export namespace ToolParsers {
  /**
   * Parse an A2R session
   * A2R uses SQLite database for conversation storage
   */
  export async function parseA2R(
    sessionPath: string, 
    id: string
  ): Promise<{ source: SessionSource; context?: Partial<SessionContext> }> {
    log.debug("Parsing A2R session", { path: sessionPath, id })
    
    const dbPath = path.join(sessionPath, "state.vscdb")
    const workspacePath = path.join(sessionPath, "workspace")
    
    // Basic info we can get without parsing SQLite
    const source: SessionSource = {
      id,
      tool: "a2r",
      workspace_path: sessionPath,
      created_at: Date.now(), // Would come from DB
      modified_at: Date.now(), // Would come from DB
      message_count: 0, // Would count from DB
    }
    
    // Try to read workspace info
    try {
      const workspaceExists = await Filesystem.exists(workspacePath)
      if (workspaceExists) {
        source.workspace_path = workspacePath
      }
    } catch {}
    
    return { source }
  }

  /**
   * Parse a Claude Code session
   * Claude Code uses JSONL files for conversation history
   */
  export async function parseClaudeCode(
    sessionPath: string,
    id: string
  ): Promise<{ source: SessionSource; context?: Partial<SessionContext> }> {
    log.debug("Parsing Claude Code session", { path: sessionPath, id })
    
    const messagesPath = path.join(sessionPath, "messages.jsonl")
    const projectPath = path.join(sessionPath, "project.json")
    
    const source: SessionSource = {
      id,
      tool: "claude_code",
      workspace_path: sessionPath,
      created_at: Date.now(),
      modified_at: Date.now(),
      message_count: 0,
    }
    
    // Try to read project info
    try {
      const projectExists = await Filesystem.exists(projectPath)
      if (projectExists) {
        const projectData = await Filesystem.readJson(projectPath)
        if (projectData.workspace) {
          source.workspace_path = projectData.workspace
        }
        if (projectData.title) {
          source.title = projectData.title
        }
        if (projectData.created_at) {
          source.created_at = new Date(projectData.created_at).getTime()
        }
      }
    } catch (e) {
      log.debug("Failed to read Claude Code project.json", { error: e })
    }
    
    // Count messages
    try {
      const messagesExist = await Filesystem.exists(messagesPath)
      if (messagesExist) {
        const content = await Filesystem.readText(messagesPath)
        source.message_count = content.split("\n").filter(line => line.trim()).length
        
        // Extract first user message for objective
        const lines = content.split("\n").filter(Boolean)
        for (const line of lines) {
          try {
            const msg = JSON.parse(line)
            if (msg.role === "user" && msg.content) {
              source.title = msg.content.slice(0, 100)
              break
            }
          } catch {}
        }
      }
    } catch {}
    
    return { source }
  }

  /**
   * Parse a Codex session
   * Codex uses similar JSONL format to Claude Code
   */
  export async function parseCodex(
    sessionPath: string,
    id: string
  ): Promise<{ source: SessionSource; context?: Partial<SessionContext> }> {
    log.debug("Parsing Codex session", { path: sessionPath, id })
    
    const logPath = path.join(sessionPath, "log.jsonl")
    const metaPath = path.join(sessionPath, "metadata.json")
    
    const source: SessionSource = {
      id,
      tool: "codex",
      workspace_path: sessionPath,
      created_at: Date.now(),
      modified_at: Date.now(),
      message_count: 0,
    }
    
    // Read metadata
    try {
      const metaExists = await Filesystem.exists(metaPath)
      if (metaExists) {
        const meta = await Filesystem.readJson(metaPath)
        if (meta.workspace) {
          source.workspace_path = meta.workspace
        }
        if (meta.title || meta.name) {
          source.title = meta.title || meta.name
        }
      }
    } catch {}
    
    // Count messages
    try {
      const logExists = await Filesystem.exists(logPath)
      if (logExists) {
        const content = await Filesystem.readText(logPath)
        source.message_count = content.split("\n").filter(line => line.trim()).length
      }
    } catch {}
    
    return { source }
  }

  /**
   * Parse a Kimi session
   * Kimi uses structured JSON format
   */
  export async function parseKimi(
    sessionPath: string,
    id: string
  ): Promise<{ source: SessionSource; context?: Partial<SessionContext> }> {
    log.debug("Parsing Kimi session", { path: sessionPath, id })
    
    const sessionFile = path.join(sessionPath, "session.json")
    const messagesFile = path.join(sessionPath, "messages.json")
    
    const source: SessionSource = {
      id,
      tool: "kimi",
      workspace_path: sessionPath,
      created_at: Date.now(),
      modified_at: Date.now(),
      message_count: 0,
    }
    
    // Try to read Kimi session format
    try {
      const sessionExists = await Filesystem.exists(sessionFile)
      if (sessionExists) {
        const data = await Filesystem.readJson(sessionFile)
        if (data.workspace) source.workspace_path = data.workspace
        if (data.title) source.title = data.title
        if (data.created_at) source.created_at = data.created_at
        if (data.updated_at) source.modified_at = data.updated_at
      }
    } catch {}
    
    // Count messages
    try {
      const messagesExists = await Filesystem.exists(messagesFile)
      if (messagesExists) {
        const data = await Filesystem.readJson(messagesFile)
        if (Array.isArray(data)) {
          source.message_count = data.length
          // Extract first user message
          const firstUser = data.find((m: any) => m.role === "user")
          if (firstUser?.content) {
            source.title = String(firstUser.content).slice(0, 100)
          }
        }
      }
    } catch {}
    
    return { source }
  }

  /**
   * Parse a Qwen session
   * Qwen stores sessions with metadata
   */
  export async function parseQwen(
    sessionPath: string,
    id: string
  ): Promise<{ source: SessionSource; context?: Partial<SessionContext> }> {
    log.debug("Parsing Qwen session", { path: sessionPath, id })
    
    const metaPath = path.join(sessionPath, "meta.json")
    
    const source: SessionSource = {
      id,
      tool: "qwen",
      workspace_path: sessionPath,
      created_at: Date.now(),
      modified_at: Date.now(),
      message_count: 0,
    }
    
    try {
      const metaExists = await Filesystem.exists(metaPath)
      if (metaExists) {
        const meta = await Filesystem.readJson(metaPath)
        if (meta.workspace) source.workspace_path = meta.workspace
        if (meta.title || meta.session_name) source.title = meta.title || meta.session_name
        if (meta.created_at) source.created_at = meta.created_at
        if (meta.message_count) source.message_count = meta.message_count
      }
    } catch {}
    
    return { source }
  }

  /**
   * Parse a MiniMax session
   */
  export async function parseMinimax(
    sessionPath: string,
    id: string
  ): Promise<{ source: SessionSource; context?: Partial<SessionContext> }> {
    log.debug("Parsing MiniMax session", { path: sessionPath, id })
    
    const source: SessionSource = {
      id,
      tool: "minimax",
      workspace_path: sessionPath,
      created_at: Date.now(),
      modified_at: Date.now(),
      message_count: 0,
    }
    
    // Try common session file patterns
    const possibleFiles = ["session.json", "conversation.json", "history.json"]
    
    for (const file of possibleFiles) {
      try {
        const filePath = path.join(sessionPath, file)
        if (await Filesystem.exists(filePath)) {
          const data = await Filesystem.readJson(filePath)
          if (data.title) source.title = data.title
          if (data.message_count) source.message_count = data.message_count
          if (data.workspace) source.workspace_path = data.workspace
          break
        }
      } catch {}
    }
    
    return { source }
  }

  /**
   * Parse a GLM (ChatGLM) session
   */
  export async function parseGLM(
    sessionPath: string,
    id: string
  ): Promise<{ source: SessionSource; context?: Partial<SessionContext> }> {
    log.debug("Parsing GLM session", { path: sessionPath, id })
    
    const source: SessionSource = {
      id,
      tool: "glm",
      workspace_path: sessionPath,
      created_at: Date.now(),
      modified_at: Date.now(),
      message_count: 0,
    }
    
    // Try common GLM session file patterns
    const possibleFiles = ["session.json", "chat.json", "history.jsonl"]
    
    for (const file of possibleFiles) {
      try {
        const filePath = path.join(sessionPath, file)
        if (await Filesystem.exists(filePath)) {
          if (file.endsWith(".jsonl")) {
            const content = await Filesystem.readText(filePath)
            source.message_count = content.split("\n").filter(l => l.trim()).length
          } else {
            const data = await Filesystem.readJson(filePath)
            if (data.title) source.title = data.title
            if (data.message_count) source.message_count = data.message_count
          }
          break
        }
      } catch {}
    }
    
    return { source }
  }

  /**
   * Generic parser for unknown tools
   */
  export async function parseGeneric(
    sessionPath: string,
    id: string,
    tool: ToolType
  ): Promise<{ source: SessionSource }> {
    const stat = Filesystem.stat(sessionPath)
    const mtime = stat?.mtimeMs ? Number(stat.mtimeMs) : Date.now()
    
    return {
      source: {
        id,
        tool,
        workspace_path: sessionPath,
        created_at: mtime,
        modified_at: mtime,
        message_count: 0,
        title: id,
      }
    }
  }
}
