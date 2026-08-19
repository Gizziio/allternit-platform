/**
 * Subprocess Provider Discovery
 *
 * Scans PATH for known LLM CLI tools. For each one found, creates a provider
 * entry with auth_type: "subprocess". The user gets it in /model with zero
 * configuration — just having the CLI installed and logged in is enough.
 *
 * Adding a new CLI:
 *   Append an entry to SUBPROCESS_PROVIDERS below. That's it.
 */

import { which } from "bun"
import type { DiscoveredProvider, DiscoveredModel } from "./index"

export interface SubprocessSpec {
  /** Binary name to look for in PATH */
  bin: string
  /** Provider ID in gizzi's model list */
  id: string
  name: string
  /** Icon asset key (maps to /icons/agent-clis/{icon}.svg) */
  icon?: string
  /** Command template — {prompt} is replaced with the user's message */
  cmd: string
  /** Known models surfaced by this CLI */
  models: DiscoveredModel[]
  /**
   * Optional probe — run this and check stdout to confirm auth is active.
   * If omitted, presence in PATH is treated as sufficient.
   */
  probe?: { args: string[]; expect: string | RegExp }
}

export const SUBPROCESS_PROVIDERS: SubprocessSpec[] = [
  // ── Anthropic ────────────────────────────────────────────────────────────
  {
    bin: "claude",
    id: "claude-cli",
    name: "Claude (CLI — subscription or Pro)",
    icon: "claude",
    cmd: "claude -p",
    probe: { args: ["--version"], expect: /Claude Code/ },
    models: [
      { id: "claude-sonnet-4-6",         name: "Claude Sonnet 4.6",  context: 200000, output: 64000 },
      { id: "claude-opus-4-6",           name: "Claude Opus 4.6",    context: 200000, output: 32000 },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5",   context: 200000, output: 16000 },
    ],
  },

  // ── Moonshot / Kimi ──────────────────────────────────────────────────────
  {
    bin: "kimi",
    id: "kimi-cli",
    name: "Kimi (CLI — subscription)",
    icon: "kimi",
    cmd: "kimi -p",
    probe: { args: ["--version"], expect: /kimi/i },
    models: [
      { id: "kimi-k2",           name: "Kimi K2",           context: 131072,  output: 16384 },
      { id: "moonshot-v1-128k",  name: "Moonshot v1 128K",  context: 128000,  output: 8192  },
      { id: "moonshot-v1-32k",   name: "Moonshot v1 32K",   context: 32000,   output: 8192  },
    ],
  },

  // ── Alibaba Qwen ─────────────────────────────────────────────────────────
  {
    bin: "qwen",
    id: "qwen-cli",
    name: "Qwen Code (CLI — subscription)",
    icon: "qwen",
    cmd: "qwen -p",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [
      { id: "qwen-max",          name: "Qwen Max",           context: 32768,   output: 8192  },
      { id: "qwen-plus",         name: "Qwen Plus",          context: 131072,  output: 8192  },
      { id: "qwq-32b",           name: "QwQ 32B (reasoning)",context: 32768,   output: 8192  },
      { id: "qwen3-235b-a22b",   name: "Qwen3 235B",         context: 131072,  output: 16384 },
    ],
  },

  // ── OpenAI Codex ─────────────────────────────────────────────────────────
  {
    bin: "codex",
    id: "codex-cli",
    name: "Codex CLI (OpenAI — subscription or API)",
    icon: "codex",
    cmd: "codex",
    probe: { args: ["--version"], expect: /codex/i },
    models: [
      { id: "codex-mini-latest",  name: "Codex Mini (latest)", context: 200000, output: 100000 },
      { id: "o4-mini",            name: "o4-mini",              context: 200000, output: 100000 },
      { id: "o3",                 name: "o3",                   context: 200000, output: 100000 },
      { id: "gpt-4.1",            name: "GPT-4.1",              context: 1047576, output: 32768 },
    ],
  },

  // ── Google Gemini ─────────────────────────────────────────────────────────
  {
    bin: "gemini",
    id: "gemini-cli",
    name: "Gemini CLI (Google — subscription)",
    icon: "gemini",
    cmd: "gemini -p",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [
      { id: "gemini-2.5-pro",         name: "Gemini 2.5 Pro",        context: 1000000, output: 65536 },
      { id: "gemini-2.5-flash",       name: "Gemini 2.5 Flash",       context: 1000000, output: 65536 },
      { id: "gemini-2.5-flash-lite",  name: "Gemini 2.5 Flash Lite",  context: 1000000, output: 65536 },
    ],
  },

  // ── Google Antigravity (agy CLI — subscription) ──────────────────────────
  {
    bin: "agy",
    id: "antigravity",
    name: "Antigravity (agy CLI — subscription)",
    icon: "agy",
    cmd: "agy -p",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [
      { id: "antigravity", name: "Antigravity (default model)", context: 1000000, output: 65536 },
    ],
  },

  // ── GitHub Copilot ───────────────────────────────────────────────────────
  {
    bin: "gh",
    id: "copilot-cli",
    name: "GitHub Copilot (CLI — subscription)",
    icon: "copilot",
    cmd: "gh copilot suggest -t shell",
    probe: { args: ["copilot", "--version"], expect: /copilot/i },
    models: [
      { id: "copilot-gpt-4o",  name: "Copilot GPT-4o",  context: 128000, output: 4096  },
      { id: "copilot-claude",  name: "Copilot Claude",  context: 200000, output: 8192  },
    ],
  },

  // ── Simon Willison's LLM tool ────────────────────────────────────────────
  {
    bin: "llm",
    id: "llm-cli",
    name: "LLM (CLI — any configured backend)",
    icon: "llm",
    cmd: "llm prompt",
    probe: { args: ["--version"], expect: /llm/ },
    models: [
      { id: "default", name: "LLM CLI default model", context: 128000, output: 8192 },
    ],
  },

  // ── aichat ───────────────────────────────────────────────────────────────
  {
    bin: "aichat",
    id: "aichat-cli",
    name: "AIChat (CLI — any configured backend)",
    icon: "aichat",
    cmd: "aichat",
    probe: { args: ["--version"], expect: /aichat/ },
    models: [
      { id: "default", name: "AIChat default model", context: 128000, output: 8192 },
    ],
  },

  // ── Ollama (CLI — reads installed models) ────────────────────────────────
  {
    bin: "ollama",
    id: "ollama-cli",
    name: "Ollama (CLI)",
    icon: "ollama",
    cmd: "ollama run",
    probe: { args: ["list"], expect: /NAME/ },
    models: [], // populated dynamically via probeOllamaModels()
  },

  // ── fabric ───────────────────────────────────────────────────────────────
  {
    bin: "fabric",
    id: "fabric-cli",
    name: "Fabric (CLI — any configured backend)",
    icon: "fabric",
    cmd: "fabric",
    probe: { args: ["--version"], expect: /fabric/ },
    models: [
      { id: "default", name: "Fabric default model", context: 128000, output: 8192 },
    ],
  },

  // ── ChatGPT (unofficial CLIs) ────────────────────────────────────────────
  {
    bin: "chatgpt",
    id: "chatgpt-cli",
    name: "ChatGPT (CLI — Plus/Pro subscription)",
    icon: "chatgpt",
    cmd: "chatgpt",
    models: [
      { id: "gpt-4o",   name: "GPT-4o",   context: 128000, output: 16384  },
      { id: "o3",       name: "o3",       context: 200000, output: 100000 },
      { id: "o4-mini",  name: "o4-mini",  context: 200000, output: 100000 },
    ],
  },

  // ── Cursor Agent ─────────────────────────────────────────────────────────
  {
    bin: "cursor-agent",
    id: "cursor-agent",
    name: "Cursor Agent",
    icon: "cursor",
    cmd: "cursor-agent",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "Cursor Agent default", context: 200000, output: 64000 }],
  },

  // ── OpenCode ─────────────────────────────────────────────────────────────
  {
    bin: "opencode",
    id: "opencode",
    name: "OpenCode",
    icon: "opencode",
    cmd: "opencode",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "OpenCode default", context: 200000, output: 64000 }],
  },

  // ── OpenClaw ─────────────────────────────────────────────────────────────
  {
    bin: "openclaw",
    id: "openclaw",
    name: "OpenClaw",
    icon: "openclaw",
    cmd: "openclaw",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "OpenClaw default", context: 200000, output: 64000 }],
  },

  // ── Hermes ─────────────────────────────────────────────────────────────────
  {
    bin: "hermes",
    id: "hermes",
    name: "Hermes",
    icon: "hermes",
    cmd: "hermes",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "Hermes default", context: 200000, output: 64000 }],
  },

  // ── Pi ─────────────────────────────────────────────────────────────────────
  {
    bin: "pi",
    id: "pi",
    name: "Pi",
    icon: "pi",
    cmd: "pi -p --mode json",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "Pi default", context: 200000, output: 64000 }],
  },

  // ── CodeBuddy ──────────────────────────────────────────────────────────────
  {
    bin: "codebuddy",
    id: "codebuddy",
    name: "CodeBuddy",
    icon: "codebuddy",
    cmd: "codebuddy",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "CodeBuddy default", context: 200000, output: 64000 }],
  },

  // ── DevEco Code ────────────────────────────────────────────────────────────
  {
    bin: "deveco",
    id: "deveco",
    name: "DevEco Code",
    icon: "deveco",
    cmd: "deveco",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "DevEco Code default", context: 200000, output: 64000 }],
  },

  // ── Grok ───────────────────────────────────────────────────────────────────
  {
    bin: "grok",
    id: "grok",
    name: "Grok",
    icon: "grok",
    cmd: "grok",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "Grok default", context: 200000, output: 64000 }],
  },

  // ── Kiro CLI ───────────────────────────────────────────────────────────────
  {
    bin: "kiro-cli",
    id: "kiro-cli",
    name: "Kiro CLI",
    icon: "kiro",
    cmd: "kiro-cli",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "Kiro CLI default", context: 200000, output: 64000 }],
  },

  // ── Qoder CLI ──────────────────────────────────────────────────────────────
  {
    bin: "qodercli",
    id: "qodercli",
    name: "Qoder CLI",
    icon: "qoder",
    cmd: "qodercli",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "Qoder CLI default", context: 200000, output: 64000 }],
  },

  // ── Qoder CN ───────────────────────────────────────────────────────────────
  {
    bin: "qoderclicn",
    id: "qoderclicn",
    name: "Qoder CN",
    icon: "qoder-cn",
    cmd: "qoderclicn",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "Qoder CN default", context: 200000, output: 64000 }],
  },

  // ── QwenPaw ────────────────────────────────────────────────────────────────
  {
    bin: "qwenpaw",
    id: "qwenpaw",
    name: "QwenPaw",
    icon: "qwenpaw",
    cmd: "qwenpaw",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "QwenPaw default", context: 200000, output: 64000 }],
  },

  // ── Reasonix ───────────────────────────────────────────────────────────────
  {
    bin: "reasonix",
    id: "reasonix",
    name: "Reasonix",
    icon: "reasonix",
    cmd: "reasonix",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "Reasonix default", context: 200000, output: 64000 }],
  },

  // ── Trae CLI ─────────────────────────────────────────────────────────────────
  {
    bin: "traecli",
    id: "traecli",
    name: "Trae CLI",
    icon: "trae",
    cmd: "traecli",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "Trae CLI default", context: 200000, output: 64000 }],
  },

  // ── DeepSeek Harness ─────────────────────────────────────────────────────────
  {
    bin: "dsh",
    id: "dsh",
    name: "DeepSeek Harness",
    icon: "dsh",
    cmd: "dsh --profile multica --stdio",
    probe: { args: ["--profile", "multica", "--probe"], expect: /"type":"probe"/ },
    models: [{ id: "default", name: "DSH default", context: 200000, output: 64000 }],
  },

  // ── Oh-My-Pi ─────────────────────────────────────────────────────────────────
  {
    bin: "omp",
    id: "omp",
    name: "Oh-My-Pi",
    icon: "omp",
    cmd: "omp -p --mode json",
    probe: { args: ["--version"], expect: /\d+\.\d+/ },
    models: [{ id: "default", name: "Oh-My-Pi default", context: 200000, output: 64000 }],
  },
]

