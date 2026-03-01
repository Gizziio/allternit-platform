/**
 * Checkpoint Module - Crash Recovery
 * 
 * Handles automatic checkpoints for crash recovery through the A2R platform.
 * Checkpoints capture the current state of the workspace including file snapshots,
 * receipt offsets, and state hashes. Stored in L1-COGNITIVE/memory/checkpoints/.
 * 
 * Features:
 * - Manual and automatic checkpoint creation
 * - Checkpoint listing and restoration
 * - Automatic pruning of old checkpoints
 * - Configurable auto-checkpoint intervals
 */

import path from "path"
import crypto from "crypto"
import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
import { AgentWorkspace } from "./artifacts"

const log = Log.create({ service: "agent_workspace.checkpoint" })

/**
 * Auto-checkpoint interval in milliseconds (5 minutes default)
 */
export const DEFAULT_CHECKPOINT_INTERVAL_MS = 300000

/**
 * Default number of checkpoints to keep
 */
export const DEFAULT_KEEP_COUNT = 10

/**
 * Checkpoint data structure
 */
export interface CheckpointData {
  /** Unique checkpoint identifier */
  id: string
  /** Unix timestamp (ms) when checkpoint was created */
  timestamp: number
  /** Human-readable description */
  description: string
  /** File snapshots - map of relative path to content hash */
  files: Record<string, FileSnapshot>
  /** Receipt offset in memory.jsonl (number of lines) */
  receiptOffset: number
  /** SHA-256 hash of checkpoint state for integrity verification */
  stateHash: string
  /** Optional reason for checkpoint creation */
  reason?: string
  /** Optional tags for categorization */
  tags?: string[]
}

/**
 * File snapshot information
 */
export interface FileSnapshot {
  /** Relative path from workspace root */
  path: string
  /** SHA-256 content hash */
  hash: string
  /** File size in bytes */
  size: number
  /** Last modified timestamp */
  mtime: number
  /** Optional content for small files (< 10KB) */
  content?: string
}

/**
 * Options for creating a checkpoint
 */
export interface CheckpointOptions {
  /** Reason for checkpoint (e.g., 'manual', 'auto', 'pre-operation') */
  reason?: string
  /** Human-readable description */
  description?: string
  /** Tags for categorization */
  tags?: string[]
  /** Whether to include file contents for small files */
  includeContent?: boolean
}

/**
 * Options for pruning checkpoints
 */
export interface PruneOptions {
  /** Number of most recent checkpoints to keep */
  keepCount?: number
  /** Remove checkpoints older than this (ms) */
  olderThan?: number
  /** Remove checkpoints with these tags */
  excludeTags?: string[]
}

/**
 * Active auto-checkpoint timers
 */
const autoCheckpointTimers = new Map<string, ReturnType<typeof setInterval>>()

/**
 * Checkpoint namespace - Crash recovery operations
 */
export namespace Checkpoint {
  /**
   * Create a new checkpoint for the workspace
   * 
   * @param workspace - Path to the workspace
   * @param options - Checkpoint creation options
   * @returns The created checkpoint data
   */
  export async function create(
    workspace: string,
    options?: CheckpointOptions
  ): Promise<CheckpointData> {
    const paths = AgentWorkspace.getPaths(workspace)
    const timestamp = Date.now()
    const id = generateCheckpointId(timestamp)
    
    log.info("Creating checkpoint", { workspace, id, reason: options?.reason })

    // Ensure checkpoints directory exists
    await Filesystem.mkdir(paths.l1_checkpoints)

    // Gather file snapshots
    const files = await gatherFileSnapshots(workspace, options?.includeContent ?? true)

    // Get current receipt offset from memory.jsonl
    const receiptOffset = await getReceiptOffset(paths.l1_memory_jsonl)

    // Build checkpoint data (without hash first)
    const checkpoint: Omit<CheckpointData, "stateHash"> & { stateHash?: string } = {
      id,
      timestamp,
      description: options?.description ?? `Checkpoint created at ${new Date(timestamp).toISOString()}`,
      files,
      receiptOffset,
      reason: options?.reason ?? "manual",
      tags: options?.tags ?? [],
    }

    // Calculate state hash
    checkpoint.stateHash = calculateStateHash(checkpoint as CheckpointData)

    // Write checkpoint file
    const checkpointPath = getCheckpointPath(paths.l1_checkpoints, id)
    await Filesystem.writeJson(checkpointPath, checkpoint)

    log.info("Checkpoint created", { workspace, id, fileCount: Object.keys(files).length })

    // Auto-prune after creation
    await prune(workspace, { keepCount: DEFAULT_KEEP_COUNT })

    return checkpoint as CheckpointData
  }

