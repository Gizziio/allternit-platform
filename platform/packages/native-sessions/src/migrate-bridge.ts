import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { HarnessId, NativeTranscript, PortableEvent } from "./types.js"

const MIGRATE_FORMATS = new Set<string>([
  "claude",
  "codex",
  "pi",
  "omp",
  "opencode",
  "copilot",
  "antigravity",
  "cursor",
  "vibe",
  "muse",
  "qwen",
  "kimi",
  "grok",
  "kilo",
  "openhands",
  "hermes",
  "mastracode",
  "devin",
])

function scriptPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "project_native.py")
}

export function projectViaSessionMigrate(harness: HarnessId, path: string): NativeTranscript["events"] | undefined {
  if (!MIGRATE_FORMATS.has(harness)) return undefined
  const script = scriptPath()
  if (!existsSync(script)) return undefined
  const result = spawnSync("python3", [script, harness, path], {
    encoding: "utf8",
    timeout: 20_000,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.status !== 0 || !result.stdout) return undefined
  try {
    const parsed = JSON.parse(result.stdout) as { error?: string; events?: PortableEvent[] }
    if (parsed.error || !Array.isArray(parsed.events)) return undefined
    return parsed.events.map((event, recordIndex) => ({
      kind: event.kind,
      role: event.role,
      text: event.text,
      toolName: event.toolName,
      toolId: event.toolId,
      sourceId: event.sourceId,
      recordIndex: event.recordIndex ?? recordIndex,
      inert: true as const,
    }))
  } catch {
    return undefined
  }
}
