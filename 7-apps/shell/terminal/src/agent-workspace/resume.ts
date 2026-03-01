/**
 * A2R Agent Workspace - Resume Session
 * 
 * Handles resuming sessions from handoff batons.
 * - Loads and parses baton markdown files
 * - Validates baton through CI gates
 * - Formats summary for TUI display
 * - Creates new session continuing from baton
 */

import path from "path"
import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
import { Glob } from "@/util/glob"
import { CIGates } from "@/continuity/gates"
import type { 
  HandoffBaton, 
  SessionContext, 
  ToolType,
  FileChange,
  CommandsByCategory,
  TodoItem,
  DAGTask,
  NextAction,
  ErrorItem,
  A2RConventions,
  LimitsSnapshot,
} from "@/continuity/types"
import type { Session } from "@/session"

const log = Log.create({ service: "agent_workspace.resume" })

/**
 * ResumeContext - Parsed baton content
 * 
 * Contains all the context extracted from a handoff baton,
 * ready for validation and session resumption.
 */
export interface ResumeContext {
  /** Original baton data */
  baton: HandoffBaton
  /** Source file path */
  batonPath: string
  /** Parsed timestamp */
  parsedAt: number
  /** Whether baton was successfully parsed */
  valid: boolean
  /** Parse errors if any */
  parseErrors: string[]
  /** Session context from baton */
  sessionContext: SessionContext
  /** Metadata extracted from baton */
  metadata: {
    /** Original tool that created the session */
    sourceTool: ToolType
    /** Target tool for resumption (if specified) */
    targetTool?: ToolType
    /** Session ID */
    sessionId: string
    /** Workspace path */
    workspacePath: string
    /** When the baton was generated */
    generatedAt: number
    /** Reason for compaction/handoff */
    compactReason: "manual" | "threshold" | "quota" | "error"
  }
}

/**
 * ValidationResult - CI gates validation result
 * 
 * Result of running CI gates on a resume context,
 * including detailed gate results and overall status.
 */
export interface ValidationResult {
  /** Whether all gates passed */
  valid: boolean
  /** Individual gate results */
  gates: CIGates.GateResult[]
  /** Summary report */
  report: CIGates.ValidationReport
  /** Timestamp of validation */
  validatedAt: number
  /** Summary for display */
  summary: {
    /** Total gates run */
    total: number
    /** Gates passed */
    passed: number
    /** Gates failed */
    failed: number
    /** Total errors across all gates */
    errorCount: number
    /** Total warnings across all gates */
    warningCount: number
  }
}

/**
 * ResumeOptions - Options for continuing a session
 * 
 * Configuration options for creating a new session
 * from a resume context.
 */
export interface ResumeOptions {
  /** Target tool for resumption */
  targetTool?: ToolType
  /** Whether to require strict validation */
  strict?: boolean
  /** Maximum context tokens allowed */
  maxContextTokens?: number
  /** New session title override */
  title?: string
  /** Whether to inherit parent session permissions */
  inheritPermissions?: boolean
  /** Additional metadata for the new session */
  metadata?: Record<string, unknown>
}

/**
 * SessionResumeInfo - Information about resumed session
 * 
 * Details about the newly created session from
 * a baton resumption.
 */
export interface SessionResumeInfo {
  /** New session ID */
  sessionId: string
  /** Parent session ID (from baton) */
  parentSessionId: string
  /** Workspace path */
  workspacePath: string
  /** Timestamp of resumption */
  resumedAt: number
  /** Resumption success status */
  success: boolean
  /** Errors if resumption failed */
  errors?: string[]
}

/**
 * ResumeSession Namespace
 * 
 * Handles loading, validating, presenting, and continuing
 * sessions from handoff batons.
 */
