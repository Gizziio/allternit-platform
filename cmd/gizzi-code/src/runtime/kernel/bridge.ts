/**
 * Agent Workspace Bridge
 *
 * Detects and loads workspace identity from .gizzi/ or .openclaw/ directories.
 * Injects SOUL.md, IDENTITY.md, USER.md, MEMORY.md, AGENTS.md as system prompt context.
 *
 * A2R 5-layer format (.gizzi/ layered):
 *   .gizzi/
 *   ├── manifest.json
 *   ├── L1-COGNITIVE/
 *   │   ├── BRAIN.md
 *   │   └── memory/
 *   │       └── MEMORY.md
 *   ├── L2-IDENTITY/
 *   │   ├── IDENTITY.md
 *   │   ├── SOUL.md
 *   │   └── USER.md
 *   ├── L3-GOVERNANCE/
 *   │   └── PLAYBOOK.md
 *   └── L4-SKILLS/
 *
 * Flat format (.gizzi/ flat — OpenClaw workspace-compatible):
 *   .gizzi/
 *   ├── SOUL.md        behavioral guidelines / personality
 *   ├── IDENTITY.md    name, emoji, description
 *   ├── USER.md        about the user
 *   ├── MEMORY.md      persistent memory (agent writes here)
 *   └── AGENTS.md      workspace-level agent instructions
 *
 * OpenClaw format (.openclaw/):
 *   .openclaw/
 *   └── workspace/     (same flat structure as .gizzi/ flat)
 */

import { Global } from "@/runtime/context/global"
import path from "path"
import { Filesystem } from "@/shared/util/filesystem"
import fs from "fs/promises"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "workspace.bridge" })

/** Files that make a directory a valid flat workspace (at least one must exist) */
const WORKSPACE_ANCHOR_FILES = ["SOUL.md", "IDENTITY.md", "USER.md", "MEMORY.md", "AGENTS.md"]

export interface WorkspaceIdentity {
  /** Agent name parsed from IDENTITY.md */
  name: string
  /** Emoji from IDENTITY.md */
  emoji?: string
  /** Vibe/personality description from IDENTITY.md */
  vibe?: string
  /** Source workspace type */
  source: "gizzi" | "openclaw"
  /** Whether this is the full 5-layer A2R workspace */
  layered?: boolean
  /** Absolute path to the workspace root (for display) */
  workspacePath: string
  /** Raw file contents — injected into system prompt */
  soul?: string     // SOUL.md (L2-IDENTITY/SOUL.md in layered)
  identity?: string // IDENTITY.md (L2-IDENTITY/IDENTITY.md in layered)
  user?: string     // USER.md (L2-IDENTITY/USER.md in layered)
  memory?: string   // MEMORY.md (L1-COGNITIVE/memory/MEMORY.md in layered)
  agents?: string   // AGENTS.md or L3-GOVERNANCE/PLAYBOOK.md in layered
  /** Brain context from L1-COGNITIVE/BRAIN.md (layered only) */
  brain?: string
  /** Voice style from L2-IDENTITY/VOICE.md (layered only) */
  voice?: string
  /** Policy from L2-IDENTITY/POLICY.md (layered only) */
  policy?: string
}

export interface DetectedWorkspace {
  type: "gizzi" | "openclaw"
  /** "layered" = A2R 5-layer, "flat" = OpenClaw-compatible */
  format: "layered" | "flat"
  path: string
  identity?: WorkspaceIdentity
  /** Platform agent ID — set when workspace was activated via POST /v1/workspace/activate */
  agentID?: string
}

/**
 * Check if a directory is a valid A2R 5-layer workspace.
 * Must have manifest.json + L1-COGNITIVE/ + L2-IDENTITY/
 */
async function isLayeredWorkspace(dir: string): Promise<boolean> {
  return (
    (await Filesystem.exists(path.join(dir, "manifest.json"))) &&
    (await Filesystem.exists(path.join(dir, "L1-COGNITIVE"))) &&
    (await Filesystem.exists(path.join(dir, "L2-IDENTITY")))
  )
}

/**
 * Check if a directory is a valid flat workspace (has at least one anchor file).
 */
async function isFlatWorkspace(dir: string): Promise<boolean> {
  for (const file of WORKSPACE_ANCHOR_FILES) {
    if (await Filesystem.exists(path.join(dir, file))) return true
  }
  return false
}

