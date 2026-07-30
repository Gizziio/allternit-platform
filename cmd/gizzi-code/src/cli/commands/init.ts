import path from "path"
import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { Filesystem } from "@/shared/util/filesystem"
import { Workspace } from "@/runtime/workspace/workspace"

type ProjectType = {
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
line-by-line description. If $ARGUMENTS is provided, treat it as extra
context about the intent behind the change.

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
  lines.push("`.gizzi/commands/` (an example is already there — try `/review`).")
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
  lines.push("Hooks, MCP servers, and permissions are configured in `gizzi.json`")
  lines.push("(not created by default, since they change runtime behavior — add")
  lines.push("them deliberately). Examples:")
  lines.push("")
  lines.push("```json")
  lines.push("{")
  lines.push('  "$schema": "https://gizzi.io/config.json",')
  lines.push('  "permission": {')
  lines.push('    "bash": "ask",')
  lines.push('    "edit": "allow"')
  lines.push("  },")
  lines.push('  "hooks": {')
  lines.push('    "command": [')
  lines.push("      {")
  lines.push('        "command": "npm run lint",')
  lines.push('        "events": ["PostToolUse"],')
  lines.push('        "matchers": ["edit"]')
  lines.push("      }")
  lines.push("    ]")
  lines.push("  }")
  lines.push("}")
  lines.push("```")
  lines.push("")
  lines.push("For MCP servers, prefer `gizzi mcp add` over hand-editing the config.")
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

export const InitCommand = cmd({
  command: "init",
  describe: "initialize gizzi in the current project",
  builder: (yargs) => yargs,
  handler: async () => {
    const dir = process.cwd()
    const gizziDir = path.join(dir, ".gizzi")
    const configPath = path.join(dir, "GIZZI.md")

    UI.empty()
    UI.println(UI.Style.TEXT_INFO_BOLD + "Initializing gizzi..." + UI.Style.TEXT_NORMAL)
    UI.empty()

    // 1. Create .gizzi/ directory and workspace identity files
    if (!(await Filesystem.exists(gizziDir))) {
      await Filesystem.mkdir(gizziDir)
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  +  " + UI.Style.TEXT_NORMAL + "Created .gizzi/")
    } else {
      UI.println(UI.Style.TEXT_DIM + "  ·  " + UI.Style.TEXT_NORMAL + ".gizzi/ already exists")
    }

    // 1b. Initialize agent workspace identity (IDENTITY.md, SOUL.md, USER.md, MEMORY.md, AGENTS.md)
    try {
      await Workspace.init(gizziDir)
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  +  " + UI.Style.TEXT_NORMAL + "Created agent workspace identity files")
    } catch (e) {
      UI.println(UI.Style.TEXT_WARNING_BOLD + "  !  " + UI.Style.TEXT_NORMAL + `Workspace identity init failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 2. Detect project type
    const project = await detectProject(dir)
    if (project) {
      UI.println(
        UI.Style.TEXT_SUCCESS_BOLD + "  ✓  " + UI.Style.TEXT_NORMAL + `Detected ${project.name} project`,
      )
    }

    // 2b. Scaffold the skills and commands directories so the harness is
    // discoverable from a fresh init. Hooks/MCP/permissions are documented
    // in GIZZI.md instead of written here, since those change runtime
    // behavior and shouldn't be silently turned on for a new project.
    const skillsDir = path.join(gizziDir, "skills")
    if (!(await Filesystem.exists(skillsDir))) {
      await Filesystem.mkdir(skillsDir, { recursive: true })
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  +  " + UI.Style.TEXT_NORMAL + "Created .gizzi/skills/")
    }

    const commandsDir = path.join(gizziDir, "commands")
    const exampleCommandPath = path.join(commandsDir, "review.md")
    if (!(await Filesystem.exists(exampleCommandPath))) {
      await Filesystem.mkdir(commandsDir, { recursive: true })
      await Filesystem.write(exampleCommandPath, EXAMPLE_COMMAND)
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  +  " + UI.Style.TEXT_NORMAL + "Created .gizzi/commands/review.md (try /review)")
    }

    // 2c. Scaffold the outputs directory (scratch/) so generated artifacts
    // have a fixed home instead of scattering across the tree.
    const scratchDir = path.join(dir, "scratch")
    if (!(await Filesystem.exists(scratchDir))) {
      await Filesystem.mkdir(scratchDir, { recursive: true })
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  +  " + UI.Style.TEXT_NORMAL + "Created scratch/")
    }

    // 3. Create GIZZI.md and its companion ANTI_PATTERNS.md
    if (!(await Filesystem.exists(configPath))) {
      const content = starterConfig(project)
      await Filesystem.write(configPath, content)
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  +  " + UI.Style.TEXT_NORMAL + "Created GIZZI.md")
    } else {
      UI.println(UI.Style.TEXT_DIM + "  ·  " + UI.Style.TEXT_NORMAL + "GIZZI.md already exists")
    }

    const antiPatternsPath = path.join(dir, "ANTI_PATTERNS.md")
    if (!(await Filesystem.exists(antiPatternsPath))) {
      await Filesystem.write(antiPatternsPath, ANTI_PATTERNS_TEMPLATE)
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  +  " + UI.Style.TEXT_NORMAL + "Created ANTI_PATTERNS.md")
    } else {
      UI.println(UI.Style.TEXT_DIM + "  ·  " + UI.Style.TEXT_NORMAL + "ANTI_PATTERNS.md already exists")
    }

    // 4. Add .gizzi/ and scratch/ to .gitignore
    const addedToGitignore = await ensureGitignore(dir, [".gizzi/", "scratch/"])
    if (addedToGitignore.length > 0) {
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  +  " + UI.Style.TEXT_NORMAL + `Added ${addedToGitignore.join(", ")} to .gitignore`)
    } else {
      UI.println(UI.Style.TEXT_DIM + "  ·  " + UI.Style.TEXT_NORMAL + ".gizzi/ and scratch/ already in .gitignore")
    }

    UI.empty()
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Done!" + UI.Style.TEXT_NORMAL + " Edit GIZZI.md to configure your project.")
    UI.empty()
    process.exit(0)
  },
})