export namespace ResumeSession {
  /**
   * Load and parse a baton from file
   * 
   * Reads a baton markdown file and extracts all 13 sections
   * into a structured ResumeContext.
   * 
   * @param batonPath - Path to the baton markdown file
   * @returns Parsed ResumeContext
   */
  export async function load(batonPath: string): Promise<ResumeContext> {
    log.info("Loading baton", { path: batonPath })

    const parseErrors: string[] = []
    let content: string

    // Read baton file
    try {
      content = await Filesystem.readText(batonPath)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      log.error("Failed to read baton file", { path: batonPath, error: errorMsg })
      return createInvalidContext(batonPath, [`Failed to read baton file: ${errorMsg}`])
    }

    // Parse baton content
    const parsedBaton = parseBatonMarkdown(content, parseErrors)
    const workspacePath = extractWorkspacePath(content, batonPath)
    const sessionId = extractSessionId(content) || generateSessionId()

    const context: ResumeContext = {
      baton: parsedBaton,
      batonPath,
      parsedAt: Date.now(),
      valid: parseErrors.length === 0,
      parseErrors,
      sessionContext: parsedBaton.session_context,
      metadata: {
        sourceTool: parsedBaton.session_context.source_tool,
        targetTool: parsedBaton.target_tool,
        sessionId,
        workspacePath,
        generatedAt: parsedBaton.generated_at,
        compactReason: parsedBaton.compact_reason,
      },
    }

    // Ensure workspace path is set correctly
    context.sessionContext.workspace_path = workspacePath
    context.sessionContext.session_id = sessionId

    log.info("Baton loaded", { 
      path: batonPath, 
      valid: context.valid, 
      errors: parseErrors.length,
      sessionId,
    })

    return context
  }

  /**
   * Validate a resume context through CI gates
   * 
   * Runs all CI gates (evidence, no-lazy, resume) on the
   * parsed baton context to ensure quality and resumability.
   * 
   * @param context - ResumeContext to validate
   * @param options - Optional validation options
   * @returns ValidationResult with detailed gate results
   */
  export async function validate(
    context: ResumeContext,
    options?: ResumeOptions
  ): Promise<ValidationResult> {
    log.info("Validating resume context", { sessionId: context.metadata.sessionId })

    const report = await CIGates.validate(context.baton, {
      strict: options?.strict,
      targetTool: options?.targetTool,
      maxContextTokens: options?.maxContextTokens,
    })

    const errorCount = report.gates.reduce((sum, g) => sum + g.errors.length, 0)
    const warningCount = report.gates.reduce((sum, g) => sum + g.warnings.length, 0)

    const result: ValidationResult = {
      valid: report.passed,
      gates: report.gates,
      report,
      validatedAt: Date.now(),
      summary: {
        total: report.gates.length,
        passed: report.gates.filter(g => g.passed).length,
        failed: report.gates.filter(g => !g.passed).length,
        errorCount,
        warningCount,
      },
    }

    log.info("Validation complete", {
      sessionId: context.metadata.sessionId,
      valid: result.valid,
      gates: result.summary.total,
      errors: errorCount,
      warnings: warningCount,
    })

    return result
  }