/**
 * Load identity from the A2R 5-layer workspace structure.
 * Reads from L2-IDENTITY/, L1-COGNITIVE/memory/, L3-GOVERNANCE/
 */
async function loadLayeredIdentity(
  workspaceDir: string,
): Promise<WorkspaceIdentity> {
  const read = (p: string) => Filesystem.readText(p).catch(() => undefined)

  const l2 = path.join(workspaceDir, "L2-IDENTITY")
  const l1mem = path.join(workspaceDir, "L1-COGNITIVE", "memory")
  const l3 = path.join(workspaceDir, "L3-GOVERNANCE")

  const [identityRaw, soul, user, voice, policy, memory, playbook, brain] = await Promise.all([
    read(path.join(l2, "IDENTITY.md")),
    read(path.join(l2, "SOUL.md")),
    read(path.join(l2, "USER.md")),
    read(path.join(l2, "VOICE.md")),
    read(path.join(l2, "POLICY.md")),
    read(path.join(l1mem, "MEMORY.md")),
    read(path.join(l3, "PLAYBOOK.md")),
    read(path.join(workspaceDir, "L1-COGNITIVE", "BRAIN.md")),
  ])

  const name = identityRaw
    ? extractField(identityRaw, "Name") ?? extractField(identityRaw, "name") ?? "Gizzi Agent"
    : "Gizzi Agent"
  const emoji = identityRaw
    ? extractField(identityRaw, "Emoji") ?? extractField(identityRaw, "emoji")
    : undefined
  const vibe = identityRaw
    ? extractField(identityRaw, "Vibe") ?? extractField(identityRaw, "vibe")
    : undefined

  return {
    name,
    emoji,
    vibe,
    source: "gizzi",
    layered: true,
    workspacePath: workspaceDir,
    identity: identityRaw,
    soul,
    user,
    voice,
    policy,
    memory,
    agents: playbook,
    brain,
  }
}

/**
 * Load identity from a flat workspace directory (same format for .gizzi/ and .openclaw/workspace/).
 */
async function loadFlatIdentity(
  workspaceDir: string,
  source: "gizzi" | "openclaw",
): Promise<WorkspaceIdentity> {
  const read = (file: string) =>
    Filesystem.readText(path.join(workspaceDir, file)).catch(() => undefined)

  const [identityRaw, soul, user, memory, agents] = await Promise.all([
    read("IDENTITY.md"),
    read("SOUL.md"),
    read("USER.md"),
    read("MEMORY.md"),
    read("AGENTS.md"),
  ])

  const name = identityRaw
    ? extractField(identityRaw, "Name") ?? extractField(identityRaw, "name") ?? "Gizzi Agent"
    : "Gizzi Agent"
  const emoji = identityRaw
    ? extractField(identityRaw, "Emoji") ?? extractField(identityRaw, "emoji")
    : undefined
  const vibe = identityRaw
    ? extractField(identityRaw, "Vibe") ?? extractField(identityRaw, "vibe")
    : undefined

  return {
    name,
    emoji,
    vibe,
    source,
    layered: false,
    workspacePath: workspaceDir,
    identity: identityRaw,
    soul,
    user,
    memory,
    agents,
  }
}

/**
 * Detect workspace by searching in order:
 *  1. <dir>/.gizzi/   — 5-layer check first, then flat (project-local, highest priority)
 *  2. ~/.gizzi/       — 5-layer check first, then flat (global)
 *
 * OpenClaw (~/.openclaw/) is intentionally NOT auto-detected here.
 * It is a migration source only — use Workspace.importFromOpenClaw() to pull
 * files into .gizzi/. This prevents ~/.openclaw/ from silently becoming the
 * active agent identity for users who have not migrated.
 */
