// @ts-nocheck
/**
 * AGENTS.md / SKILL.md Guidance Discovery
 *
 * Automatically discovers and loads project guidance files (AGENTS.md,
 * SKILL.md, QWEN.md, .gizzi/instructions.md, etc.) from the project
 * tree. These files are injected into the agent's context as system
 * instructions at session start.
 *
 * Discovery order (low → high priority):
 *   1. Parent directories up to git root or filesystem root
 *   2. Project root AGENTS.md / SKILL.md / QWEN.md
 *   3. .gizzi/instructions.md
 *   4. GIZZI_INSTRUCTIONS env var (file path)
 *
 * All discovered files are concatenated with section headers.
 */

import { Log } from "@/shared/util/log"
import { Filesystem } from "@/shared/util/filesystem"
import path from "path"
import { existsSync } from "fs"

const log = Log.create({ service: "guidance" })

export namespace Guidance {
  /** Well-known guidance file basenames, in discovery priority order. */
  export const GUIDANCE_FILES = [
    "AGENTS.md",
    "SKILL.md",
    "QWEN.md",
    "CLAUDE.md",
    "CURSOR_RULES.md",
    ".cursorrules",
    ".cursor/rules",
  ] as const

  /** Subdirectory guidance files. */
  export const SUBDIR_FILES = [
    ".gizzi/instructions.md",
    ".gizzi/INSTRUCTIONS.md",
    ".gizzi/guidance.md",
  ] as const

  export interface DiscoveredFile {
    path: string
    basename: string
    content: string
    source: "parent" | "root" | "subdir" | "env"
  }

  /**
   * Find the git root of the current working directory.
   */
  async function findGitRoot(startDir: string): Promise<string | null> {
    let dir = startDir
    for (let i = 0; i < 20; i++) {
      if (existsSync(path.join(dir, ".git"))) return dir
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return null
  }

  /**
   * Discover all guidance files from the project tree.
   */
  export async function discover(startDir?: string): Promise<DiscoveredFile[]> {
    const cwd = startDir ?? process.cwd()
    const results: DiscoveredFile[] = []
    const seen = new Set<string>()

    // 1. Walk parent directories up to git root
    const gitRoot = await findGitRoot(cwd)
    let dir = cwd
    const parentDirs: string[] = []

    while (true) {
      if (dir !== cwd) parentDirs.unshift(dir)
      if (gitRoot && dir === gitRoot) break
      if (existsSync(path.join(dir, ".git"))) break
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }

    // Load parent guidance (low priority)
    for (const parentDir of parentDirs) {
      for (const basename of GUIDANCE_FILES) {
        const filePath = path.join(parentDir, basename)
        if (existsSync(filePath) && !seen.has(filePath)) {
          const content = await Filesystem.readText(filePath).catch(() => null)
          if (content) {
            results.push({ path: filePath, basename, content, source: "parent" })
            seen.add(filePath)
          }
        }
      }
    }

    // 2. Project root guidance
    for (const basename of GUIDANCE_FILES) {
      const filePath = path.join(cwd, basename)
      if (existsSync(filePath) && !seen.has(filePath)) {
        const content = await Filesystem.readText(filePath).catch(() => null)
        if (content) {
          results.push({ path: filePath, basename, content, source: "root" })
          seen.add(filePath)
        }
      }
    }

    // 3. Subdirectory guidance files
    for (const subpath of SUBDIR_FILES) {
      const filePath = path.join(cwd, subpath)
      if (existsSync(filePath) && !seen.has(filePath)) {
        const content = await Filesystem.readText(filePath).catch(() => null)
        if (content) {
          results.push({ path: filePath, basename: path.basename(subpath), content, source: "subdir" })
          seen.add(filePath)
        }
      }
    }

    // 4. Environment variable override
    const envInstructions = process.env.GIZZI_INSTRUCTIONS
    if (envInstructions && existsSync(envInstructions) && !seen.has(envInstructions)) {
      const content = await Filesystem.readText(envInstructions).catch(() => null)
      if (content) {
        results.push({ path: envInstructions, basename: path.basename(envInstructions), content, source: "env" })
        seen.add(envInstructions)
      }
    }

    log.info("discovered guidance files", {
      count: results.length,
      files: results.map((r) => r.path),
    })

    return results
  }

  /**
   * Build the combined guidance context string from discovered files.
   */
  export function buildContext(files: DiscoveredFile[]): string {
    if (files.length === 0) return ""

    const sections: string[] = []

    for (const file of files) {
      const relativePath = path.relative(process.cwd(), file.path) || file.path
      sections.push(
        `--- Context from: ${relativePath} ---\n${file.content}\n--- End of Context from: ${relativePath} ---`,
      )
    }

    return sections.join("\n\n")
  }

  /**
   * Convenience: discover and build context in one call.
   */
  export async function load(startDir?: string): Promise<string> {
    const files = await discover(startDir)
    return buildContext(files)
  }

  /**
   * Check if a specific guidance file exists at the project root.
   */
  export function exists(basename: string, dir?: string): boolean {
    return existsSync(path.join(dir ?? process.cwd(), basename))
  }

  /**
   * Get the path to the AGENTS.md file if it exists.
   */
  export function findAgentsMd(dir?: string): string | null {
    const cwd = dir ?? process.cwd()
    const candidates = ["AGENTS.md", "SKILL.md", "QWEN.md"]
    for (const name of candidates) {
      const p = path.join(cwd, name)
      if (existsSync(p)) return p
    }
    return null
  }
}
