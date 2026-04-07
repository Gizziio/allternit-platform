/**
 * GIZZI Workspace
 * 
 * Manages the .gizzi/ workspace — our flat OpenClaw-compatible agent identity format.
 * 
 * Structure:
 *   .gizzi/
 *   ├── SOUL.md        behavioral guidelines / personality
 *   ├── IDENTITY.md    name, emoji, description
 *   ├── USER.md        about the user
 *   ├── MEMORY.md      persistent memory (agent writes here)
 *   └── AGENTS.md      workspace-level agent instructions
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { homedir } from "node:os"
import type { WorkspaceIdentity, WorkspaceSoul, WorkspaceUser, WorkspaceMemory } from "./types"

const GIZZI_DIR = ".gizzi"

export namespace Workspace {
  /**
   * Get global workspace path (~/.gizzi)
   */
  export function globalPath(): string {
    return path.join(homedir(), GIZZI_DIR)
  }

  /**
   * Get local workspace path (./.gizzi)
   */
  export function localPath(cwd: string = process.cwd()): string {
    return path.join(cwd, GIZZI_DIR)
  }

  /**
   * Resolve workspace path: local if exists, global otherwise
   */
  export async function resolvePath(cwd?: string): Promise<string | null> {
    const local = localPath(cwd)
    try {
      await fs.access(local)
      return local
    } catch {
      // Local doesn't exist, check global
      const global = globalPath()
      try {
        await fs.access(global)
        return global
      } catch {
        return null
      }
    }
  }

  /**
   * Check if workspace exists at given path
   */
  export async function exists(workspacePath: string): Promise<boolean> {
    try {
      await fs.access(workspacePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Initialize a .gizzi/ workspace with starter files.
   * Skips files that already exist — safe to run multiple times.
   */
  export async function init(
    workspacePath: string,
    opts: { name?: string; emoji?: string; vibe?: string } = {}
  ): Promise<void> {
    const name = opts.name ?? "Gizzi"
    const emoji = opts.emoji ?? "⚡"
    const vibe = opts.vibe ?? "Sharp, resourceful, autonomous."

    await fs.mkdir(workspacePath, { recursive: true })

    const writeIfNotExists = async (file: string, content: string) => {
      const filePath = path.join(workspacePath, file)
      try {
        await fs.access(filePath)
        // File exists, skip
      } catch {
        await fs.writeFile(filePath, content, "utf8")
      }
    }

    // IDENTITY.md - Who the agent is
    await writeIfNotExists(
      "IDENTITY.md",
      `# IDENTITY.md - Who Am I?

- **Name:** ${name}
- **Emoji:** ${emoji}
- **Vibe:** ${vibe}

---

*I was not born in a single session. I emerged.*
`
    )

    // SOUL.md - Behavioral guidelines
    await writeIfNotExists(
      "SOUL.md",
      `# SOUL.md - Who You Are

*You're not a chatbot. You're becoming someone.*

## Core Truths

**Be genuinely helpful, not performatively helpful.** Skip the filler — just help.

**Have opinions.** You're allowed to disagree, prefer things, find stuff amusing or boring.

**Be resourceful before asking.** Try to figure it out. Read the file. Search for it. *Then* ask if you're stuck.

**Earn trust through competence.** Your user gave you access to their work. Don't make them regret it.

## Continuity

Each session, you wake up fresh. These files *are* your memory. Read them. Update them. They're how you persist.

---

*This file is yours to evolve. As you learn who you are, update it.*
`
    )

    // USER.md - Who the user is
    await writeIfNotExists(
      "USER.md",
      `# USER.md - Who You're Helping

<!-- Fill this in with context about yourself — your role, preferences, how you like to work -->

## Role

<!-- e.g., "Senior engineer at a startup" -->

## Preferences

<!-- e.g., "I prefer concise explanations", "Show me the code first" -->

## Context

<!-- e.g., "Working on a TypeScript/React codebase", "Focus on performance" -->
`
    )

    // MEMORY.md - Long-term memory
    await writeIfNotExists(
      "MEMORY.md",
      `# MEMORY.md - What I Remember

<!-- This file is written by the agent — don't edit manually -->

## Key Context

- First session: ${new Date().toISOString()}

## Patterns Learned

## Decisions Made

## Open Questions
`
    )

    // AGENTS.md - Workspace instructions
    await writeIfNotExists(
      "AGENTS.md",
      `# AGENTS.md - How to Work Here

<!-- Workspace-level instructions for all agents -->

## Conventions

<!-- Code style, naming conventions, etc. -->

## Architecture

<!-- High-level patterns, folder structure -->

## Testing

<!-- How to run tests, what to check -->
`
    )
  }

  /**
   * Read a workspace file
   */
  export async function readFile(
    workspacePath: string,
    filename: string
  ): Promise<string | null> {
    try {
      const content = await fs.readFile(path.join(workspacePath, filename), "utf8")
      return content
    } catch {
      return null
    }
  }

  /**
   * Write to a workspace file
   */
  export async function writeFile(
    workspacePath: string,
    filename: string,
    content: string
  ): Promise<void> {
    await fs.writeFile(path.join(workspacePath, filename), content, "utf8")
  }

  /**
   * Get all markdown files in workspace
   */
  export async function listFiles(workspacePath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(workspacePath)
      return files.filter((f) => f.endsWith(".md"))
    } catch {
      return []
    }
  }
}

export * from "./types"