  /**
   * List all checkpoints for a workspace
   * 
   * @param workspace - Path to the workspace
   * @returns Array of checkpoint data, sorted by timestamp (newest first)
   */
  export async function list(workspace: string): Promise<CheckpointData[]> {
    const paths = AgentWorkspace.getPaths(workspace)
    
    try {
      // Check if checkpoints directory exists
      if (!(await Filesystem.exists(paths.l1_checkpoints))) {
        return []
      }

      // Scan for checkpoint files
      const { Glob } = await import("@/util/glob")
      const checkpointFiles = await Glob.scan("checkpoint-*.json", {
        cwd: paths.l1_checkpoints,
        absolute: true,
        include: "file",
      })

      // Read and parse each checkpoint
      const checkpoints: CheckpointData[] = []
      for (const file of checkpointFiles) {
        try {
          const data = await Filesystem.readJson<CheckpointData>(file)
          // Verify integrity
          if (verifyCheckpointIntegrity(data)) {
            checkpoints.push(data)
          } else {
            log.warn("Checkpoint integrity check failed", { file, id: data.id })
          }
        } catch (err) {
          log.warn("Failed to read checkpoint file", { file, error: err })
        }
      }

      // Sort by timestamp (newest first)
      return checkpoints.sort((a, b) => b.timestamp - a.timestamp)
    } catch (err) {
      log.warn("Failed to list checkpoints", { workspace, error: err })
      return []
    }
  }

  /**
   * Restore workspace state from a checkpoint
   * 
   * @param workspace - Path to the workspace
   * @param checkpointId - ID of checkpoint to restore
   */
  export async function restore(workspace: string, checkpointId: string): Promise<void> {
    const paths = AgentWorkspace.getPaths(workspace)
    const checkpointPath = getCheckpointPath(paths.l1_checkpoints, checkpointId)

    log.info("Restoring checkpoint", { workspace, checkpointId })

    // Read checkpoint
    let checkpoint: CheckpointData
    try {
      checkpoint = await Filesystem.readJson<CheckpointData>(checkpointPath)
    } catch (err) {
      throw new Error(`Checkpoint not found: ${checkpointId}`)
    }

    // Verify integrity
    if (!verifyCheckpointIntegrity(checkpoint)) {
      throw new Error(`Checkpoint integrity check failed: ${checkpointId}`)
    }

    // Restore file snapshots (only for files with content stored)
    for (const [filePath, snapshot] of Object.entries(checkpoint.files)) {
      if (snapshot.content !== undefined) {
        const fullPath = path.join(workspace, filePath)
        try {
          await Filesystem.write(fullPath, snapshot.content)
          log.debug("Restored file from checkpoint", { path: filePath })
        } catch (err) {
          log.warn("Failed to restore file", { path: filePath, error: err })
        }
      }
    }

    // Truncate memory.jsonl to receipt offset if needed
    if (checkpoint.receiptOffset >= 0) {
      await truncateMemoryToOffset(paths.l1_memory_jsonl, checkpoint.receiptOffset)
    }

    log.info("Checkpoint restored", { workspace, checkpointId })
  }

