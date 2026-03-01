import path from "path"
import { mkdir, readdir, appendFile } from "fs/promises"
import { Filesystem } from "@/util/filesystem"
import { Log } from "@/util/log"
import { Global } from "@/global"

export namespace GuardArtifacts {
  const log = Log.create({ service: "guard.artifacts" })

  export interface A2RDirectory {
    workspace: string
    a2rRoot: string
    receipts: string
    state: string
    handoff: string
    compact: string
    usage: string
  }

  /**
   * Get A2R directory paths for a workspace
   */
  export function getPaths(workspace: string): A2RDirectory {
    const a2rRoot = path.join(workspace, ".a2r")
    return {
      workspace,
      a2rRoot,
      receipts: path.join(a2rRoot, "receipts"),
      state: path.join(a2rRoot, "state"),
      handoff: path.join(a2rRoot, "handoff"),
      compact: path.join(a2rRoot, "compact"),
      usage: path.join(a2rRoot, "usage"),
    }
  }

  /**
   * Initialize A2R directory structure
   */
  export async function initialize(workspace: string): Promise<A2RDirectory> {
    const paths = getPaths(workspace)

    try {
      // Create directories
      await mkdir(paths.a2rRoot, { recursive: true })
      await mkdir(paths.receipts, { recursive: true })
      await mkdir(paths.state, { recursive: true })
      await mkdir(paths.handoff, { recursive: true })
      await mkdir(paths.compact, { recursive: true })
      await mkdir(paths.usage, { recursive: true })

      // Create empty receipt.jsonl if not exists
      const receiptFile = path.join(paths.receipts, "receipt.jsonl")
      if (!(await Filesystem.exists(receiptFile))) {
        await Filesystem.write(receiptFile, "")
      }

      // Create state.json if not exists
      const stateFile = path.join(paths.state, "state.json")
      if (!(await Filesystem.exists(stateFile))) {
        await Filesystem.write(stateFile, JSON.stringify({
          initialized: true,
          initialized_at: Date.now(),
        }, null, 2))
      }

      log.info("A2R directory structure initialized", { workspace })
      return paths
    } catch (e) {
      log.error("Failed to initialize A2R directories", { workspace, error: e })
      throw e
    }
  }

  /**
   * Check if A2R structure exists
   */
  export async function exists(workspace: string): Promise<boolean> {
    const paths = getPaths(workspace)
    try {
      const a2rExists = await Filesystem.exists(paths.a2rRoot)
      const stateExists = await Filesystem.exists(path.join(paths.state, "state.json"))
      return a2rExists && stateExists
    } catch {
      return false
    }
  }

  /**
   * Write a receipt entry
   */
  export async function appendReceipt(
    workspace: string,
    entry: object
  ): Promise<void> {
    const paths = getPaths(workspace)
    const receiptFile = path.join(paths.receipts, "receipt.jsonl")
    
    try {
      const line = JSON.stringify(entry) + "\n"
      await appendFile(receiptFile, line, "utf-8")
    } catch (e) {
      log.error("Failed to append receipt", { workspace, error: e })
      throw e
    }
  }

  /**
   * Update state.json
   */
  export async function updateState(
    workspace: string,
    state: object
  ): Promise<void> {
    const paths = getPaths(workspace)
    const stateFile = path.join(paths.state, "state.json")
    
    try {
      await Filesystem.write(stateFile, JSON.stringify(state, null, 2))
    } catch (e) {
      log.error("Failed to update state", { workspace, error: e })
      throw e
    }
  }

  /**
   * Read current state
   */
  export async function readState(workspace: string): Promise<object | null> {
    const paths = getPaths(workspace)
    const stateFile = path.join(paths.state, "state.json")
    
    try {
      const content = await Filesystem.readText(stateFile)
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Update handoff pointer
   */
  export async function updateHandoff(
    workspace: string,
    compactPath: string
  ): Promise<void> {
    const paths = getPaths(workspace)
    const handoffFile = path.join(paths.handoff, "latest.md")
    
    const content = `# A2R Handoff Pointer

Generated: ${new Date().toISOString()}

## Current Baton

${compactPath}

## Metadata

- workspace: ${workspace}
- handoff_count: ${await getHandoffCount(workspace)}
`
    
    try {
      await Filesystem.write(handoffFile, content)
      log.info("Handoff pointer updated", { workspace, compactPath })
    } catch (e) {
      log.error("Failed to update handoff", { workspace, error: e })
      throw e
    }
  }

  /**
   * Get handoff count for metadata
   */
  async function getHandoffCount(workspace: string): Promise<number> {
    try {
      const paths = getPaths(workspace)
      const files = await readdir(paths.compact)
      return files.filter((f: string) => f.startsWith("compact-")).length
    } catch {
      return 0
    }
  }

  /**
   * Save usage snapshot
   */
  export async function saveUsage(
    workspace: string,
    usage: object
  ): Promise<string> {
    const paths = getPaths(workspace)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const usageFile = path.join(paths.usage, `usage-${timestamp}.json`)
    
    try {
      await Filesystem.write(usageFile, JSON.stringify(usage, null, 2))
      return usageFile
    } catch (e) {
      log.error("Failed to save usage", { workspace, error: e })
      throw e
    }
  }

  /**
   * Read receipts (for evidence validation)
   */
  export async function readReceipts(
    workspace: string,
    options?: { since?: number; limit?: number }
  ): Promise<object[]> {
    const paths = getPaths(workspace)
    const receiptFile = path.join(paths.receipts, "receipt.jsonl")
    
    try {
      const content = await Filesystem.readText(receiptFile)
      const lines = content.split("\n").filter(Boolean)
      
      let entries: any[] = lines.map((line: string) => JSON.parse(line))
      
      if (options?.since) {
        entries = entries.filter((e: any) => e.ts && e.ts >= (options.since ?? 0))
      }
      
      if (options?.limit) {
        entries = entries.slice(-options.limit)
      }
      
      return entries
    } catch {
      return []
    }
  }
}
