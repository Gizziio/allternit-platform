import path from "path"
import os from "os"
import { Global } from "@/runtime/context/global"
import { Filesystem } from "@/shared/util/filesystem"
import { Config } from "@/runtime/context/config/config"
import { Instance } from "@/runtime/context/project/instance"
import { Flag } from "@/runtime/context/flag/flag"
import { Log } from "@/shared/util/log"
import { Glob } from "@/shared/util/glob"
import type { MessageV2 } from "@/runtime/session/message-v2"

const log = Log.create({ service: "instruction" })

const FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTEXT.md", // deprecated
]

const MAX_MEMORY_LINES = 200

/** Generate a stable hash-based directory name from a project path */
function projectHash(directory: string): string {
  // Use a simple path-based key: replace path separators with dashes, trim leading dash
  const sanitized = directory.replace(/^\//, "").replace(/\//g, "-")
  return sanitized
}

/** Global per-project memory directory (persists across workspace cleans) */
function globalProjectMemoryDir(): string {
  return path.join(Global.Path.config, "projects", projectHash(Instance.directory), "memory")
}

/** Workspace memory directories to scan for .md files */
function workspaceMemoryDirs(): string[] {
  return [
    path.join(Instance.directory, ".gizzi", "L1-COGNITIVE", "memory"),
    path.join(Instance.directory, ".openclaw", "L1-COGNITIVE", "memory"),
    globalProjectMemoryDir(),
  ]
}

/** Workspace memory files to auto-load into context */
function workspaceMemoryFiles(): string[] {
  const files: string[] = []
  // .gizzi workspace memory
  files.push(path.join(Instance.directory, ".gizzi", "L1-COGNITIVE", "memory", "MEMORY.md"))
  // .openclaw workspace memory (legacy)
  files.push(path.join(Instance.directory, ".openclaw", "L1-COGNITIVE", "memory", "MEMORY.md"))
  // Global per-project memory
  files.push(path.join(globalProjectMemoryDir(), "MEMORY.md"))
  return files
}

/** Discover all topic memory files (*.md) in all workspace memory dirs */
async function discoverTopicMemoryFiles(): Promise<string[]> {
  const results: string[] = []
  const seen = new Set<string>()
  for (const dir of workspaceMemoryDirs()) {
    if (!(await Filesystem.exists(dir))) continue
    const files = await Glob.scan("*.md", { cwd: dir, absolute: true, include: "file" }).catch(() => [])
    for (const f of files) {
      const resolved = path.resolve(f)
      // Skip MEMORY.md itself (already loaded separately)
      if (path.basename(resolved) === "MEMORY.md") continue
      // Deduplicate by basename across directories
      if (seen.has(path.basename(resolved))) continue
      seen.add(path.basename(resolved))
      results.push(resolved)
    }
  }
  return results
}

async function loadMemoryFile(filepath: string): Promise<string> {
  const content = await Filesystem.readText(filepath).catch(() => "")
  if (!content) return ""
  const lines = content.split("\n")
  const truncated = lines.slice(0, MAX_MEMORY_LINES).join("\n")
  const suffix = lines.length > MAX_MEMORY_LINES
    ? `\n\n<!-- Truncated at ${MAX_MEMORY_LINES} lines. ${lines.length - MAX_MEMORY_LINES} lines omitted. -->`
    : ""
  return "Auto-memory from: " + filepath + "\n" + truncated + suffix
}

function globalFiles() {
  const files = []
  if (Flag.GIZZI_CONFIG_DIR) {
    files.push(path.join(Flag.GIZZI_CONFIG_DIR, "AGENTS.md"))
  }
  files.push(path.join(Global.Path.config, "AGENTS.md"))
  if (!Flag.GIZZI_DISABLE_CLAUDE_CODE_PROMPT) {
    files.push(path.join(os.homedir(), ".claude", "CLAUDE.md"))
  }
  return files
}

async function resolveRelative(instruction: string): Promise<string[]> {
  if (!Flag.GIZZI_DISABLE_PROJECT_CONFIG) {
    return Filesystem.globUp(instruction, Instance.directory, Instance.worktree).catch(() => [])
  }
  if (!Flag.GIZZI_CONFIG_DIR) {
    log.warn(
      `Skipping relative instruction "${instruction}" - no GIZZI_CONFIG_DIR set while project config is disabled`,
    )
    return []
  }
  return Filesystem.globUp(instruction, Flag.GIZZI_CONFIG_DIR, Flag.GIZZI_CONFIG_DIR).catch(() => [])
}

export namespace InstructionPrompt {
  const state = Instance.state(() => {
    return {
      claims: new Map<string, Set<string>>(),
    }
  })

  function isClaimed(messageID: string, filepath: string) {
    const claimed = state().claims.get(messageID)
    if (!claimed) return false
    return claimed.has(filepath)
  }

  function claim(messageID: string, filepath: string) {
    const current = state()
    let claimed = current.claims.get(messageID)
    if (!claimed) {
      claimed = new Set()
      current.claims.set(messageID, claimed)
    }
    claimed.add(filepath)
  }

  export function clear(messageID: string) {
    state().claims.delete(messageID)
  }

  export async function systemPaths() {
    const config = await Config.get()
    const paths = new Set<string>()

    if (!Flag.GIZZI_DISABLE_PROJECT_CONFIG) {
      for (const file of FILES) {
        const matches = await Filesystem.findUp(file, Instance.directory, Instance.worktree)
        if (matches.length > 0) {
          matches.forEach((p) => {
            paths.add(path.resolve(p))
          })
          break
        }
      }
    }

    for (const file of globalFiles()) {
      if (await Filesystem.exists(file)) {
        paths.add(path.resolve(file))
        break
      }
    }

    // Auto-load workspace memory files (MEMORY.md from all layers)
    for (const file of workspaceMemoryFiles()) {
      if (await Filesystem.exists(file)) {
        paths.add(path.resolve(file))
      }
    }

    // Auto-load topic-specific memory files (*.md in memory dir, excluding MEMORY.md)
    const topicFiles = await discoverTopicMemoryFiles()
    for (const file of topicFiles) {
      paths.add(file)
    }

    if (config.instructions) {
      for (let instruction of config.instructions) {
        if (instruction.startsWith("https://") || instruction.startsWith("http://")) continue
        if (instruction.startsWith("~/")) {
          instruction = path.join(os.homedir(), instruction.slice(2))
        }
        const matches = path.isAbsolute(instruction)
          ? await Glob.scan(path.basename(instruction), {
              cwd: path.dirname(instruction),
              absolute: true,
              include: "file",
            }).catch(() => [])
          : await resolveRelative(instruction)
        matches.forEach((p) => {
          paths.add(path.resolve(p))
        })
      }
    }

    return paths
  }

  export async function system() {
    const config = await Config.get()
    const paths = await systemPaths()

    const topicFiles = await discoverTopicMemoryFiles()
    const memoryPaths = new Set([
      ...workspaceMemoryFiles().map((f) => path.resolve(f)),
      ...topicFiles,
    ])
    const files = Array.from(paths).map(async (p) => {
      if (memoryPaths.has(p)) return loadMemoryFile(p)
      const content = await Filesystem.readText(p).catch(() => "")
      return content ? "Instructions from: " + p + "\n" + content : ""
    })

    const urls: string[] = []
    if (config.instructions) {
      for (const instruction of config.instructions) {
        if (instruction.startsWith("https://") || instruction.startsWith("http://")) {
          urls.push(instruction)
        }
      }
    }
    const fetches = urls.map((url) =>
      fetch(url, { signal: AbortSignal.timeout(5000) })
        .then((res) => (res.ok ? res.text() : ""))
        .catch(() => "")
        .then((x) => (x ? "Instructions from: " + url + "\n" + x : "")),
    )

    return Promise.all([...files, ...fetches]).then((result) => result.filter(Boolean))
  }

  export function loaded(messages: MessageV2.WithParts[]) {
    const paths = new Set<string>()
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (part.type === "tool" && part.tool === "read" && part.state.status === "completed") {
          if (part.state.time.compacted) continue
          const loaded = part.state.metadata?.loaded
          if (!loaded || !Array.isArray(loaded)) continue
          for (const p of loaded) {
            if (typeof p === "string") paths.add(p)
          }
        }
      }
    }
    return paths
  }

  export async function find(dir: string) {
    for (const file of FILES) {
      const filepath = path.resolve(path.join(dir, file))
      if (await Filesystem.exists(filepath)) return filepath
    }
  }

  export async function resolve(messages: MessageV2.WithParts[], filepath: string, messageID: string) {
    const system = await systemPaths()
    const already = loaded(messages)
    const results: { filepath: string; content: string }[] = []

    const target = path.resolve(filepath)
    let current = path.dirname(target)
    const root = path.resolve(Instance.directory)

    while (current.startsWith(root) && current !== root) {
      const found = await find(current)

      if (found && found !== target && !system.has(found) && !already.has(found) && !isClaimed(messageID, found)) {
        claim(messageID, found)
        const content = await Filesystem.readText(found).catch(() => undefined)
        if (content) {
          results.push({ filepath: found, content: "Instructions from: " + found + "\n" + content })
        }
      }
      current = path.dirname(current)
    }

    return results
  }
}
