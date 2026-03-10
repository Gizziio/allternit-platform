/**
 * GIZZI Continuity - Session Discovery and Unified Index
 * 
 * Manages session discovery across tools with TTL-based caching
 */

import { Global } from "@/runtime/context/global"
import { Log } from "@/shared/util/log"
import { Filesystem } from "@/shared/util/filesystem"
import { readdir } from "fs/promises"
import path from "path"
import type { 
  SessionSource, 
  UnifiedSession, 
  UnifiedIndex,
  IndexEntry,
  ToolType 
} from "./types"
import { ToolParsers } from "@/runtime/session/continuity/parsers"

const log = Log.create({ service: "continuity.index" })

// Default TTL: 5 minutes
const DEFAULT_TTL_MS = 5 * 60 * 1000

// Index file location
const INDEX_FILE = path.join(Global.Path.cache, "continuity-index.json")

// Known tool storage paths
const TOOL_PATHS: Record<ToolType, string[]> = {
  gizzi: [
    "~/.local/share/gizzi",
    "~/.config/gizzi",
  ],
  claude_code: [
    "~/.claude/projects",
    "~/.claude-code/sessions",
  ],
  codex: [
    "~/.codex/sessions",
  ],
  copilot: [
    "~/.copilot/session-state",
  ],
  cursor: [
    "~/.cursor/sessions",
  ],
  gemini_cli: [
    "~/.gemini/tmp",
  ],
  droid: [
    "~/.factory/sessions",
  ],
  gizzi_shell: [
    "~/.gizzi/cache/sessions",
  ],
  qwen: [
    "~/.qwen/sessions",
    "~/.local/share/qwen",
  ],
  kimi: [
    "~/.kimi/sessions",
    "~/.local/share/kimi",
  ],
  minimax: [
    "~/.minimax/sessions",
    "~/.local/share/minimax",
  ],
  glm: [
    "~/.glm/sessions",
    "~/.local/share/glm",
  ],
  unknown: [],
}

/**
 * Session Discovery - Find sessions across all tools
 */
export namespace SessionDiscovery {
  /**
   * Scan all known tool paths for sessions
   */
  export async function scanAll(options?: {
    ttl_ms?: number
    force?: boolean
  }): Promise<SessionSource[]> {
    const index = await loadIndex()
    
    // Check if we need to refresh
    const now = Date.now()
    const needsRefresh = options?.force || 
      !index.last_scan_at || 
      (now - index.last_scan_at) > (options?.ttl_ms ?? DEFAULT_TTL_MS)
    
    if (!needsRefresh) {
      log.info("Using cached index", { 
        entries: index.entries.length,
        last_scan: new Date(index.last_scan_at).toISOString()
      })
      return index.entries.map(entryToSource)
    }
    
    log.info("Scanning for sessions...")
    const sources: SessionSource[] = []
    
    // Scan each tool type
    for (const [tool, paths] of Object.entries(TOOL_PATHS)) {
      if (tool === "unknown") continue
      
      for (const p of paths) {
        const expanded = expandHome(p)
        try {
          if (await Filesystem.exists(expanded)) {
            const toolSources = await scanToolPath(tool as ToolType, expanded)
            sources.push(...toolSources)
          }
        } catch (e) {
          log.debug("Failed to scan path", { path: expanded, error: e })
        }
      }
    }
    
    // Update index
    await updateIndex(sources, options?.ttl_ms ?? DEFAULT_TTL_MS)
    
    log.info("Scan complete", { sessions_found: sources.length })
    return sources
  }
  
  /**
   * Scan a specific tool's path
   */
  async function scanToolPath(tool: ToolType, basePath: string): Promise<SessionSource[]> {
    const sources: SessionSource[] = []
    
    try {
      const entries = await readdir(basePath)
      
      for (const entry of entries) {
        const fullPath = path.join(basePath, entry)
        try {
          const source = await parseSessionPath(tool, fullPath)
          if (source) sources.push(source)
        } catch (e) {
          log.debug("Failed to parse session", { path: fullPath, error: e })
        }
      }
    } catch (e) {
      log.debug("Failed to read tool path", { path: basePath, error: e })
    }
    
    return sources
  }
  
