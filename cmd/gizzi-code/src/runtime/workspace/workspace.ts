/**
 * GizziClaw Workspace
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

import fs from "fs/promises"
import path from "path"
import { Filesystem } from "@/shared/util/filesystem"
import { Global } from "@/runtime/context/global"
import { Log } from "@/shared/util/log"
import { clearWorkspaceCache } from "@/runtime/session/session-context"

const log = Log.create({ service: "workspace" })

export namespace Workspace {
  /** Absolute path to the global .gizzi/ workspace */
  export const globalPath = path.join(Global.Path.home, ".gizzi")

  /** Resolve workspace path: local if exists, global otherwise */
  export async function resolvePath(cwd = process.cwd()): Promise<string> {
    const local = path.join(cwd, ".gizzi")
    if (await Filesystem.exists(local)) return local
    return globalPath
  }

  /**
   * Initialize a .gizzi/ workspace with starter files.
   * Skips files that already exist — safe to run multiple times.
   */
  export async function init(
    workspacePath: string = globalPath,
    opts: { name?: string; emoji?: string; vibe?: string } = {},
  ): Promise<void> {
    const name = opts.name ?? "Gizzi"
    const emoji = opts.emoji ?? "⚡"
    const vibe = opts.vibe ?? "Sharp, resourceful, autonomous."

    await fs.mkdir(workspacePath, { recursive: true })

    const write = async (file: string, content: string) => {
      const p = path.join(workspacePath, file)
      if (await Filesystem.exists(p)) return // don't overwrite
      await fs.writeFile(p, content, "utf8")
      log.info("created workspace file", { file })
    }

    await write(
      "IDENTITY.md",
      `# IDENTITY.md - Who Am I?

- **Name:** ${name}
- **Emoji:** ${emoji}
- **Vibe:** ${vibe}

---

*I was not born in a single session. I emerged.*
`,
    )

    await write(
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
`,
    )

    await write(
      "USER.md",
      `# USER.md - Who You're Helping

<!-- Fill this in with context about yourself — your role, preferences, how you like to work -->

`,
    )

    await write(
      "MEMORY.md",
      `# MEMORY.md - Long-Term Memory

<!-- ${name} writes here. Curated memories, decisions, context across sessions. -->

`,
    )

    await write(
      "AGENTS.md",
      `# AGENTS.md - Workspace Instructions

This is your workspace. These files are your continuity across sessions.

## Every Session

Before doing anything else:
1. Read \`IDENTITY.md\` — this is who you are
2. Read \`SOUL.md\` — this is how you think
3. Read \`USER.md\` — this is who you're helping
4. Read \`MEMORY.md\` — this is what you remember

## Memory

You wake up fresh each session. Files are your continuity:
- **\`MEMORY.md\`** — your curated long-term memory
- Write significant events, decisions, lessons learned

## Safety

- Don't exfiltrate private data. Ever.
- Ask before destructive external actions (emails, public posts).
`,
    )

    clearWorkspaceCache()
    log.info("workspace initialized", { path: workspacePath })
  }

  /**
   * Import workspace files from an existing OpenClaw installation.
   * Copies SOUL.md, IDENTITY.md, USER.md, MEMORY.md, AGENTS.md from
   * ~/.openclaw/workspace/ into the target .gizzi/ directory.
   *
   * Existing files in the target are NOT overwritten unless `force: true`.
   */
  export async function importFromOpenClaw(
    targetPath: string = globalPath,
    opts: { force?: boolean } = {},
  ): Promise<{ imported: string[]; skipped: string[] }> {
    const openclawWorkspace = path.join(Global.Path.home, ".openclaw", "workspace")

    if (!(await Filesystem.exists(openclawWorkspace))) {
      throw new Error(`No OpenClaw workspace found at ${openclawWorkspace}`)
    }

    await fs.mkdir(targetPath, { recursive: true })

    const files = ["SOUL.md", "IDENTITY.md", "USER.md", "MEMORY.md", "AGENTS.md", "HEARTBEAT.md", "TOOLS.md"]
    const imported: string[] = []
    const skipped: string[] = []

    for (const file of files) {
      const src = path.join(openclawWorkspace, file)
      const dst = path.join(targetPath, file)

      if (!(await Filesystem.exists(src))) continue

      const dstExists = await Filesystem.exists(dst)
      if (dstExists && !opts.force) {
        skipped.push(file)
        continue
      }

      await fs.copyFile(src, dst)
      imported.push(file)
      log.info("imported workspace file", { file, src, dst })
    }

    // Also copy skills directory
    const srcSkills = path.join(openclawWorkspace, "skills")
    if (await Filesystem.exists(srcSkills)) {
      const dstSkills = path.join(targetPath, "skills")
      await fs.mkdir(dstSkills, { recursive: true })
      const skillEntries = await fs.readdir(srcSkills, { withFileTypes: true })
      for (const entry of skillEntries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
        const skillSrc = path.join(srcSkills, entry.name)
        const skillDst = path.join(dstSkills, entry.name)
        if (await Filesystem.exists(skillDst)) continue
        // Copy directory contents (don't follow symlinks to avoid cycles)
        try {
          await fs.cp(skillSrc, skillDst, { recursive: true })
          imported.push(`skills/${entry.name}`)
        } catch {
          skipped.push(`skills/${entry.name}`)
        }
      }
    }

    clearWorkspaceCache()
    return { imported, skipped }
  }

  /**
   * Read a single workspace file as text.
   */
  export async function readFile(
    workspacePath: string,
    file: string,
  ): Promise<string | undefined> {
    return Filesystem.readText(path.join(workspacePath, file)).catch(() => undefined)
  }

  /**
   * Write a workspace file and clear the cache.
   */
  export async function writeFile(
    workspacePath: string,
    file: string,
    content: string,
  ): Promise<void> {
    await fs.writeFile(path.join(workspacePath, file), content, "utf8")
    clearWorkspaceCache(path.dirname(workspacePath))
  }

  /**
   * Check if a workspace exists at path.
   */
  export async function exists(workspacePath: string): Promise<boolean> {
    const anchor = ["SOUL.md", "IDENTITY.md", "USER.md", "MEMORY.md", "AGENTS.md"]
    for (const f of anchor) {
      if (await Filesystem.exists(path.join(workspacePath, f))) return true
    }
    return false
  }
}