  /**
   * Format resume context for TUI display
   * 
   * Creates a nicely formatted summary string suitable for
   * display in a terminal UI, showing key session info.
   * 
   * @param context - ResumeContext to format
   * @param validation - Optional validation result to include
   * @returns Formatted display string
   */
  export function present(context: ResumeContext, validation?: ValidationResult): string {
    const ctx = context.sessionContext
    const lines: string[] = []

    // Header
    lines.push("")
    lines.push("┌─────────────────────────────────────────────────────────────┐")
    lines.push("│           📋 A2R SESSION HANDOFF BATON                       │")
    lines.push("└─────────────────────────────────────────────────────────────┘")
    lines.push("")

    // Session info
    lines.push(`🆔 Session: ${context.metadata.sessionId}`)
    lines.push(`🔧 Source: ${context.metadata.sourceTool}`)
    if (context.metadata.targetTool) {
      lines.push(`🎯 Target: ${context.metadata.targetTool}`)
    }
    lines.push(`📁 Workspace: ${context.metadata.workspacePath}`)
    lines.push(`📅 Generated: ${new Date(context.metadata.generatedAt).toLocaleString()}`)
    lines.push(`📦 Reason: ${context.metadata.compactReason}`)
    lines.push("")

    // Objective
    lines.push("┌─ Objective ─────────────────────────────────────────────────┐")
    lines.push("")
    lines.push(`  ${ctx.objective || "(No objective specified)"}`)
    lines.push("")
    lines.push("└─────────────────────────────────────────────────────────────┘")
    lines.push("")

    // Progress summary
    if (ctx.progress_summary.length > 0) {
      lines.push("┌─ Progress ──────────────────────────────────────────────────┐")
      lines.push("")
      for (const item of ctx.progress_summary.slice(0, 5)) {
        lines.push(`  ✓ ${item}`)
      }
      lines.push("")
      lines.push("└─────────────────────────────────────────────────────────────┘")
      lines.push("")
    }

    // Files changed
    if (ctx.files_changed.length > 0) {
      lines.push(`┌─ Files Changed (${ctx.files_changed.length}) ─────────────────────────────────┐`)
      lines.push("")
      for (const file of ctx.files_changed.slice(0, 5)) {
        const action = file.action === "created" ? "+" : file.action === "deleted" ? "-" : "~"
        lines.push(`  ${action} ${file.path}`)
      }
      if (ctx.files_changed.length > 5) {
        lines.push(`  ... and ${ctx.files_changed.length - 5} more`)
      }
      lines.push("")
      lines.push("└─────────────────────────────────────────────────────────────┘")
      lines.push("")
    }

    // Open TODOs
    const blockingTodos = ctx.open_todos.filter(t => t.blocking)
    const nonBlockingTodos = ctx.open_todos.filter(t => !t.blocking)
    
    if (blockingTodos.length > 0 || nonBlockingTodos.length > 0) {
      lines.push(`┌─ Open TODOs (${ctx.open_todos.length}) ────────────────────────────────────┐`)
      lines.push("")
      for (const todo of blockingTodos.slice(0, 3)) {
        lines.push(`  🔴 [${todo.priority.toUpperCase()}] ${todo.task}`)
      }
      for (const todo of nonBlockingTodos.slice(0, 3)) {
        lines.push(`  ○ [${todo.priority.toUpperCase()}] ${todo.task}`)
      }
      if (ctx.open_todos.length > 6) {
        lines.push(`  ... and ${ctx.open_todos.length - 6} more`)
      }
      lines.push("")
      lines.push("└─────────────────────────────────────────────────────────────┘")
      lines.push("")
    }

    // DAG Tasks
    const inProgressTasks = ctx.dag_tasks?.filter(t => t.status === "in_progress") || []
    const pendingTasks = ctx.dag_tasks?.filter(t => t.status === "pending") || []
    const blockedTasks = ctx.dag_tasks?.filter(t => t.status === "blocked" || t.status === "failed") || []
    const completedTasks = ctx.dag_tasks?.filter(t => t.status === "completed") || []

    if (ctx.dag_tasks.length > 0) {
      lines.push(`┌─ Workflow Tasks (${ctx.dag_tasks.length}) ───────────────────────────────────┐`)
      lines.push("")
      lines.push(`  ✅ ${completedTasks.length} completed  🟡 ${inProgressTasks.length} in progress`)
      lines.push(`  ⏳ ${pendingTasks.length} pending     🔴 ${blockedTasks.length} blocked`)
      
      if (inProgressTasks.length > 0) {
        lines.push("")
        lines.push("  Currently working on:")
        for (const task of inProgressTasks.slice(0, 2)) {
          lines.push(`    • ${task.name}: ${task.description.slice(0, 50)}...`)
        }
      }
      
      lines.push("")
      lines.push("└─────────────────────────────────────────────────────────────┘")
      lines.push("")
    }

    // Next actions
    if (ctx.next_actions?.length > 0) {
      lines.push(`┌─ Next Actions (${ctx.next_actions.length}) ────────────────────────────────────┐`)
      lines.push("")
      for (let i = 0; i < Math.min(5, ctx.next_actions.length); i++) {
        const action = ctx.next_actions[i]
        const icon = getActionIcon(action.action)
        lines.push(`  ${i + 1}. ${icon} ${action.description}`)
        if (action.target) {
          lines.push(`     → ${action.target}`)
        }
      }
      lines.push("")
      lines.push("└─────────────────────────────────────────────────────────────┘")
      lines.push("")
    }

    // Errors and blockers
    if (ctx.errors_seen?.length > 0 || ctx.blockers?.length > 0) {
      lines.push("┌─ ⚠️  Issues ─────────────────────────────────────────────────┐")
      lines.push("")
      for (const error of ctx.errors_seen.slice(0, 3)) {
        const icon = error.recoverable ? "⚠️ " : "❌"
        lines.push(`  ${icon} ${error.tool}: ${error.message.slice(0, 60)}`)
      }
      for (const blocker of ctx.blockers.slice(0, 3)) {
        lines.push(`  🚫 ${blocker.slice(0, 60)}`)
      }
      lines.push("")
      lines.push("└─────────────────────────────────────────────────────────────┘")
      lines.push("")
    }

    // Validation status
    if (validation) {
      lines.push("┌─ Validation ────────────────────────────────────────────────┐")
      lines.push("")
      
      const statusIcon = validation.valid ? "✅" : "❌"
      const statusText = validation.valid ? "PASSED" : "FAILED"
      lines.push(`  Status: ${statusIcon} ${statusText}`)
      lines.push(`  Gates: ${validation.summary.passed}/${validation.summary.total} passed`)
      
      if (validation.summary.errorCount > 0) {
        lines.push(`  Errors: ${validation.summary.errorCount}`)
      }
      if (validation.summary.warningCount > 0) {
        lines.push(`  Warnings: ${validation.summary.warningCount}`)
      }
      
      // Show failed gates
      const failedGates = validation.gates.filter(g => !g.passed)
      if (failedGates.length > 0) {
        lines.push("")
        lines.push("  Failed gates:")
        for (const gate of failedGates) {
          lines.push(`    • ${gate.gate.toUpperCase()}`)
          for (const error of gate.errors.slice(0, 2)) {
            lines.push(`      - ${error}`)
          }
        }
      }
      
      lines.push("")
      lines.push("└─────────────────────────────────────────────────────────────┘")
      lines.push("")
    }

    // Footer
    lines.push("┌─────────────────────────────────────────────────────────────┐")
    lines.push("│  Use 'a2r resume' or 'continue()' to resume this session    │")
    lines.push("└─────────────────────────────────────────────────────────────┘")
    lines.push("")

    return lines.join("\n")
  }

