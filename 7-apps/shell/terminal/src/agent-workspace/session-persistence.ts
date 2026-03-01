/**
 * Agent Workspace - Session Persistence
 * 
 * Saves and restores complete session state including:
 * - Message history
 * - Current DAG node
 * - Open files
 * - Pending operations
 * - UI state
 */

import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
import path from "path"
import { AgentWorkspace } from "./artifacts"

const log = Log.create({ service: "agent_workspace.session_persistence" })

export namespace SessionPersistence {
  export interface SessionState {
    version: string
    sessionId: string
    workspace: string
    timestamp: number
    
    // Core session data
    messages: Message[]
    currentDagNodeId: string | null
    dagState: object
    
    // Files and context
    openFiles: string[]
    currentFile: string | null
    recentFiles: string[]
    
    // Operations
    pendingOperations: PendingOperation[]
    completedOperations: string[]
    
    // UI state
    uiState: {
      sidebarExpanded: boolean
      activePanel: string | null
      scrollPositions: Record<string, number>
      selectedLayer: number | null
    }
    
    // Continuity
    continuesFrom?: string
    handoffBatonPath?: string
  }

  export interface Message {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    timestamp: number
    metadata?: Record<string, unknown>
  }

  export interface PendingOperation {
    id: string
    type: "edit" | "create" | "delete" | "command"
    target: string
    description: string
    startedAt: number
  }

  export interface SaveOptions {
    includeHistory?: boolean
    includeUIState?: boolean
    compress?: boolean
  }

  export interface RestoreOptions {
    restoreUIState?: boolean
    clearPendingOperations?: boolean
  }

  const SESSION_STATE_FILE = "session-state.json"
  const SESSION_HISTORY_FILE = "session-history.jsonl"
  const MAX_HISTORY_ENTRIES = 1000

  /**
   * Save complete session state
   */
  export async function save(
    workspace: string,
    state: Partial<SessionState>,
    options: SaveOptions = {}
  ): Promise<void> {
    const paths = AgentWorkspace.getPaths(workspace)
    const statePath = path.join(paths.state_dir, SESSION_STATE_FILE)
    
    const fullState: SessionState = {
      version: "1.0.0",
      sessionId: state.sessionId ?? "unknown",
      workspace,
      timestamp: Date.now(),
      messages: state.messages ?? [],
      currentDagNodeId: state.currentDagNodeId ?? null,
      dagState: state.dagState ?? {},
      openFiles: state.openFiles ?? [],
      currentFile: state.currentFile ?? null,
      recentFiles: state.recentFiles ?? [],
      pendingOperations: state.pendingOperations ?? [],
      completedOperations: state.completedOperations ?? [],
      uiState: state.uiState ?? {
        sidebarExpanded: true,
        activePanel: null,
        scrollPositions: {},
        selectedLayer: null,
      },
      continuesFrom: state.continuesFrom,
      handoffBatonPath: state.handoffBatonPath,
    }

    try {
      // Ensure state directory exists
      await Filesystem.mkdir(paths.state_dir, { recursive: true })
      
      // Write state
      await Filesystem.write(
        statePath,
        JSON.stringify(fullState, null, 2)
      )
      
      // Append to history if enabled
      if (options.includeHistory !== false) {
        await appendToHistory(workspace, fullState)
      }
      
      log.debug("Session state saved", {
        workspace,
        sessionId: fullState.sessionId,
        messages: fullState.messages.length,
      })
    } catch (error) {
      log.error("Failed to save session state", { error })
      throw error
    }
  }

  /**
   * Load session state
   */
  export async function load(
    workspace: string,
    options: RestoreOptions = {}
  ): Promise<SessionState | null> {
    const paths = AgentWorkspace.getPaths(workspace)
    const statePath = path.join(paths.state_dir, SESSION_STATE_FILE)
    
    try {
      const content = await Filesystem.readText(statePath)
      const state: SessionState = JSON.parse(content)
      
      // Apply restore options
      if (options.clearPendingOperations) {
        state.pendingOperations = []
      }
      
      if (!options.restoreUIState) {
        state.uiState = {
          sidebarExpanded: true,
          activePanel: null,
          scrollPositions: {},
          selectedLayer: null,
        }
      }
      
      log.debug("Session state loaded", {
        workspace,
        sessionId: state.sessionId,
        messages: state.messages.length,
      })
      
      return state
    } catch (error) {
      // State file doesn't exist or is corrupted
      log.debug("No session state found", { workspace })
      return null
    }
  }

