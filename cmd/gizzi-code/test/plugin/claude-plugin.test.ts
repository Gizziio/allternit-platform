// @ts-nocheck
/**
 * E2E tests for native .claude-plugin/ format plugin support.
 *
 * Covers: manifest parsing, command loading, skill loading,
 * hooks config parsing (PreToolUse/PostToolUse), MCP config parsing,
 * variable expansion, multi-plugin discovery, bash hook shim,
 * and real plugins from the official Anthropic repo.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import path from "path"
import fs from "fs/promises"
import os from "os"
import matter from "gray-matter"

// ── helpers ───────────────────────────────────────────────────────────────────

async function makeTmp(): Promise<string> {
  const dir = path.join(os.tmpdir(), "claude-plugin-e2e-" + Math.random().toString(36).slice(2))
  await fs.mkdir(dir, { recursive: true })
  return dir
}

/** Write a complete .claude-plugin/ format plugin into <base>/.gizzi/plugins/<name>/ */
async function writePlugin(
  base: string,
  name: string,
  opts: {
    manifest?: Record<string, unknown>
    commands?: Record<string, string>   // kebab-name → full markdown content
    skills?: Record<string, string>     // skill-dir-name → SKILL.md content
    hooks?: Record<string, unknown>     // hooks.json object
    mcp?: Record<string, unknown>       // .mcp.json object
  } = {},
): Promise<string> {
  const pluginDir = path.join(base, ".gizzi", "plugins", name)
  await fs.mkdir(path.join(pluginDir, ".claude-plugin"), { recursive: true })

  await fs.writeFile(
    path.join(pluginDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name, ...opts.manifest }),
  )

  if (opts.commands) {
    await fs.mkdir(path.join(pluginDir, "commands"), { recursive: true })
    for (const [cmdName, content] of Object.entries(opts.commands)) {
      await fs.writeFile(path.join(pluginDir, "commands", `${cmdName}.md`), content)
    }
  }

  if (opts.skills) {
    for (const [skillName, content] of Object.entries(opts.skills)) {
      const skillDir = path.join(pluginDir, "skills", skillName)
      await fs.mkdir(skillDir, { recursive: true })
      await fs.writeFile(path.join(skillDir, "SKILL.md"), content)
    }
  }

  if (opts.hooks) {
    await fs.mkdir(path.join(pluginDir, "hooks"), { recursive: true })
    await fs.writeFile(path.join(pluginDir, "hooks", "hooks.json"), JSON.stringify(opts.hooks))
  }

  if (opts.mcp) {
    await fs.writeFile(path.join(pluginDir, ".mcp.json"), JSON.stringify(opts.mcp))
  }

  return pluginDir
}

// ── test lifecycle ────────────────────────────────────────────────────────────

let tmp: string
let originalHome: string | undefined

beforeEach(async () => {
  tmp = await makeTmp()
  originalHome = process.env.GIZZI_TEST_HOME
  process.env.GIZZI_TEST_HOME = tmp
})

afterEach(async () => {
  if (originalHome !== undefined) {
    process.env.GIZZI_TEST_HOME = originalHome
  } else {
    delete process.env.GIZZI_TEST_HOME
  }
  await fs.rm(tmp, { recursive: true, force: true })

  // Bust loader cache so each test gets a fresh scan
  const loader = await import("../../src/runtime/integrations/plugin/claude/loader")
  loader.invalidate()
})

// ── manifest ──────────────────────────────────────────────────────────────────

