import { homedir } from "node:os"
import { join } from "node:path"
import type { HarnessId, HarnessMeta } from "./types.js"

function envPath(name: string | undefined, fallback: (home: string) => string, home: string): string {
  if (name) {
    const value = process.env[name]
    if (value) return value
  }
  return fallback(home)
}

export const HARNESSES: HarnessMeta[] = [
  { id: "claude", label: "Claude Code", reader: "jsonl", projectable: true, resumeHint: "claude --resume <id>", envHome: "CLAUDE_CONFIG_DIR", defaultHome: (h) => join(h, ".claude") },
  { id: "gizzi", label: "Gizzi Code", reader: "jsonl", projectable: true, resumeHint: "gizzi /resume <id>", defaultHome: (h) => join(h, ".gizzi") },
  { id: "codex", label: "Codex", reader: "jsonl", projectable: true, resumeHint: "codex resume <id>", envHome: "CODEX_HOME", defaultHome: (h) => join(h, ".codex") },
  { id: "grok", label: "Grok", reader: "directory", projectable: true, resumeHint: "grok --resume <id>", envHome: "GROK_HOME", defaultHome: (h) => join(h, ".grok") },
  { id: "kimi", label: "Kimi Code", reader: "directory", projectable: true, resumeHint: "kimi --session <id>", envHome: "KIMI_CODE_HOME", defaultHome: (h) => join(h, ".kimi-code") },
  { id: "kimi-cli", label: "Kimi CLI", reader: "jsonl", projectable: true, resumeHint: "kimi", defaultHome: (h) => join(h, ".kimi") },
  { id: "qwen", label: "Qwen Code", reader: "jsonl", projectable: true, resumeHint: "qwen --resume <id>", envHome: "QWEN_HOME", defaultHome: (h) => join(h, ".qwen") },
  { id: "opencode", label: "OpenCode", reader: "sqlite", projectable: true, resumeHint: "opencode --session <id>", envHome: "OPENCODE_DATA", defaultHome: (h) => join(h, ".local", "share", "opencode") },
  { id: "copilot", label: "GitHub Copilot CLI", reader: "jsonl", projectable: true, resumeHint: "copilot --resume=<id>", defaultHome: (h) => join(h, ".copilot") },
  { id: "pi", label: "Pi", reader: "jsonl", projectable: true, resumeHint: "pi --session <id>", envHome: "PI_CODING_AGENT_DIR", defaultHome: (h) => join(h, ".pi", "agent") },
  { id: "omp", label: "Oh My Pi", reader: "jsonl", projectable: true, resumeHint: "omp --resume=<id>", defaultHome: (h) => join(h, ".omp", "agent") },
  { id: "cursor", label: "Cursor Agent", reader: "jsonl", projectable: true, resumeHint: "cursor-agent --resume <id>", defaultHome: (h) => join(h, ".cursor") },
  { id: "antigravity", label: "Antigravity", reader: "sqlite", projectable: false, resumeHint: "agy --conversation <id>", defaultHome: (h) => join(h, ".gemini", "antigravity-cli") },
  { id: "vibe", label: "Mistral Vibe", reader: "directory", projectable: true, resumeHint: "vibe", envHome: "VIBE_HOME", defaultHome: (h) => join(h, ".vibe") },
  { id: "muse", label: "Muse Code", reader: "jsonl", projectable: true, resumeHint: "muse", defaultHome: (h) => join(h, ".local", "share", "muse") },
  { id: "kilo", label: "Kilo Code", reader: "cli-export", projectable: false, resumeHint: "kilo --session <id>", defaultHome: (h) => join(h, ".local", "share", "kilo") },
  { id: "openhands", label: "OpenHands", reader: "directory", projectable: true, resumeHint: "openhands", envHome: "OPENHANDS_CONVERSATIONS_DIR", defaultHome: (h) => join(h, ".openhands", "conversations") },
  { id: "hermes", label: "Hermes Agent", reader: "sqlite", projectable: false, resumeHint: "hermes --resume <id>", envHome: "HERMES_HOME", defaultHome: (h) => join(h, ".hermes") },
  { id: "mastracode", label: "MastraCode", reader: "sqlite", projectable: false, resumeHint: "mastracode --thread <id>", envHome: "MASTRA_DB_PATH", defaultHome: (h) => join(h, ".local", "share", "mastra") },
  { id: "devin", label: "Devin CLI", reader: "sqlite", projectable: false, resumeHint: "devin --resume <id>", defaultHome: (h) => join(h, ".devin") },
  { id: "gemini", label: "Gemini CLI", reader: "jsonl", projectable: true, resumeHint: "gemini", defaultHome: (h) => join(h, ".gemini") },
  { id: "aider", label: "Aider", reader: "jsonl", projectable: true, resumeHint: "aider", defaultHome: (h) => join(h, ".aider") },
  { id: "cline", label: "Cline", reader: "directory", projectable: false, resumeHint: "cline", defaultHome: (h) => join(h, "Library", "Application Support", "Code", "User", "globalStorage", "saoudrizwan.claude-dev") },
  { id: "amp", label: "Amp", reader: "directory", projectable: false, resumeHint: "amp", defaultHome: (h) => join(h, ".local", "share", "amp") },
  { id: "kiro", label: "Kiro", reader: "directory", projectable: false, resumeHint: "kiro --yolo", defaultHome: (h) => join(h, "Library", "Application Support", "Kiro") },
  { id: "droid", label: "Factory Droid", reader: "jsonl", projectable: true, resumeHint: "droid --resume <id>", defaultHome: (h) => join(h, ".factory") },
  { id: "crush", label: "Crush", reader: "sqlite", projectable: false, resumeHint: "crush", defaultHome: (h) => join(h, ".crush") },
]

export const HARNESS_BY_ID = new Map(HARNESSES.map((h) => [h.id, h]))

export function harnessHome(id: HarnessId, home = homedir()): string {
  const meta = HARNESS_BY_ID.get(id)
  if (!meta) throw new Error(`unknown harness ${id}`)
  return envPath(meta.envHome, meta.defaultHome, home)
}

export function encodeClaudeCwd(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, "-")
}

export function encodeGrokCwd(cwd: string): string {
  return encodeURIComponent(cwd)
}