  /**
   * Continue a session from baton context
   * 
   * Creates a new session that continues from the baton context,
   * optionally validating first and inheriting settings.
   * 
   * @param context - ResumeContext to continue from
   * @param options - Options for session creation
   * @returns SessionResumeInfo about the new session
   */
  export async function continueSession(
    context: ResumeContext,
    options?: ResumeOptions
  ): Promise<Session.Info> {
    log.info("Continuing session from baton", { 
      sessionId: context.metadata.sessionId,
      batonPath: context.batonPath,
    })

    // Validate first if strict or if no explicit skip
    if (options?.strict !== false) {
      const validation = await validate(context, options)
      if (!validation.valid) {
        const errors = validation.gates.flatMap(g => g.errors)
        log.error("Validation failed, cannot continue session", { errors })
        throw new ResumeError(`Validation failed: ${errors.join("; ")}`)
      }
    }

    // Import Session module dynamically to avoid circular dependencies
    const { Session } = await import("@/session")

    // Create new session with baton context
    const title = options?.title || `Resumed from ${context.metadata.sessionId}`
    
    // Create the new session
    const newSession = await Session.createNext({
      directory: context.metadata.workspacePath,
      title,
      permission: options?.inheritPermissions ? undefined : undefined, // Would get from parent if available
    })

    log.info("Session continued", {
      oldSessionId: context.metadata.sessionId,
      newSessionId: newSession.id,
      workspace: context.metadata.workspacePath,
    })

    return newSession
  }

