/**
 * Reusable `gizzi init` logic.
 *
 * Used by both the CLI command (`cli/commands/init.ts`) and the runtime HTTP
 * route (`runtime/server/routes/project.ts`). Keeps the two entry points in
 * sync and makes the init operation callable from surfaces that cannot spawn
 * a CLI directly (e.g. the Allternit Desktop onboarding wizard).
 */

import path from "path"
import os from "os"
import { Filesystem } from "@/shared/util/filesystem"
import { Workspace } from "@/runtime/workspace/workspace"
import { generateCodemap } from "@/codemap"

export type ProjectType = {
  name: string
  language: string
  buildFile: string
}

const PROJECT_MARKERS: Record<string, ProjectType> = {
  "package.json": { name: "Node.js", language: "TypeScript/JavaScript", buildFile: "package.json" },
  "Cargo.toml": { name: "Rust", language: "Rust", buildFile: "Cargo.toml" },
  "go.mod": { name: "Go", language: "Go", buildFile: "go.mod" },
  "pyproject.toml": { name: "Python", language: "Python", buildFile: "pyproject.toml" },
  "requirements.txt": { name: "Python", language: "Python", buildFile: "requirements.txt" },
  "pom.xml": { name: "Java/Maven", language: "Java", buildFile: "pom.xml" },
  "build.gradle": { name: "Java/Gradle", language: "Java/Kotlin", buildFile: "build.gradle" },
  "Gemfile": { name: "Ruby", language: "Ruby", buildFile: "Gemfile" },
  "mix.exs": { name: "Elixir", language: "Elixir", buildFile: "mix.exs" },
  "Package.swift": { name: "Swift", language: "Swift", buildFile: "Package.swift" },
  "CMakeLists.txt": { name: "C/C++", language: "C/C++", buildFile: "CMakeLists.txt" },
  "Makefile": { name: "Make", language: "C/C++", buildFile: "Makefile" },
}

async function detectProject(dir: string): Promise<ProjectType | undefined> {
  for (const [marker, info] of Object.entries(PROJECT_MARKERS)) {
    if (await Filesystem.exists(path.join(dir, marker))) {
      return info
    }
  }
  return undefined
}

const EXAMPLE_COMMAND = `---
description: Summarize what changed and why, for a commit message or PR description
---

Review the current diff (\`git diff\`, or \`git diff --staged\` if there's staged
work) and summarize it in a few sentences: what changed and why, not a
line-by-line description. If $ARGUMENTS is provided, treat it as extra context
about the intent behind the change.

Focus: $ARGUMENTS
`

const ANTI_PATTERNS_TEMPLATE = `# ANTI_PATTERNS.md

Things Gizzi should specifically avoid in this project — deprecated
patterns, banned libraries, style violations to steer away from. This is
read alongside GIZZI.md at every directory level; keep it short and
concrete. Consistency beats re-explaining constraints every session.

<!-- Example:
- Don't use \`any\` in new TypeScript code — use \`unknown\` and narrow.
- Don't add a new HTTP client; use the existing \`apiClient\` wrapper.
-->
`

function starterConfig(project?: ProjectType): string {
  const lines: string[] = []

  lines.push("# GIZZI.md")
  lines.push("")
  lines.push("This file provides context to Gizzi Code when working in this project.")
  lines.push("")

  if (project) {
    lines.push(`## Project`)
    lines.push("")
    lines.push(`- **Type**: ${project.name}`)
    lines.push(`- **Language**: ${project.language}`)
    lines.push(`- **Build file**: ${project.buildFile}`)
    lines.push("")
  }

  lines.push("## Overview")
  lines.push("")
  lines.push("<!-- Describe what this project does -->")
  lines.push("")
  lines.push("## Architecture")
  lines.push("")
  lines.push("<!-- Describe the project structure and key modules -->")
  lines.push("")
  lines.push("## Development")
  lines.push("")

  if (project?.name === "Node.js") {
    lines.push("```bash")
    lines.push("npm install    # install dependencies")
    lines.push("npm run build  # build the project")
    lines.push("npm test       # run tests")
    lines.push("```")
  } else if (project?.name === "Rust") {
    lines.push("```bash")
    lines.push("cargo build    # build the project")
    lines.push("cargo test     # run tests")
    lines.push("cargo clippy   # lint")
    lines.push("```")
  } else if (project?.name === "Go") {
    lines.push("```bash")
    lines.push("go build ./... # build the project")
    lines.push("go test ./...  # run tests")
    lines.push("go vet ./...   # lint")
    lines.push("```")
  } else if (project?.language === "Python") {
    lines.push("```bash")
    lines.push("pip install -e .  # install in development mode")
    lines.push("pytest            # run tests")
    lines.push("```")
  } else {
    lines.push("<!-- Add build/test/lint commands here -->")
  }

  lines.push("")
  lines.push("## Conventions")
  lines.push("")
  lines.push("<!-- Add coding conventions, style rules, or other guidelines -->")
  lines.push("")
  lines.push("## Harness")
  lines.push("")
  lines.push("Reusable expertise and one-off commands go in `.gizzi/skills/` and")
  lines.push("`.gizzi/commands/` (an example is already there — try `/diff-summary`).")
  lines.push("Both were created by `gizzi init` and are picked up automatically.")
  lines.push("")
  lines.push("`ANTI_PATTERNS.md` (next to this file) is read alongside GIZZI.md at")
  lines.push("every directory level — put deprecated patterns, banned libraries, or")
  lines.push("style violations to avoid there instead of repeating them in prompts.")
  lines.push("")
  lines.push("Generated artifacts (reports, migration plans, one-off scripts) go in")
  lines.push("`scratch/` instead of scattering across the tree — created by")
  lines.push("`gizzi init` and gitignored by default.")
  lines.push("")
  lines.push("Hooks and permissions are configured in `.gizzi/settings.json`")
  lines.push("(not created by default, since they change runtime behavior — add")
  lines.push("them deliberately). Example:")
  lines.push("")
  lines.push("```json")
  lines.push("{")
  lines.push('  "permissions": {')
  lines.push('    "ask": ["Bash"],')
  lines.push('    "allow": ["Edit"]')
  lines.push("  },")
  lines.push('  "hooks": {')
  lines.push('    "PostToolUse": [')
  lines.push("      {")
  lines.push('        "matcher": "Edit",')
  lines.push('        "hooks": [{ "type": "command", "command": "npm run lint" }]')
  lines.push("      }")
  lines.push("    ]")
  lines.push("  }")
  lines.push("}")
  lines.push("```")
  lines.push("")
  lines.push("MCP servers go in `gizzi.json` — prefer `gizzi mcp add` over hand-editing it.")
  lines.push("")

  return lines.join("\n")
}

