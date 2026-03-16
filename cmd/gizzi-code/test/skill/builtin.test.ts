/**
 * Tests for built-in knowledge-work plugin packs (Anthropic & Partners).
 *
 * Validates that the actual CC marketplace plugin files are present on disk
 * and that the registry metadata correctly references them.
 */
import { test, expect, describe } from "bun:test"
import { BUILTIN_SKILL_PACKS } from "../../src/runtime/skills/builtin"
import path from "path"
import { existsSync } from "fs"

const BUILTIN_DIR = path.join(import.meta.dir, "../../src/runtime/plugins/builtin")

describe("builtin plugin directory", () => {
  test("builtin plugins directory exists", () => {
    expect(existsSync(BUILTIN_DIR)).toBe(true)
  })

  test("has 13 domain plugin directories", () => {
    const { readdirSync, statSync } = require("fs")
    const dirs = readdirSync(BUILTIN_DIR).filter((e: string) =>
      statSync(path.join(BUILTIN_DIR, e)).isDirectory(),
    )
    expect(dirs.length).toBe(13)
  })

  test("every domain has .claude-plugin/plugin.json", () => {
    const { readdirSync, statSync } = require("fs")
    const dirs = readdirSync(BUILTIN_DIR).filter((e: string) =>
      statSync(path.join(BUILTIN_DIR, e)).isDirectory(),
    )
    for (const dir of dirs) {
      const manifest = path.join(BUILTIN_DIR, dir, ".claude-plugin", "plugin.json")
      expect(existsSync(manifest)).toBe(true)
    }
  })

  test("every domain has a commands/ and skills/ directory", () => {
    const { readdirSync, statSync } = require("fs")
    const dirs = readdirSync(BUILTIN_DIR).filter((e: string) =>
      statSync(path.join(BUILTIN_DIR, e)).isDirectory(),
    )
    for (const dir of dirs) {
      expect(existsSync(path.join(BUILTIN_DIR, dir, "commands"))).toBe(true)
      expect(existsSync(path.join(BUILTIN_DIR, dir, "skills"))).toBe(true)
    }
  })

  test("total SKILL.md files across all builtin plugins is 70", () => {
    const { readdirSync, statSync } = require("fs")
    function countSkills(dir: string): number {
      let count = 0
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) count += countSkills(full)
        else if (entry === "SKILL.md") count++
      }
      return count
    }
    expect(countSkills(BUILTIN_DIR)).toBe(70)
  })

  test("total command .md files across all builtin plugins is 68", () => {
    const { readdirSync, statSync } = require("fs")
    function countCommands(dir: string): number {
      let count = 0
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) count += countCommands(full)
        else if (entry.endsWith(".md") && dir.endsWith("commands")) count++
      }
      return count
    }
    expect(countCommands(BUILTIN_DIR)).toBe(68)
  })

  test("every domain has a .mcp.json", () => {
    const { readdirSync, statSync } = require("fs")
    const dirs = readdirSync(BUILTIN_DIR).filter((e: string) =>
      statSync(path.join(BUILTIN_DIR, e)).isDirectory(),
    )
    for (const dir of dirs) {
      expect(existsSync(path.join(BUILTIN_DIR, dir, ".mcp.json"))).toBe(true)
    }
  })
})