  /**
   * Prune old checkpoints
   * 
   * @param workspace - Path to the workspace
   * @param options - Prune options
   * @returns Number of checkpoints removed
   */
  export async function prune(workspace: string, options?: PruneOptions): Promise<number> {
    const paths = AgentWorkspace.getPaths(workspace)
    const keepCount = options?.keepCount ?? DEFAULT_KEEP_COUNT

    log.debug("Pruning checkpoints", { workspace, keepCount })

    const checkpoints = await list(workspace)
    if (checkpoints.length <= keepCount) {
      return 0
    }

    const toRemove: CheckpointData[] = []
    const now = Date.now()

    // Determine which checkpoints to remove
    for (let i = keepCount; i < checkpoints.length; i++) {
      const checkpoint = checkpoints[i]
      let shouldRemove = true

      // Check age filter
      if (options?.olderThan !== undefined) {
        if (now - checkpoint.timestamp < options.olderThan) {
          shouldRemove = false
        }
      }

      // Check tag exclusion
      if (options?.excludeTags !== undefined && checkpoint.tags) {
        if (checkpoint.tags.some(tag => options.excludeTags!.includes(tag))) {
          shouldRemove = false
        }
      }

      if (shouldRemove) {
        toRemove.push(checkpoint)
      }
    }

    // Remove checkpoints
    let removed = 0
    for (const checkpoint of toRemove) {
      try {
        const checkpointPath = getCheckpointPath(paths.l1_checkpoints, checkpoint.id)
        const { rm } = await import("fs/promises")
        await rm(checkpointPath, { force: true })
        removed++
        log.debug("Removed checkpoint", { id: checkpoint.id })
      } catch (err) {
        log.warn("Failed to remove checkpoint", { id: checkpoint.id, error: err })
      }
    }

    log.info("Pruned checkpoints", { workspace, removed, remaining: checkpoints.length - removed })
    return removed
  }

  /**
   * Start automatic checkpointing
   * 
   * @param workspace - Path to the workspace
   * @param intervalMs - Interval between checkpoints in milliseconds
   */
  export async function startAutoCheckpoint(workspace: string, intervalMs: number): Promise<void> {
    // Stop existing timer if any
    stopAutoCheckpoint(workspace)

    log.info("Starting auto-checkpoint", { workspace, intervalMs })

    // Create initial checkpoint
    try {
      await create(workspace, { reason: "auto", description: "Auto-checkpoint started" })
    } catch (err) {
      log.warn("Failed to create initial auto-checkpoint", { workspace, error: err })
    }

    // Set up interval
    const timer = setInterval(() => {
      create(workspace, { reason: "auto", description: "Automatic checkpoint" }).catch(err => {
        log.warn("Auto-checkpoint failed", { workspace, error: err })
      })
    }, intervalMs)

    autoCheckpointTimers.set(workspace, timer)
  }

  /**
   * Stop automatic checkpointing
   * 
   * @param workspace - Path to the workspace
   */
  export function stopAutoCheckpoint(workspace: string): void {
    const timer = autoCheckpointTimers.get(workspace)
    if (timer) {
      clearInterval(timer)
      autoCheckpointTimers.delete(workspace)
      log.info("Stopped auto-checkpoint", { workspace })
    }
  }

  /**
   * Check if auto-checkpoint is active for a workspace
   * 
   * @param workspace - Path to the workspace
   * @returns True if auto-checkpoint is running
   */
  export function isAutoCheckpointActive(workspace: string): boolean {
    return autoCheckpointTimers.has(workspace)
  }

  /**
   * Get the most recent checkpoint
   * 
   * @param workspace - Path to the workspace
   * @returns Most recent checkpoint or null
   */
  export async function getLatest(workspace: string): Promise<CheckpointData | null> {
    const checkpoints = await list(workspace)
    return checkpoints[0] ?? null
  }

  /**
   * Get a specific checkpoint by ID
   * 
   * @param workspace - Path to the workspace
   * @param checkpointId - Checkpoint ID
   * @returns Checkpoint data or null
   */
  export async function get(workspace: string, checkpointId: string): Promise<CheckpointData | null> {
    const paths = AgentWorkspace.getPaths(workspace)
    const checkpointPath = getCheckpointPath(paths.l1_checkpoints, checkpointId)

    try {
      const checkpoint = await Filesystem.readJson<CheckpointData>(checkpointPath)
      return verifyCheckpointIntegrity(checkpoint) ? checkpoint : null
    } catch {
      return null
    }
  }

  /**
   * Delete a specific checkpoint
   * 
   * @param workspace - Path to the workspace
   * @param checkpointId - Checkpoint ID to delete
   * @returns True if deleted successfully
   */
  export async function deleteCheckpoint(workspace: string, checkpointId: string): Promise<boolean> {
    const paths = AgentWorkspace.getPaths(workspace)
    const checkpointPath = getCheckpointPath(paths.l1_checkpoints, checkpointId)

    // Check if checkpoint exists first
    if (!(await Filesystem.exists(checkpointPath))) {
      return false
    }

    try {
      const { rm } = await import("fs/promises")
      await rm(checkpointPath, { force: true })
      log.info("Deleted checkpoint", { workspace, checkpointId })
      return true
    } catch (err) {
      log.warn("Failed to delete checkpoint", { workspace, checkpointId, error: err })
      return false
    }
  }
}