  /**
   * Append state to history
   */
  async function appendToHistory(
    workspace: string,
    state: SessionState
  ): Promise<void> {
    const paths = AgentWorkspace.getPaths(workspace)
    const historyPath = path.join(paths.state_dir, SESSION_HISTORY_FILE)
    
    // Create summary entry
    const entry = {
      timestamp: state.timestamp,
      sessionId: state.sessionId,
      messageCount: state.messages.length,
      currentNode: state.currentDagNodeId,
      openFiles: state.openFiles.length,
      pendingOps: state.pendingOperations.length,
    }
    
    try {
      await Filesystem.append(historyPath, JSON.stringify(entry) + "\n")
      
      // Trim history if too large
      await trimHistory(workspace)
    } catch (error) {
      log.error("Failed to append to history", { error })
    }
  }

  /**
   * Trim history to max entries
   */
  async function trimHistory(workspace: string): Promise<void> {
    const paths = AgentWorkspace.getPaths(workspace)
    const historyPath = path.join(paths.state_dir, SESSION_HISTORY_FILE)
    
    try {
      const content = await Filesystem.readText(historyPath)
      const lines = content.split("\n").filter(Boolean)
      
      if (lines.length > MAX_HISTORY_ENTRIES) {
        // Keep only the most recent entries
        const recent = lines.slice(-MAX_HISTORY_ENTRIES)
        await Filesystem.write(historyPath, recent.join("\n") + "\n")
        
        log.debug("History trimmed", {
          workspace,
          removed: lines.length - MAX_HISTORY_ENTRIES,
        })
      }
    } catch {
      // History file doesn't exist yet
    }
  }

  /**
   * Get session history
   */
  export async function getHistory(
    workspace: string,
    options?: { limit?: number }
  ): Promise<object[]> {
    const paths = AgentWorkspace.getPaths(workspace)
    const historyPath = path.join(paths.state_dir, SESSION_HISTORY_FILE)
    
    try {
      const content = await Filesystem.readText(historyPath)
      const lines = content.split("\n").filter(Boolean)
      
      const entries = lines.map(line => JSON.parse(line))
      
      if (options?.limit) {
        return entries.slice(-options.limit)
      }
      
      return entries
    } catch {
      return []
    }
  }

  /**
   * Clear session state
   */
  export async function clear(workspace: string): Promise<void> {
    const paths = AgentWorkspace.getPaths(workspace)
    const statePath = path.join(paths.state_dir, SESSION_STATE_FILE)
    
    try {
      // Write empty state
      await Filesystem.write(
        statePath,
        JSON.stringify({
          version: "1.0.0",
          sessionId: "cleared",
          workspace,
          timestamp: Date.now(),
          messages: [],
          currentDagNodeId: null,
          dagState: {},
          openFiles: [],
          currentFile: null,
          recentFiles: [],
          pendingOperations: [],
          completedOperations: [],
          uiState: {
            sidebarExpanded: true,
            activePanel: null,
            scrollPositions: {},
            selectedLayer: null,
          },
        }, null, 2)
      )
      
      log.info("Session state cleared", { workspace })
    } catch (error) {
      log.error("Failed to clear session state", { error })
      throw error
    }
  }

  /**
   * Auto-save session state periodically
   */
  const autoSaveIntervals = new Map<string, ReturnType<typeof setInterval>>()

  export function startAutoSave(
    workspace: string,
    getState: () => Partial<SessionState>,
    intervalMs: number = 30000
  ): void {
    // Stop existing auto-save
    stopAutoSave(workspace)
    
    const id = setInterval(async () => {
      try {
        const state = getState()
        await save(workspace, state)
      } catch (error) {
        log.error("Auto-save failed", { error })
      }
    }, intervalMs)
    
    autoSaveIntervals.set(workspace, id)
    log.debug("Auto-save started", { workspace, intervalMs })
  }

  export function stopAutoSave(workspace: string): void {
    const id = autoSaveIntervals.get(workspace)
    if (id) {
      clearInterval(id)
      autoSaveIntervals.delete(workspace)
      log.debug("Auto-save stopped", { workspace })
    }
  }

  export function isAutoSaveActive(workspace: string): boolean {
    return autoSaveIntervals.has(workspace)
  }

  /**
   * Migrate session state from old format
   */
  export async function migrate(
    workspace: string,
    fromVersion: string
  ): Promise<void> {
    const state = await load(workspace)
    
    if (!state) {
      log.debug("No state to migrate", { workspace })
      return
    }
    
    if (state.version === fromVersion) {
      // Apply migrations
      // This is where version-specific migrations would go
      
      // Update version
      state.version = "1.0.0"
      
      await save(workspace, state)
      log.info("Session state migrated", { workspace, fromVersion })
    }
  }
}