async function runProbe(bin: string, spec: SubprocessSpec): Promise<boolean> {
  if (!spec.probe) return true // presence in PATH is enough
  try {
    const proc = Bun.spawn([bin, ...spec.probe.args], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const out = await new Response(proc.stdout).text()
    const { expect } = spec.probe
    return typeof expect === "string" ? out.includes(expect) : expect.test(out)
  } catch {
    return false
  }
}

async function probeOllamaModels(binPath: string): Promise<DiscoveredModel[]> {
  try {
    const proc = Bun.spawn([binPath, "list"], { stdout: "pipe", stderr: "pipe" })
    const out = await new Response(proc.stdout).text()
    const lines = out.split("\n").slice(1).filter(Boolean)
    return lines.map((line) => {
      const [id] = line.trim().split(/\s+/)
      return { id, name: id, context: 128000, output: 8192 }
    })
  } catch {
    return []
  }
}

export async function discoverSubprocessProviders(): Promise<DiscoveredProvider[]> {
  const discovered: DiscoveredProvider[] = []

  await Promise.all(
    SUBPROCESS_PROVIDERS.map(async (spec) => {
      let binPath: string | null = null
      try {
        binPath = which(spec.bin) ?? null
      } catch {
        return
      }
      if (!binPath) return

      const alive = await runProbe(binPath, spec)
      if (!alive) return

      let models = spec.models
      if (spec.id === "ollama-cli" && models.length === 0) {
        models = await probeOllamaModels(binPath)
      }
      if (models.length === 0) return

      discovered.push({
        id: spec.id,
        name: spec.name,
        auth_type: "subprocess",
        subprocess_cmd: `${binPath} ${spec.cmd.split(" ").slice(1).join(" ")}`.trim(),
        source: "subprocess",
        models,
      })
    }),
  )

  return discovered
}