  /**
   * Check if a baton file exists and is readable
   * 
   * Quick check to see if a baton can be resumed before
   * attempting to load and parse it.
   * 
   * @param batonPath - Path to check
   * @returns Whether baton is available
   */
  export async function isAvailable(batonPath: string): Promise<boolean> {
    try {
      const exists = await Filesystem.exists(batonPath)
      if (!exists) return false
      
      const stat = Filesystem.stat(batonPath)
      if (!stat) return false
      
      // Check if it's a file and readable
      return stat.isFile()
    } catch {
      return false
    }
  }

  /**
   * Find baton files in a workspace
   * 
   * Searches for handoff baton files in the given workspace.
   * 
   * @param workspace - Workspace directory to search
   * @returns Array of baton file paths
   */
  export async function findBatons(workspace: string): Promise<string[]> {
    const batonsDir = path.join(workspace, ".a2r", "L1-COGNITIVE", "brain", "batons")
    const batons: string[] = []

    try {
      const entries = await Glob.scan("*.{md,json}", { cwd: batonsDir, absolute: true })
      batons.push(...entries)
    } catch {
      // Directory doesn't exist or not readable
    }

    // Also check for handoff.md
    const handoffPath = path.join(workspace, ".a2r", "L1-COGNITIVE", "memory", "handoff.md")
    if (await Filesystem.exists(handoffPath)) {
      try {
        const content = await Filesystem.readText(handoffPath)
        const match = content.match(/## Current Baton\s*\n+[`"]*(\S+\.(?:md|json))[`"]*/)
        if (match) {
          const referencedBaton = path.join(workspace, ".a2r", match[1].replace(/^\.a2r\//, ""))
          if (await Filesystem.exists(referencedBaton)) {
            batons.push(referencedBaton)
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Remove duplicates and sort by modification time (newest first)
    const uniqueBatons = [...new Set(batons)]
    return uniqueBatons.sort((a, b) => {
      // Sort by modification time (newest first)
      const statA = Filesystem.stat(a)
      const statB = Filesystem.stat(b)
      const timeA = typeof statA?.mtimeMs === "bigint" ? Number(statA.mtimeMs) : (statA?.mtimeMs || 0)
      const timeB = typeof statB?.mtimeMs === "bigint" ? Number(statB.mtimeMs) : (statB?.mtimeMs || 0)
      return timeB - timeA
    })
  }

  /**
   * Get the most recent baton for a workspace
   * 
   * Finds and returns the path to the most recent handoff
   * baton in the given workspace.
   * 
   * @param workspace - Workspace directory
   * @returns Path to latest baton or null if none found
   */
  export async function getLatestBaton(workspace: string): Promise<string | null> {
    const batons = await findBatons(workspace)
    return batons.length > 0 ? batons[0] : null
  }
}

/**
 * ResumeError - Error thrown during session resumption
 */
export class ResumeError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = "ResumeError"
  }
}

// Helper functions

function createInvalidContext(batonPath: string, errors: string[]): ResumeContext {
  const now = Date.now()
  const emptyContext: SessionContext = {
    session_id: "invalid",
    source_tool: "unknown",
    workspace_path: path.dirname(batonPath),
    time_start: now,
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

  return {
    baton: {
      version: "1.0.0",
      session_context: emptyContext,
      generated_at: now,
      compact_reason: "manual",
    },
    batonPath,
    parsedAt: now,
    valid: false,
    parseErrors: errors,
    sessionContext: emptyContext,
    metadata: {
      sourceTool: "unknown",
      sessionId: "invalid",
      workspacePath: path.dirname(batonPath),
      generatedAt: now,
      compactReason: "manual",
    },
  }
}

function parseBatonMarkdown(content: string, parseErrors: string[]): HandoffBaton {
  const sections = extractSections(content)
  
  // Extract header info
  const headerMatch = content.match(/# A2R Session Baton\s*\n/i)
  if (!headerMatch) {
    parseErrors.push("Missing A2R Session Baton header")
  }

  // Extract session metadata
  const sessionId = extractField(content, "Session:") || extractField(content, "session_id")
  const sourceTool = extractField(content, "Tool:") as ToolType || "unknown"
  const workspacePath = extractField(content, "Workspace:")
  const compactReason = (extractField(content, "Reason:") || "manual") as HandoffBaton["compact_reason"]
  const targetTool = extractField(content, "Target:") as ToolType | undefined

  // Build SessionContext from sections
  const sessionContext: SessionContext = {
    session_id: sessionId || generateSessionId(),
    source_tool: sourceTool,
    workspace_path: workspacePath || "",
    time_start: extractTimestamp(content, "Generated:") || Date.now(),
    objective: sections["Objective"] || sections["objective"] || "Continue session",
    progress_summary: parseList(sections["Current Plan"] || sections["progress_summary"]),
    decisions: parseList(sections["Decisions Made"] || sections["decisions"]),
    open_todos: parseTODOs(sections["Open TODOs"] || sections["open_todos"]),
    dag_tasks: parseDAGTasks(sections["DAG Tasks (Workflow)"] || sections["DAG Tasks"] || sections["dag_tasks"]),
    blockers: parseList(sections["Errors / Blockers"] || sections["blockers"]),
    files_changed: parseFilesChanged(sections["Files Changed"] || sections["files_changed"]),
    commands_executed: parseCommands(sections["Commands Executed"] || sections["commands_executed"]),
    errors_seen: parseErrorsSection(sections["Errors / Blockers"] || sections["errors_seen"]),
    next_actions: parseNextActions(sections["Next 5 Actions"] || sections["Next"] || sections["next_actions"]),
    limits: parseLimits(sections["Limits Snapshot"] || sections["limits"]),
  }

  return {
    version: "1.0.0",
    session_context: sessionContext,
    generated_at: extractTimestamp(content, "Generated:") || Date.now(),
    target_tool: targetTool,
    compact_reason: compactReason,
  }
}

function extractSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const sectionRegex = /##\s+([^\n]+)\n+([\s\S]*?)(?=\n##\s+|\n---\s*\n|$)/g
  
  let match
  while ((match = sectionRegex.exec(content)) !== null) {
    const title = match[1].trim()
    const body = match[2].trim()
    sections[title] = body
  }
  
  return sections
}

function extractField(content: string, fieldName: string): string | undefined {
  const regex = new RegExp(`\\*\\*${fieldName}\\*\\*\\s*([^\\n]+)`, "i")
  const match = content.match(regex)
  return match ? match[1].trim() : undefined
}

function extractSessionId(content: string): string | undefined {
  const match = content.match(/\*\*Session:\*\*\s*(\S+)/)
  return match ? match[1] : undefined
}

function extractWorkspacePath(content: string, fallbackPath: string): string {
  const match = content.match(/\*\*Workspace:\*\*\s*(.+?)\s*\n/)
  if (match) {
    return match[1].trim()
  }
  // Try to infer from baton path
  const parts = fallbackPath.split(path.sep)
  const a2rIndex = parts.indexOf(".a2r")
  if (a2rIndex > 0) {
    return parts.slice(0, a2rIndex).join(path.sep)
  }
  return path.dirname(fallbackPath)
}

function extractTimestamp(content: string, fieldName: string): number | undefined {
  const regex = new RegExp(`\\*\\*${fieldName}\\*\\*\\s*(\\d{4}-\\d{2}-\\d{2}T[^\\n]+)`)
  const match = content.match(regex)
  if (match) {
    const date = new Date(match[1].trim())
    return isNaN(date.getTime()) ? undefined : date.getTime()
  }
  return undefined
}

function parseList(content: string | undefined): string[] {
  if (!content) return []
  return content
    .split("\n")
    .map(line => line.replace(/^[-*]\s*/, "").trim())
    .filter(line => line && !line.startsWith("#"))
    .filter(line => line !== "- No files modified" && line !== "- No commands recorded" && line !== "- No outstanding TODOs" && line !== "- No errors or blockers")
}

function parseTODOs(content: string | undefined): TodoItem[] {
  if (!content) return []
  const todos: TodoItem[] = []
  const lines = content.split("\n")
  
  for (const line of lines) {
    const match = line.match(/-\s*\[([^\]]+)\]\s*(.+)/)
    if (match) {
      const tags = match[1].split(",").map(t => t.trim().toLowerCase())
      const task = match[2].trim()
      const blocking = tags.includes("blocking")
      const priority: TodoItem["priority"] = tags.includes("high") ? "high" : tags.includes("low") ? "low" : "medium"
      
      todos.push({ task, priority, blocking })
    }
  }
  
  return todos
}

function parseDAGTasks(content: string | undefined): DAGTask[] {
  if (!content) return []
  const tasks: DAGTask[] = []
  const lines = content.split("\n")
  
  let currentSection = ""
  for (const line of lines) {
    // Track sections
    if (line.startsWith("###")) {
      currentSection = line.replace(/^###\s*/, "").toLowerCase()
      continue
    }
    
    // Parse task lines
    const match = line.match(/-\s*\*?\[?([^\]]+)\]?\*?\s*(.+)/)
    if (match) {
      const statusText = match[1].trim().toLowerCase()
      const nameAndDesc = match[2].trim()
      
      let status: DAGTask["status"] = "pending"
      if (statusText.includes("completed") || statusText.includes("done")) status = "completed"
      else if (statusText.includes("progress")) status = "in_progress"
      else if (statusText.includes("blocked") || statusText.includes("failed")) status = "blocked"
      
      const name = nameAndDesc.split(":")[0].trim()
      const description = nameAndDesc.includes(":") ? nameAndDesc.split(":")[1].trim() : name
      
      tasks.push({
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        description,
        status,
        dependencies: [],
        priority: currentSection.includes("critical") ? "critical" : "medium",
        blocking: currentSection.includes("critical"),
      })
    }
  }
  
  return tasks
}

function parseFilesChanged(content: string | undefined): FileChange[] {
  if (!content) return []
  const files: FileChange[] = []
  const lines = content.split("\n")
  
  for (const line of lines) {
    const match = line.match(/-\s*\*\*([^*]+)\*\*\s*\(([^)]+)\):?\s*(.+)/)
    if (match) {
      const path = match[1].trim()
      const actionText = match[2].trim().toLowerCase()
      const summary = match[3].trim()
      
      let action: FileChange["action"] = "modified"
      if (actionText.includes("created")) action = "created"
      else if (actionText.includes("deleted")) action = "deleted"
      else if (actionText.includes("renamed")) action = "renamed"
      
      files.push({ path, action, summary })
    }
  }
  
  return files
}

function parseCommands(content: string | undefined): CommandsByCategory {
  const commands: CommandsByCategory = {
    build: [],
    test: [],
    lint: [],
    git: [],
    other: [],
  }
  
  if (!content) return commands
  const lines = content.split("\n")
  
  let currentCategory: keyof CommandsByCategory = "other"
  
  for (const line of lines) {
    // Check for category headers
    if (line.includes("Build:")) currentCategory = "build"
    else if (line.includes("Test:")) currentCategory = "test"
    else if (line.includes("Lint:")) currentCategory = "lint"
    else if (line.includes("Git:")) currentCategory = "git"
    else if (line.includes("Other:")) currentCategory = "other"
    
    // Parse command lines
    const match = line.match(/-\s*`([^`]+)`/)
    if (match) {
      commands[currentCategory].push(match[1].trim())
    }
  }
  
  return commands
}

function parseErrorsSection(content: string | undefined): ErrorItem[] {
  if (!content) return []
  const errors: ErrorItem[] = []
  const lines = content.split("\n")
  
  for (const line of lines) {
    const match = line.match(/-\s*\[([^\]]+)\]\s*(.+)/)
    if (match) {
      const recoverableText = match[1].trim().toLowerCase()
      const rest = match[2].trim()
      
      const toolMatch = rest.match(/^([^:]+):\s*(.+)/)
      const tool = toolMatch ? toolMatch[1].trim() : "unknown"
      const message = toolMatch ? toolMatch[2].trim() : rest
      
      errors.push({
        message,
        tool,
        recoverable: recoverableText.includes("recoverable"),
      })
    }
  }
  
  return errors
}

function parseNextActions(content: string | undefined): NextAction[] {
  if (!content) return []
  const actions: NextAction[] = []
  const lines = content.split("\n")
  
  for (const line of lines) {
    // Match numbered list items with action type
    // Handles formats like: "1. **EDIT:** description" or "1. **EDIT** description"
    const match = line.match(/^\s*\d+\.\s*\*\*([^*]+)\*\*:?\s*(.+)/)
    if (match) {
      const actionText = match[1].trim().toLowerCase()
      let action: NextAction["action"] = "edit"
      
      if (actionText.includes("test")) action = "test"
      else if (actionText.includes("read")) action = "read"
      else if (actionText.includes("commit")) action = "commit"
      else if (actionText.includes("review")) action = "review"
      else if (actionText.includes("edit")) action = "edit"
      
      let description = match[2].trim()
      let target: string | undefined
      
      // Extract target if present in backticks
      const targetMatch = description.match(/`([^`]+)`/)
      if (targetMatch) {
        target = targetMatch[1]
      }
      
      // Extract token estimate if present
      const tokenMatch = description.match(/~(\d+)t/)
      const estimatedTokens = tokenMatch ? parseInt(tokenMatch[1], 10) : undefined
      
      // Clean up description
      description = description.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*~\d+t\s*$/, "")
      
      actions.push({ action, description, target, estimated_tokens: estimatedTokens })
    }
  }
  
  return actions
}

function parseLimits(content: string | undefined): LimitsSnapshot | undefined {
  if (!content) return undefined
  
  const contextRatio = extractLimitValue(content, "Context Ratio")
  const quotaRatio = extractLimitValue(content, "Quota Ratio")
  const tokensTotal = extractLimitValue(content, "Tokens")
  const contextWindow = extractLimitValue(content, "Context Window")
  const throttleCount = extractLimitValue(content, "Throttles")
  
  if (contextRatio === undefined && tokensTotal === undefined) {
    return undefined
  }
  
  return {
    context_ratio: (contextRatio || 0) / 100,
    quota_ratio: (quotaRatio || 0) / 100,
    tokens_input: Math.floor((tokensTotal || 0) * 0.75),
    tokens_output: Math.floor((tokensTotal || 0) * 0.25),
    tokens_total: tokensTotal || 0,
    context_window: contextWindow || 200000,
    throttle_count: throttleCount || 0,
  }
}

function extractLimitValue(content: string, fieldName: string): number | undefined {
  const regex = new RegExp(`-\\s*\\*\\*${fieldName}:\\*\\*\\s*([\\d,]+(?:\\.\\d+)?)%?`)
  const match = content.match(regex)
  if (match) {
    const value = parseFloat(match[1].replace(/,/g, ""))
    return isNaN(value) ? undefined : value
  }
  return undefined
}

function getActionIcon(action: NextAction["action"]): string {
  switch (action) {
    case "edit": return "✏️ "
    case "test": return "🧪"
    case "read": return "📖"
    case "commit": return "💾"
    case "review": return "👁️"
    default: return "•"
  }
}

function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `sess-${timestamp}-${random}`
}

// Re-export types for convenience
export type { SessionContext, HandoffBaton, ToolType }