  /**
   * Parse a session from a path (tool-specific)
   */
  async function parseSessionPath(tool: ToolType, sessionPath: string): Promise<SessionSource | null> {
    const stat = await Filesystem.stat(sessionPath)
    if (!stat) return null
    
    const id = path.basename(sessionPath)
    const mtimeMs = stat.mtimeMs ? Number(stat.mtimeMs) : Date.now()
    
    // Tool-specific parsing using parsers module
    switch (tool) {
      case "gizzi":
        return (await ToolParsers.parseGIZZI(sessionPath, id)).source
      case "claude_code":
        return (await ToolParsers.parseClaudeCode(sessionPath, id)).source
      case "codex":
        return (await ToolParsers.parseCodex(sessionPath, id)).source
      case "qwen":
        return (await ToolParsers.parseQwen(sessionPath, id)).source
      case "kimi":
        return (await ToolParsers.parseKimi(sessionPath, id)).source
      case "minimax":
        return (await ToolParsers.parseMinimax(sessionPath, id)).source
      case "glm":
        return (await ToolParsers.parseGLM(sessionPath, id)).source
      default:
        return (await ToolParsers.parseGeneric(sessionPath, id, tool)).source
    }
  }

/**
 * Index Management
 */
export namespace IndexManager {
  /**
   * Get all indexed sessions
   */
  export async function getSessions(): Promise<SessionSource[]> {
    const index = await loadIndex()
    return index.entries.map(entryToSource)
  }
  
  /**
   * Get sessions for a specific workspace
   */
  export async function getSessionsForWorkspace(workspace: string): Promise<SessionSource[]> {
    const all = await getSessions()
    return all.filter(s => s.workspace_path === workspace || s.workspace_path.startsWith(workspace))
  }
  
  /**
   * Get session by ID
   */
  export async function getSession(id: string): Promise<SessionSource | null> {
    const index = await loadIndex()
    const entry = index.entries.find(e => e.session_id === id)
    return entry ? entryToSource(entry) : null
  }
  
  /**
   * Invalidate cache for a session
   */
  export async function invalidate(sessionId: string): Promise<void> {
    const index = await loadIndex()
    index.entries = index.entries.filter(e => e.session_id !== sessionId)
    await saveIndex(index)
  }
  
  /**
   * Clear entire index
   */
  export async function clear(): Promise<void> {
    await saveIndex({
      entries: [],
      last_scan_at: 0,
      scan_ttl_ms: DEFAULT_TTL_MS,
    })
  }
}

// Helper functions

async function loadIndex(): Promise<UnifiedIndex> {
  try {
    const content = await Filesystem.readText(INDEX_FILE)
    return JSON.parse(content)
  } catch {
    return {
      entries: [],
      last_scan_at: 0,
      scan_ttl_ms: DEFAULT_TTL_MS,
    }
  }
}

async function saveIndex(index: UnifiedIndex): Promise<void> {
  await Filesystem.write(INDEX_FILE, JSON.stringify(index, null, 2))
}

async function updateIndex(sources: SessionSource[], ttl_ms: number): Promise<void> {
  const now = Date.now()
  const entries: IndexEntry[] = sources.map(s => ({
    session_id: s.id,
    tool: s.tool,
    workspace_path: s.workspace_path,
    modified_at: s.modified_at,
    ttl_expires_at: now + ttl_ms,
  }))
  
  await saveIndex({
    entries,
    last_scan_at: now,
    scan_ttl_ms: ttl_ms,
  })
}

function entryToSource(entry: IndexEntry): SessionSource {
  return {
    id: entry.session_id,
    tool: entry.tool,
    workspace_path: entry.workspace_path,
    created_at: entry.modified_at,
    modified_at: entry.modified_at,
    message_count: 0,
  }
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(process.env.HOME ?? "/", p.slice(2))
  }
  return p
}

// End of file
}