async function ensureGitignore(dir: string, entries: string[]): Promise<string[]> {
  const gitignorePath = path.join(dir, ".gitignore")
  const bare = (e: string) => e.replace(/\/$/, "")

  let content = ""
  if (await Filesystem.exists(gitignorePath)) {
    content = await Filesystem.readText(gitignorePath)
  }
  const lines = content.split("\n")
  const added: string[] = []
  let toAppend = ""

  for (const entry of entries) {
    if (lines.some((line) => bare(line.trim()) === bare(entry))) continue
    added.push(entry)
    toAppend += entry + "\n"
  }

  if (added.length === 0) return added

  const suffix = content && !content.endsWith("\n") ? "\n" : ""
  await Filesystem.write(gitignorePath, content + suffix + toAppend)
  return added
}

export interface InitializeProjectResult {
  ok: boolean
  dir: string
  project?: ProjectType
  created: string[]
  warnings: string[]
  codemap?: {
    ok: boolean
    staleModules?: string[]
    reason?: string
  }
}

export interface InitializeProjectOptions {
  skipCodemap?: boolean
}

/**
 * Initialize Gizzi in a directory: create .gizzi/, GIZZI.md, ANTI_PATTERNS.md,
 * example skill, scratch/, and (unless skipped) the deterministic codemap.
 */
function normalizeDir(dir: string): string {
  if (dir.startsWith("~/") || dir === "~") {
    return path.join(os.homedir(), dir.slice(1))
  }
  return path.resolve(dir)
}

export async function initializeProject(
  dir: string,
  options: InitializeProjectOptions = {},
): Promise<InitializeProjectResult> {
  const normalizedDir = normalizeDir(dir)
  const result: InitializeProjectResult = {
    ok: true,
    dir: normalizedDir,
    created: [],
    warnings: [],
  }

  const gizziDir = path.join(normalizedDir, ".gizzi")
  const configPath = path.join(normalizedDir, "GIZZI.md")

  // 1. Create .gizzi/
  if (!(await Filesystem.exists(gizziDir))) {
    await Filesystem.mkdir(gizziDir)
    result.created.push(".gizzi/")
  }

  // 2. Workspace identity files
  try {
    await Workspace.init(gizziDir)
    result.created.push(".gizzi workspace identity")
  } catch (e) {
    result.warnings.push(`Workspace identity init failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 3. Detect project type
  const project = await detectProject(normalizedDir)
  result.project = project

  // 4. Scaffold skills / commands / scratch
  const skillsDir = path.join(gizziDir, "skills")
  if (!(await Filesystem.exists(skillsDir))) {
    await Filesystem.mkdir(skillsDir, { recursive: true })
    result.created.push(".gizzi/skills/")
  }

  const commandsDir = path.join(gizziDir, "commands")
  const exampleCommandPath = path.join(commandsDir, "diff-summary.md")
  if (!(await Filesystem.exists(exampleCommandPath))) {
    await Filesystem.mkdir(commandsDir, { recursive: true })
    await Filesystem.write(exampleCommandPath, EXAMPLE_COMMAND)
    result.created.push(".gizzi/commands/diff-summary.md")
  }

  const scratchDir = path.join(normalizedDir, "scratch")
  if (!(await Filesystem.exists(scratchDir))) {
    await Filesystem.mkdir(scratchDir, { recursive: true })
    result.created.push("scratch/")
  }

  // 5. GIZZI.md + ANTI_PATTERNS.md
  if (!(await Filesystem.exists(configPath))) {
    await Filesystem.write(configPath, starterConfig(project))
    result.created.push("GIZZI.md")
  }

  const antiPatternsPath = path.join(normalizedDir, "ANTI_PATTERNS.md")
  if (!(await Filesystem.exists(antiPatternsPath))) {
    await Filesystem.write(antiPatternsPath, ANTI_PATTERNS_TEMPLATE)
    result.created.push("ANTI_PATTERNS.md")
  }

  // 6. .gitignore entries
  const addedToGitignore = await ensureGitignore(normalizedDir, [".gizzi/", "scratch/"])
  if (addedToGitignore.length > 0) {
    result.created.push(`.gitignore (${addedToGitignore.join(", ")})`)
  }

  // 7. Codemap
  if (!options.skipCodemap) {
    try {
      const codemap = await generateCodemap(normalizedDir)
      result.codemap = {
        ok: codemap.ok,
        staleModules: codemap.staleModules,
        reason: codemap.reason,
      }
      if (codemap.ok) {
        result.created.push("docs/codemap/")
      }
    } catch (e) {
      result.warnings.push(`Codemap generation failed: ${e instanceof Error ? e.message : String(e)}`)
      result.codemap = { ok: false, reason: "exception" }
    }
  }

  return result
}