/**
 * Generate checkpoint ID from timestamp
 */
function generateCheckpointId(timestamp: number): string {
  const ts = timestamp.toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `checkpoint-${ts}-${random}`
}

/**
 * Get checkpoint file path
 */
function getCheckpointPath(checkpointsDir: string, id: string): string {
  // Extract sequence number for sorting (NNN format)
  const checkpoints = id.match(/checkpoint-([a-z0-9]+)-/)
  const seq = checkpoints ? checkpoints[1] : "000"
  return path.join(checkpointsDir, `checkpoint-${seq}.json`)
}

/**
 * Gather file snapshots from workspace
 */
async function gatherFileSnapshots(
  workspace: string,
  includeContent: boolean
): Promise<Record<string, FileSnapshot>> {
  const files: Record<string, FileSnapshot> = {}
  
  try {
    const { Glob } = await import("@/util/glob")
    
    // Scan workspace files
    const allFilePaths = await Glob.scan("**/*", {
      cwd: workspace,
      absolute: true,
      include: "file",
    })

    // Filter out excluded directories
    const excludePatterns = [".a2r/", "node_modules/", ".git/", "dist/", "build/"]
    const filePaths = allFilePaths.filter(filePath => {
      const relativePath = path.relative(workspace, filePath)
      return !excludePatterns.some(pattern => relativePath.includes(pattern))
    })

    for (const filePath of filePaths) {
      try {
        const stats = Filesystem.stat(filePath)
        if (!stats || !stats.isFile()) continue

        const relativePath = path.relative(workspace, filePath)
        const content = await Filesystem.readBytes(filePath)
        const hash = crypto.createHash("sha256").update(content).digest("hex")

        const snapshot: FileSnapshot = {
          path: relativePath,
          hash,
          size: typeof stats.size === "bigint" ? Number(stats.size) : stats.size,
          mtime: stats.mtime.getTime(),
        }

        // Include content for small files (< 10KB)
        if (includeContent && stats.size < 10 * 1024) {
          snapshot.content = content.toString("utf-8")
        }

        files[relativePath] = snapshot
      } catch (err) {
        log.debug("Failed to snapshot file", { path: filePath, error: err })
      }
    }
  } catch (err) {
    log.warn("Failed to gather file snapshots", { workspace, error: err })
  }

  return files
}

/**
 * Get receipt offset from memory.jsonl
 */
async function getReceiptOffset(memoryPath: string): Promise<number> {
  try {
    if (!(await Filesystem.exists(memoryPath))) {
      return 0
    }
    const content = await Filesystem.readText(memoryPath)
    return content.split("\n").filter(line => line.trim()).length
  } catch {
    return 0
  }
}

/**
 * Calculate state hash for integrity verification
 */
function calculateStateHash(checkpoint: Omit<CheckpointData, "stateHash">): string {
  const data = JSON.stringify({
    id: checkpoint.id,
    timestamp: checkpoint.timestamp,
    description: checkpoint.description,
    files: checkpoint.files,
    receiptOffset: checkpoint.receiptOffset,
    reason: checkpoint.reason,
    tags: checkpoint.tags,
  })
  return crypto.createHash("sha256").update(data).digest("hex")
}

/**
 * Verify checkpoint integrity
 */
function verifyCheckpointIntegrity(checkpoint: CheckpointData): boolean {
  const expectedHash = calculateStateHash(checkpoint)
  return expectedHash === checkpoint.stateHash
}

/**
 * Truncate memory.jsonl to specified line offset
 */
async function truncateMemoryToOffset(memoryPath: string, offset: number): Promise<void> {
  try {
    if (!(await Filesystem.exists(memoryPath))) {
      return
    }
    const content = await Filesystem.readText(memoryPath)
    const lines = content.split("\n")
    const truncated = lines.slice(0, offset).join("\n")
    await Filesystem.write(memoryPath, truncated)
  } catch (err) {
    log.warn("Failed to truncate memory", { path: memoryPath, error: err })
  }
}