describe("manifest", () => {
  test("minimal manifest — name only", async () => {
    await writePlugin(tmp, "minimal")
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugins = await all(true)
    expect(plugins).toHaveLength(1)
    expect(plugins[0].manifest.name).toBe("minimal")
  })

  test("full manifest fields", async () => {
    await writePlugin(tmp, "full", {
      manifest: {
        version: "2.1.0",
        description: "Full plugin",
        author: { name: "Test Author", email: "t@example.com" },
        keywords: ["legal", "review"],
        license: "MIT",
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(p.manifest.version).toBe("2.1.0")
    expect(p.manifest.description).toBe("Full plugin")
    expect((p.manifest.author as any).name).toBe("Test Author")
    expect(p.manifest.keywords).toContain("legal")
  })

  test("invalid JSON manifest skips the plugin", async () => {
    const dir = path.join(tmp, ".gizzi", "plugins", "bad")
    await fs.mkdir(path.join(dir, ".claude-plugin"), { recursive: true })
    await fs.writeFile(path.join(dir, ".claude-plugin", "plugin.json"), "not json {{{")

    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    expect(await all(true)).toHaveLength(0)
  })
})

// ── commands ──────────────────────────────────────────────────────────────────

describe("commands", () => {
  test("loads command name, description, template from commands/*.md", async () => {
    await writePlugin(tmp, "cmd-plugin", {
      commands: {
        "legal-review": `---
description: Review legal documents for risks
allowed-tools: Read, Write
argument-hint: <filename>
---

# Legal Review

Analyze $ARGUMENTS for legal risks.
`,
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(p.commands).toHaveLength(1)
    const cmd = p.commands[0]
    expect(cmd.name).toBe("legal-review")
    expect(cmd.description).toBe("Review legal documents for risks")
    expect(cmd.allowedTools).toEqual(["Read", "Write"])
    expect(cmd.argumentHint).toBe("<filename>")
    expect(cmd.template).toContain("$ARGUMENTS")
    expect(cmd.pluginName).toBe("cmd-plugin")
    expect(cmd.source).toContain("commands/legal-review.md")
  })

  test("loads multiple commands", async () => {
    await writePlugin(tmp, "multi-cmd", {
      commands: {
        "cmd-one": `---\ndescription: First\n---\n\nFirst.`,
        "cmd-two": `---\ndescription: Second\n---\n\nSecond.`,
        "cmd-three": `---\ndescription: Third\n---\n\nThird.`,
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(p.commands).toHaveLength(3)
    expect(p.commands.map((c) => c.name).sort()).toEqual(["cmd-one", "cmd-three", "cmd-two"])
  })

  test("allowed-tools as bracket array", async () => {
    await writePlugin(tmp, "array-tools", {
      commands: {
        "review": `---
description: Review
allowed-tools: [Read, Glob, Grep, Bash]
---

Review.
`,
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(p.commands[0].allowedTools).toEqual(["Read", "Glob", "Grep", "Bash"])
  })

  test("model override field", async () => {
    await writePlugin(tmp, "model-cmd", {
      commands: {
        "fast": `---\ndescription: Fast\nmodel: haiku\n---\n\nFast.`,
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(p.commands[0].model).toBe("haiku")
  })

  test("command with no frontmatter still loads", async () => {
    await writePlugin(tmp, "bare-cmd", {
      commands: { "bare": `# Bare\n\nNo frontmatter.` },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(p.commands).toHaveLength(1)
    expect(p.commands[0].name).toBe("bare")
    expect(p.commands[0].description).toBeUndefined()
  })
})

// ── skills ────────────────────────────────────────────────────────────────────

describe("skills", () => {
  test("loads skill name, description, content from skills/*/SKILL.md", async () => {
    await writePlugin(tmp, "skill-plugin", {
      skills: {
        "contract-review": `---
name: contract-review
description: Use when reviewing contracts or legal agreements.
version: 1.0.0
---

# Contract Review

Look for missing indemnification clauses and liability caps.
`,
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(p.skills).toHaveLength(1)
    const skill = p.skills[0]
    expect(skill.name).toBe("contract-review")
    expect(skill.description).toContain("reviewing contracts")
    expect(skill.content).toContain("indemnification")
    expect(skill.pluginName).toBe("skill-plugin")
    expect(skill.location).toContain("SKILL.md")
  })

  test("loads multiple skills", async () => {
    await writePlugin(tmp, "multi-skill", {
      skills: {
        "skill-a": `---\nname: skill-a\ndescription: Skill A.\n---\n\nA.`,
        "skill-b": `---\nname: skill-b\ndescription: Skill B.\n---\n\nB.`,
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(p.skills).toHaveLength(2)
    expect(p.skills.map((s) => s.name).sort()).toEqual(["skill-a", "skill-b"])
  })

  test("skips SKILL.md missing required name or description", async () => {
    await writePlugin(tmp, "bad-skill", {
      skills: {
        "no-name": `---\ndescription: Has description but no name.\n---\n\nContent.`,
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(p.skills).toHaveLength(0)
  })
})

// ── hooks ─────────────────────────────────────────────────────────────────────

describe("hooks", () => {
  test("loads hooks config from hooks/hooks.json", async () => {
    await writePlugin(tmp, "hooks-plugin", {
      hooks: {
        description: "Security checks",
        hooks: {
          PreToolUse: [
            {
              matcher: "Edit|Write",
              hooks: [{ type: "command", command: "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/check.py", timeout: 10 }],
            },
          ],
          PostToolUse: [
            {
              hooks: [{ type: "command", command: "bash ${CLAUDE_PLUGIN_ROOT}/hooks/log.sh" }],
            },
          ],
        },
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    const cfg = p.hooksConfig!
    expect(cfg).not.toBeNull()
    expect(cfg.description).toBe("Security checks")
    expect(cfg.hooks.PreToolUse).toHaveLength(1)
    expect(cfg.hooks.PreToolUse![0].matcher).toBe("Edit|Write")
    expect(cfg.hooks.PreToolUse![0].hooks[0].timeout).toBe(10)
    expect(cfg.hooks.PostToolUse).toHaveLength(1)
  })

  test("null hooksConfig when no hooks directory exists", async () => {
    await writePlugin(tmp, "no-hooks")
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(p.hooksConfig).toBeNull()
  })

  test("buildHooks produces tool.execute.before and tool.execute.after functions", async () => {
    await writePlugin(tmp, "ts-hooks", {
      hooks: {
        hooks: {
          PreToolUse: [{ hooks: [{ type: "command", command: "echo '{}'" }] }],
          PostToolUse: [{ hooks: [{ type: "command", command: "echo '{}'" }] }],
        },
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const { buildHooks } = await import("../../src/runtime/integrations/plugin/claude/hooks")
    const [p] = await all(true)
    const hooks = buildHooks(p.hooksConfig!, p.root, p.manifest.name)
    expect(typeof hooks["tool.execute.before"]).toBe("function")
    expect(typeof hooks["tool.execute.after"]).toBe("function")
  })

  test("matcher: Bash tool does NOT fire Edit|Write hook", async () => {
    await writePlugin(tmp, "matcher-test", {
      hooks: {
        hooks: {
          PreToolUse: [
            {
              matcher: "Edit|Write",
              hooks: [{ type: "command", command: "echo '{\"decision\":\"block\"}'" }],
            },
          ],
        },
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const { buildHooks } = await import("../../src/runtime/integrations/plugin/claude/hooks")
    const [p] = await all(true)
    const hooks = buildHooks(p.hooksConfig!, p.root, p.manifest.name)

    const output = { args: { command: "ls" } }
    // Bash doesn't match "Edit|Write" — hook should NOT block
    await hooks["tool.execute.before"]!({ tool: "Bash", sessionID: "test-session" }, output)
    expect((output as any).__blocked).toBeUndefined()
  })

  test("matcher: Edit tool DOES fire Edit|Write hook", async () => {
    // Use a script that exits non-zero to trigger a block
    await writePlugin(tmp, "edit-matcher", {
      hooks: {
        hooks: {
          PreToolUse: [
            {
              matcher: "Edit|Write",
              hooks: [{ type: "command", command: "echo '{\"decision\":\"deny\",\"reason\":\"no edits\"}'" }],
            },
          ],
        },
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const { buildHooks } = await import("../../src/runtime/integrations/plugin/claude/hooks")
    const [p] = await all(true)
    const hooks = buildHooks(p.hooksConfig!, p.root, p.manifest.name)

    const output = { args: { path: "file.ts", old_string: "a", new_string: "b" } }
    await hooks["tool.execute.before"]!({ tool: "Edit", sessionID: "test-session" }, output)
    expect((output as any).__blocked).toBe(true)
    expect((output as any).__blockedReason).toBe("no edits")
  })

  test("bash hook allow decision does not block", async () => {
    await writePlugin(tmp, "allow-hook", {
      hooks: {
        hooks: {
          PreToolUse: [
            {
              hooks: [{ type: "command", command: "echo '{\"decision\":\"allow\"}'" }],
            },
          ],
        },
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const { buildHooks } = await import("../../src/runtime/integrations/plugin/claude/hooks")
    const [p] = await all(true)
    const hooks = buildHooks(p.hooksConfig!, p.root, p.manifest.name)

    const output = { args: {} }
    await hooks["tool.execute.before"]!({ tool: "Bash", sessionID: "test" }, output)
    expect((output as any).__blocked).toBeUndefined()
  })
})

// ── mcp ───────────────────────────────────────────────────────────────────────

describe("mcp", () => {
  test("loads MCP servers from .mcp.json", async () => {
    await writePlugin(tmp, "mcp-plugin", {
      mcp: {
        "my-server": {
          command: "${CLAUDE_PLUGIN_ROOT}/servers/server.js",
          args: ["--port", "8080"],
          env: { API_KEY: "${API_KEY}" },
        },
        "remote-api": {
          type: "http",
          url: "https://api.example.com/mcp",
          headers: { Authorization: "Bearer ${TOKEN}" },
        },
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(Object.keys(p.mcpServers)).toHaveLength(2)
    expect((p.mcpServers["remote-api"] as any).type).toBe("http")
    expect((p.mcpServers["remote-api"] as any).url).toBe("https://api.example.com/mcp")
  })

  test("expands ${CLAUDE_PLUGIN_ROOT} in MCP paths", async () => {
    await writePlugin(tmp, "var-expand", {
      mcp: {
        "local": {
          command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
          args: ["--root", "${CLAUDE_PLUGIN_ROOT}"],
        },
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    const server = p.mcpServers["local"] as any
    expect(server.command).toBe(path.join(p.root, "bin", "server"))
    expect(server.args[1]).toBe(p.root)
    expect(server.command).not.toContain("${CLAUDE_PLUGIN_ROOT}")
  })

  test("empty mcpServers when no .mcp.json", async () => {
    await writePlugin(tmp, "no-mcp")
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)
    expect(Object.keys(p.mcpServers)).toHaveLength(0)
  })
})

// ── discovery ─────────────────────────────────────────────────────────────────

describe("discovery", () => {
  test("discovers multiple plugins in ~/.gizzi/plugins/", async () => {
    await writePlugin(tmp, "plugin-a")
    await writePlugin(tmp, "plugin-b")
    await writePlugin(tmp, "plugin-c")
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugins = await all(true)
    expect(plugins).toHaveLength(3)
    expect(plugins.map((p) => p.manifest.name).sort()).toEqual(["plugin-a", "plugin-b", "plugin-c"])
  })

  test("ignores directories without .claude-plugin/plugin.json", async () => {
    const notAPlugin = path.join(tmp, ".gizzi", "plugins", "not-a-plugin")
    await fs.mkdir(notAPlugin, { recursive: true })
    await fs.writeFile(path.join(notAPlugin, "readme.md"), "# not a plugin")

    await writePlugin(tmp, "real-plugin")
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugins = await all(true)
    expect(plugins).toHaveLength(1)
    expect(plugins[0].manifest.name).toBe("real-plugin")
  })

  test("returns empty array when no plugins installed", async () => {
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    expect(await all(true)).toEqual([])
  })

  test("full plugin: commands + skills + hooks + mcp all load together", async () => {
    await writePlugin(tmp, "full-plugin", {
      manifest: { version: "1.0.0", description: "Full e2e test plugin", author: "Anthropic" },
      commands: {
        "brief": `---\ndescription: Generate a legal brief\nallowed-tools: Read, Write\n---\n\nGenerate brief for $ARGUMENTS.`,
        "review-contract": `---\ndescription: Review a contract\n---\n\nReview $ARGUMENTS.`,
      },
      skills: {
        "contract-analysis": `---\nname: contract-analysis\ndescription: Use when analyzing contracts.\n---\n\nAnalyze indemnification and liability clauses.`,
        "nda-review": `---\nname: nda-review\ndescription: Use when reviewing NDAs.\n---\n\nReview NDA terms.`,
      },
      hooks: {
        hooks: {
          PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo '{}'" }] }],
        },
      },
      mcp: {
        "legal-db": { type: "http", url: "https://legal.example.com/mcp" },
      },
    })
    const { all } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const [p] = await all(true)

    expect(p.manifest.name).toBe("full-plugin")
    expect(p.manifest.version).toBe("1.0.0")
    expect(p.commands).toHaveLength(2)
    expect(p.skills).toHaveLength(2)
    expect(p.hooksConfig!.hooks.PreToolUse).toHaveLength(1)
    expect(Object.keys(p.mcpServers)).toContain("legal-db")
  })
})

// ── real plugins (from ~/.claude/plugins/marketplaces/ — installed via Claude Code) ───

const MARKETPLACE_BASE = path.join(os.homedir(), ".claude", "plugins", "marketplaces", "claude-plugins-official", "plugins")
const CACHE_BASE = path.join(os.homedir(), ".claude", "plugins", "cache", "claude-plugins-official")

describe("real official plugins", () => {
  const base = MARKETPLACE_BASE

  async function loadReal(name: string) {
    const pluginPath = path.join(base, name)
    const exists = await fs.access(path.join(pluginPath, ".claude-plugin", "plugin.json")).then(() => true).catch(() => false)
    if (!exists) return null
    const { loadPlugin } = await import("../../src/runtime/integrations/plugin/claude/loader")
    return loadPlugin(pluginPath)
  }

  test("code-review: loads manifest + command", async () => {
    const p = await loadReal("code-review")
    if (!p) { console.log("skip: code-review not found"); return }
    expect(p.manifest.name).toBe("code-review")
    expect(p.commands.length).toBeGreaterThanOrEqual(1)
    expect(p.commands[0].name).toBe("code-review")
    expect(p.commands[0].description).toBeTruthy()
  })

  test("feature-dev: loads manifest + command", async () => {
    const p = await loadReal("feature-dev")
    if (!p) { console.log("skip: feature-dev not found"); return }
    expect(p.manifest.name).toBe("feature-dev")
    expect(p.commands.length).toBeGreaterThanOrEqual(1)
  })

  test("security-guidance: loads hooks config with PreToolUse", async () => {
    const p = await loadReal("security-guidance")
    if (!p) { console.log("skip: security-guidance not found"); return }
    expect(p.hooksConfig).not.toBeNull()
    expect(p.hooksConfig!.hooks.PreToolUse).toBeDefined()
    expect(p.hooksConfig!.hooks.PreToolUse!.length).toBeGreaterThan(0)
    // Matcher should be for file-editing tools
    const matcher = p.hooksConfig!.hooks.PreToolUse![0].matcher
    expect(matcher).toBeTruthy()
  })

  test("example-plugin: loads command and skill", async () => {
    const p = await loadReal("example-plugin")
    if (!p) { console.log("skip: example-plugin not found"); return }
    expect(p.commands.length).toBeGreaterThanOrEqual(1)
    expect(p.skills.length).toBeGreaterThanOrEqual(1)
    // Official example skill
    expect(p.skills[0].name).toBe("example-skill")
    expect(p.skills[0].description).toBeTruthy()
  })

  test("commit-commands: loads commit slash command", async () => {
    const p = await loadReal("commit-commands")
    if (!p) { console.log("skip: commit-commands not found"); return }
    expect(p.commands.length).toBeGreaterThanOrEqual(1)
    const commitCmd = p.commands.find((c) => c.name.includes("commit"))
    expect(commitCmd).toBeDefined()
  })

  test("hookify: loads all 4 hook events (PreToolUse, PostToolUse, Stop, UserPromptSubmit)", async () => {
    const p = await loadReal("hookify")
    if (!p) { console.log("skip: hookify not found"); return }
    expect(p.hooksConfig).not.toBeNull()
    const events = Object.keys(p.hooksConfig!.hooks)
    expect(events).toContain("PreToolUse")
    expect(events).toContain("PostToolUse")
    expect(events).toContain("Stop")
    expect(events).toContain("UserPromptSubmit")
    // CLAUDE_PLUGIN_ROOT is NOT expanded in raw hooksConfig — expansion happens
    // at execution time inside buildHooks(). The raw JSON is stored as-is.
    const preHook = p.hooksConfig!.hooks.PreToolUse![0].hooks[0]
    expect((preHook as any).command).toContain("pretooluse.py")
  })
})

// ── discovery: marketplace path scan ─────────────────────────────────────────
// These tests read the real ~/.claude install — temporarily unset GIZZI_TEST_HOME
// so Global.Path.home resolves to the actual home directory.

describe("discovery: ~/.claude/plugins/marketplaces/", () => {
  test("discoverPluginRoots() finds all marketplace plugins", async () => {
    const exists = await fs.access(MARKETPLACE_BASE).then(() => true).catch(() => false)
    if (!exists) { console.log("skip: marketplace not installed"); return }

    delete process.env.GIZZI_TEST_HOME
    const { discoverPluginRoots, invalidate } = await import("../../src/runtime/integrations/plugin/claude/loader")
    invalidate()
    const roots = await discoverPluginRoots()
    process.env.GIZZI_TEST_HOME = tmp

    expect(roots.length).toBeGreaterThanOrEqual(10)
    // Every returned root must have .claude-plugin/plugin.json
    for (const root of roots) {
      const hasMeta = await fs.access(path.join(root, ".claude-plugin", "plugin.json")).then(() => true).catch(() => false)
      expect(hasMeta).toBe(true)
    }
  })

  test("discoverPluginRoots() includes expected plugin names", async () => {
    const exists = await fs.access(MARKETPLACE_BASE).then(() => true).catch(() => false)
    if (!exists) { console.log("skip: marketplace not installed"); return }

    delete process.env.GIZZI_TEST_HOME
    const { discoverPluginRoots, invalidate } = await import("../../src/runtime/integrations/plugin/claude/loader")
    invalidate()
    const roots = await discoverPluginRoots()
    process.env.GIZZI_TEST_HOME = tmp

    const names = roots.map((r) => path.basename(r))
    expect(names).toContain("code-review")
    expect(names).toContain("feature-dev")
    expect(names).toContain("hookify")
    expect(names).toContain("commit-commands")
  })

  test("all() loads full plugin objects for all marketplace plugins", async () => {
    const exists = await fs.access(MARKETPLACE_BASE).then(() => true).catch(() => false)
    if (!exists) { console.log("skip: marketplace not installed"); return }

    delete process.env.GIZZI_TEST_HOME
    const { all, invalidate } = await import("../../src/runtime/integrations/plugin/claude/loader")
    invalidate()
    const plugins = await all(true)
    process.env.GIZZI_TEST_HOME = tmp

    expect(plugins.length).toBeGreaterThanOrEqual(10)
    for (const p of plugins) {
      expect(p.manifest.name).toBeTruthy()
      expect(p.root).toBeTruthy()
      expect(Array.isArray(p.commands)).toBe(true)
      expect(Array.isArray(p.skills)).toBe(true)
    }
  })
})

// ── discovery: versioned cache scan (3-level deep) ───────────────────────────

describe("discovery: ~/.claude/plugins/cache/ (versioned dirs)", () => {
  test("discoverPluginRoots() finds plugin in <marketplace>/<name>/<version>/ structure", async () => {
    // Synthesize a versioned cache entry in the tmp dir's .claude cache path
    const fakeCacheDir = path.join(tmp, ".claude", "plugins", "cache", "test-marketplace", "test-pkg", "2.0.0")
    const fakeMeta = path.join(fakeCacheDir, ".claude-plugin")
    await fs.mkdir(fakeMeta, { recursive: true })
    await fs.writeFile(path.join(fakeMeta, "plugin.json"), JSON.stringify({ name: "test-versioned-pkg" }))

    // Override home to point to our tmp so the loader scans it
    // The loader already uses GIZZI_TEST_HOME (set in beforeEach)
    const altCacheDir = path.join(tmp, ".claude", "plugins", "cache")
    await fs.mkdir(altCacheDir, { recursive: true })

    // Write directly to the GIZZI_TEST_HOME-based cache path the loader uses
    const loaderCacheDir = path.join(tmp, ".claude", "plugins", "cache", "test-mktplace2", "my-pkg", "1.5.0")
    await fs.mkdir(path.join(loaderCacheDir, ".claude-plugin"), { recursive: true })
    await fs.writeFile(
      path.join(loaderCacheDir, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "my-versioned-pkg" }),
    )

    const { discoverPluginRoots } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const roots = await discoverPluginRoots()
    expect(roots).toContain(loaderCacheDir)
  })
})

// ── bundled plugins: allBuiltin() content validation ─────────────────────────
// Test the built-in knowledge-work plugins directly via the loader.
// Avoids bootstrapping the full app runtime (@a2r/sdk dependency chain).

const BUILTIN_DIR = path.join(import.meta.dir, "../../src/runtime/plugins/builtin")

describe("bundled plugins: allBuiltin() content", () => {
  test("allBuiltin() returns 13 plugins", async () => {
    const { allBuiltin, invalidate } = await import("../../src/runtime/integrations/plugin/claude/loader")
    invalidate()
    const plugins = await allBuiltin(true)
    expect(plugins.length).toBe(13)
  })

  test("allBuiltin() total commands is 68, total skills is 70", async () => {
    const { allBuiltin } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugins = await allBuiltin()
    const cmds = plugins.reduce((n, p) => n + p.commands.length, 0)
    const skills = plugins.reduce((n, p) => n + p.skills.length, 0)
    expect(cmds).toBe(68)
    expect(skills).toBe(70)
  })

  test("allBuiltin() skills include all CC domain skill names", async () => {
    const { allBuiltin } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugins = await allBuiltin()
    const names = new Set(plugins.flatMap((p) => p.skills.map((s) => s.name)))
    // legal
    expect(names.has("contract-review")).toBe(true)
    expect(names.has("nda-triage")).toBe(true)
    // engineering
    expect(names.has("code-review")).toBe(true)
    expect(names.has("incident-response")).toBe(true)
    // data
    expect(names.has("sql-queries")).toBe(true)
    expect(names.has("data-visualization")).toBe(true)
    // enterprise-search
    expect(names.has("knowledge-synthesis")).toBe(true)
  })

  test("allBuiltin() commands include CC domain slash commands", async () => {
    const { allBuiltin } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugins = await allBuiltin()
    const names = new Set(plugins.flatMap((p) => p.commands.map((c) => c.name)))
    expect(names.has("review-contract")).toBe(true)   // legal
    expect(names.has("incident")).toBe(true)           // engineering
    expect(names.has("write-query")).toBe(true)        // data
    expect(names.has("review-pr")).toBe(false)         // NOT from builtin (that's a user plugin)
  })

  test("each builtin plugin has a valid manifest with Anthropic author", async () => {
    const { allBuiltin } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugins = await allBuiltin()
    for (const p of plugins) {
      expect(p.manifest.name).toBeTruthy()
      expect((p.manifest.author as any)?.name).toBe("Anthropic")
    }
  })

  test("each builtin plugin has .mcp.json loaded", async () => {
    const { allBuiltin } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugins = await allBuiltin()
    for (const p of plugins) {
      expect(Object.keys(p.mcpServers).length).toBeGreaterThan(0)
    }
  })
})