describe("BUILTIN_SKILL_PACKS metadata", () => {
  test("has 13 domain packs", () => {
    expect(BUILTIN_SKILL_PACKS.length).toBe(13)
  })

  test("pack IDs cover all expected domains", () => {
    const ids = BUILTIN_SKILL_PACKS.map((p) => p.id)
    expect(ids).toContain("@gizzi/skills-legal")
    expect(ids).toContain("@gizzi/skills-engineering")
    expect(ids).toContain("@gizzi/skills-design")
    expect(ids).toContain("@gizzi/skills-finance")
    expect(ids).toContain("@gizzi/skills-hr")
    expect(ids).toContain("@gizzi/skills-marketing")
    expect(ids).toContain("@gizzi/skills-operations")
    expect(ids).toContain("@gizzi/skills-product")
    expect(ids).toContain("@gizzi/skills-productivity")
    expect(ids).toContain("@gizzi/skills-sales")
    expect(ids).toContain("@gizzi/skills-cx")
    expect(ids).toContain("@gizzi/skills-data")
    expect(ids).toContain("@gizzi/skills-enterprise-search")
  })

  test("every pack references SKILL.md files that exist on disk in builtin plugins", () => {
    for (const pack of BUILTIN_SKILL_PACKS) {
      for (const skill of pack.skills) {
        const skillPath = path.join(BUILTIN_DIR, pack.domain, "skills", skill, "SKILL.md")
        expect(existsSync(skillPath)).toBe(true)
      }
    }
  })

  test("legal pack contains all 6 CC skills", () => {
    const legal = BUILTIN_SKILL_PACKS.find((p) => p.id === "@gizzi/skills-legal")!
    expect(legal.skills).toContain("canned-responses")
    expect(legal.skills).toContain("compliance")
    expect(legal.skills).toContain("contract-review")
    expect(legal.skills).toContain("legal-risk-assessment")
    expect(legal.skills).toContain("meeting-briefing")
    expect(legal.skills).toContain("nda-triage")
  })

  test("engineering pack contains all 6 CC skills", () => {
    const eng = BUILTIN_SKILL_PACKS.find((p) => p.id === "@gizzi/skills-engineering")!
    expect(eng.skills).toContain("code-review")
    expect(eng.skills).toContain("documentation")
    expect(eng.skills).toContain("incident-response")
    expect(eng.skills).toContain("system-design")
    expect(eng.skills).toContain("tech-debt")
    expect(eng.skills).toContain("testing-strategy")
  })
})

describe("loadPlugin() on builtin plugins", () => {
  test("loads legal plugin with commands, skills, and mcp", async () => {
    const { loadPlugin } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugin = await loadPlugin(path.join(BUILTIN_DIR, "legal"))
    expect(plugin).not.toBeNull()
    expect(plugin!.manifest.name).toBe("legal")
    expect(plugin!.manifest.author).toMatchObject({ name: "Anthropic" })
    expect(plugin!.commands.length).toBe(7)
    expect(plugin!.skills.length).toBe(6)
    expect(Object.keys(plugin!.mcpServers).length).toBeGreaterThan(0)
  })

  test("loads engineering plugin with commands and skills", async () => {
    const { loadPlugin } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugin = await loadPlugin(path.join(BUILTIN_DIR, "engineering"))
    expect(plugin!.manifest.name).toBe("engineering")
    expect(plugin!.commands.length).toBe(6)
    expect(plugin!.skills.length).toBe(6)
  })

  test("allBuiltin() returns all 13 domain plugins", async () => {
    const { allBuiltin, invalidate } = await import("../../src/runtime/integrations/plugin/claude/loader")
    invalidate()
    const plugins = await allBuiltin(true)
    expect(plugins.length).toBe(13)
    const names = plugins.map((p) => p.manifest.name).sort()
    expect(names).toContain("legal")
    expect(names).toContain("engineering")
    expect(names).toContain("data")
    expect(names).toContain("enterprise-search")
  })

  test("allBuiltin() total commands is 68", async () => {
    const { allBuiltin } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugins = await allBuiltin()
    const total = plugins.reduce((sum, p) => sum + p.commands.length, 0)
    expect(total).toBe(68)
  })

  test("allBuiltin() total skills is 70", async () => {
    const { allBuiltin } = await import("../../src/runtime/integrations/plugin/claude/loader")
    const plugins = await allBuiltin()
    const total = plugins.reduce((sum, p) => sum + p.skills.length, 0)
    expect(total).toBe(70)
  })

  test("registry skill pack entries have correct author and builtin flag", () => {
    const { PluginRegistry } = require("../../src/runtime/integrations/plugin/registry")
    const packs = PluginRegistry.curated().filter((e: any) => e.type === "skillpack")
    expect(packs.length).toBe(13)
    for (const pack of packs) {
      expect(pack.builtin).toBe(true)
      expect(pack.author).toBe("Anthropic & Partners")
      expect(Array.isArray(pack.skills)).toBe(true)
      expect(pack.skills.length).toBeGreaterThan(0)
      expect(pack.verified).toBe(true)
    }
  })

  test("registry connector entries have oauthProvider and count >= 8", () => {
    const { PluginRegistry } = require("../../src/runtime/integrations/plugin/registry")
    const connectors = PluginRegistry.curated().filter((e: any) => e.type === "connector")
    expect(connectors.length).toBeGreaterThanOrEqual(8)
    for (const c of connectors) {
      expect(c.oauthProvider).toBeTruthy()
    }
  })
})