export async function detectWorkspace(
  dir: string = process.cwd(),
): Promise<DetectedWorkspace | null> {
  const gizziCandidates = [
    path.join(dir, ".gizzi"),
    path.join(Global.Path.home, ".gizzi"),
  ]

  for (const gizziDir of gizziCandidates) {
    const agentID = await fs.readFile(path.join(gizziDir, ".platform_agent_id"), "utf8").then(s => s.trim()).catch(() => undefined)

    if (await isLayeredWorkspace(gizziDir)) {
      log.info("5-layer workspace detected", { dir: gizziDir })
      const identity = await loadLayeredIdentity(gizziDir)
      return { type: "gizzi", format: "layered", path: gizziDir, identity, agentID }
    }
    if (await isFlatWorkspace(gizziDir)) {
      log.info("flat workspace detected", { dir: gizziDir })
      const identity = await loadFlatIdentity(gizziDir, "gizzi")
      return { type: "gizzi", format: "flat", path: gizziDir, identity, agentID }
    }
  }

  return null
}

/**
 * Build system prompt sections from workspace identity.
 * Layered (5-layer A2R): identity → soul → voice → policy → user → memory → brain → agents/playbook
 * Flat (OpenClaw-compatible): identity → soul → user → memory → agents
 */
export function buildWorkspaceSystemPrompt(identity: WorkspaceIdentity): string {
  const parts: string[] = []

  if (identity.identity) {
    parts.push("# Identity")
    parts.push(identity.identity)
    parts.push("")
  }

  if (identity.soul) {
    parts.push("# Soul")
    parts.push(identity.soul)
    parts.push("")
  }

  // Layered-only: Voice and Policy from L2-IDENTITY/
  if (identity.voice) {
    parts.push("# Communication Style")
    parts.push(identity.voice)
    parts.push("")
  }

  if (identity.policy) {
    parts.push("# Policy")
    parts.push(identity.policy)
    parts.push("")
  }

  if (identity.user) {
    parts.push("# User Context")
    parts.push(identity.user)
    parts.push("")
  }

  if (identity.memory) {
    parts.push("# Memory")
    parts.push(identity.memory)
    parts.push("")
  }

  // Layered-only: Brain context from L1-COGNITIVE/
  if (identity.brain) {
    parts.push("# Task Context")
    parts.push(identity.brain)
    parts.push("")
  }

  if (identity.agents) {
    const heading = identity.layered ? "# Playbook" : "# Workspace Instructions"
    parts.push(heading)
    parts.push(identity.agents)
    parts.push("")
  }

  return parts.join("\n").trim()
}

/**
 * Extract a bullet/bold field value from markdown.
 * Handles: `- **Name:** Gizzi`, `- Name: Gizzi`, `**Name:** Gizzi`
 */
function extractField(content: string, field: string): string | undefined {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patterns = [
    new RegExp(`[-*]\\s*\\*\\*${escaped}:\\*\\*\\s*(.+?)(?:\\n|$)`, "i"),
    new RegExp(`[-*]\\s*${escaped}:\\s*(.+?)(?:\\n|$)`, "i"),
    new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+?)(?:\\n|$)`, "i"),
  ]
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) return match[1].trim()
  }
  return undefined
}

/**
 * Compatibility wrapper used by workspace-loader.ts.
 * Builds a combined system prompt from the agent base prompt + workspace identity.
 */
export async function generateWorkspaceAwarePrompt(
  basePrompt: string,
  workspace: DetectedWorkspace,
): Promise<string> {
  const parts: string[] = []
  if (workspace.identity) {
    parts.push(buildWorkspaceSystemPrompt(workspace.identity))
  }
  if (basePrompt) {
    parts.push("# Agent Configuration")
    parts.push(basePrompt)
  }
  return parts.join("\n\n").trim()
}

/**
 * Get workspace agents (sub-agents defined in .openclaw/workspace/agents/).
 * Only returns agents that have a config.json.
 */
export async function getWorkspaceAgents(
  workspaceRootPath: string,
  type: "gizzi" | "openclaw",
): Promise<Array<{ name: string; path: string; config?: any }>> {
  const agentsPath =
    type === "openclaw"
      ? path.join(workspaceRootPath, "workspace", "agents")
      : path.join(workspaceRootPath, "agents")

  if (!(await Filesystem.exists(agentsPath))) return []

  try {
    const entries = await fs.readdir(agentsPath, { withFileTypes: true })
    const results = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const configPath = path.join(agentsPath, e.name, "config.json")
          const config = await Filesystem.readText(configPath)
            .then((c) => JSON.parse(c))
            .catch(() => undefined)
          return { name: config?.name ?? e.name, path: path.join(agentsPath, e.name), config }
        }),
    )
    return results
  } catch {
    return []
  }
}
