import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import path from "path"
import fs from "fs/promises"
import os from "os"

/**
 * Plugin directory unification tests.
 *
 * Canonical location is $GIZZI_CONFIG_DIR/plugins (~/.gizzi/plugins); the
 * upstream-inherited $CLAUDE_CONFIG_DIR/plugins (~/.claude/plugins) is a
 * read-only legacy fallback. Env vars point both config homes at tmp dirs.
 */

async function makeTmp(): Promise<string> {
  const dir = path.join(os.tmpdir(), "plugin-dirs-" + Math.random().toString(36).slice(2))
  await fs.mkdir(dir, { recursive: true })
  return dir
}

let tmp: string
let prevGizziConfigDir: string | undefined
let prevClaudeConfigDir: string | undefined
let prevPluginCacheDir: string | undefined

beforeEach(async () => {
  tmp = await makeTmp()
  prevGizziConfigDir = process.env.GIZZI_CONFIG_DIR
  prevClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
  prevPluginCacheDir = process.env.GIZZI_PLUGIN_CACHE_DIR
  delete process.env.GIZZI_PLUGIN_CACHE_DIR
  process.env.GIZZI_CONFIG_DIR = path.join(tmp, "gizzi-home")
  process.env.CLAUDE_CONFIG_DIR = path.join(tmp, "claude-home")
})

afterEach(async () => {
  if (prevGizziConfigDir !== undefined) process.env.GIZZI_CONFIG_DIR = prevGizziConfigDir
  else delete process.env.GIZZI_CONFIG_DIR
  if (prevClaudeConfigDir !== undefined) process.env.CLAUDE_CONFIG_DIR = prevClaudeConfigDir
  else delete process.env.CLAUDE_CONFIG_DIR
  if (prevPluginCacheDir !== undefined) process.env.GIZZI_PLUGIN_CACHE_DIR = prevPluginCacheDir
  else delete process.env.GIZZI_PLUGIN_CACHE_DIR
  await fs.rm(tmp, { recursive: true, force: true })
})

const dirs = () => import("../../src/shared/utils/plugins/pluginDirectories")

describe("canonical paths", () => {
  test("getPluginsDirectory resolves under the gizzi config home", async () => {
    const d = await dirs()
    expect(d.getPluginsDirectory()).toBe(path.join(tmp, "gizzi-home", "plugins"))
  })

  test("getLegacyPluginsDirectory resolves under the claude config home", async () => {
    const d = await dirs()
    expect(d.getLegacyPluginsDirectory()).toBe(path.join(tmp, "claude-home", "plugins"))
  })

  test("GIZZI_PLUGIN_CACHE_DIR overrides the canonical location", async () => {
    process.env.GIZZI_PLUGIN_CACHE_DIR = path.join(tmp, "override")
    const d = await dirs()
    expect(d.getPluginsDirectory()).toBe(path.join(tmp, "override"))
  })
})

describe("resolvePluginsStateFile", () => {
  test("prefers canonical when both exist", async () => {
    const d = await dirs()
    await fs.mkdir(path.join(tmp, "gizzi-home", "plugins"), { recursive: true })
    await fs.mkdir(path.join(tmp, "claude-home", "plugins"), { recursive: true })
    await fs.writeFile(path.join(tmp, "gizzi-home", "plugins", "known_marketplaces.json"), "{}")
    await fs.writeFile(path.join(tmp, "claude-home", "plugins", "known_marketplaces.json"), "{}")
    expect(d.resolvePluginsStateFile("known_marketplaces.json")).toBe(
      path.join(tmp, "gizzi-home", "plugins", "known_marketplaces.json"),
    )
  })

  test("falls back to legacy when canonical is absent", async () => {
    const d = await dirs()
    await fs.mkdir(path.join(tmp, "claude-home", "plugins"), { recursive: true })
    await fs.writeFile(path.join(tmp, "claude-home", "plugins", "known_marketplaces.json"), "{}")
    expect(d.resolvePluginsStateFile("known_marketplaces.json")).toBe(
      path.join(tmp, "claude-home", "plugins", "known_marketplaces.json"),
    )
  })

  test("returns canonical path when neither exists (writes land canonical)", async () => {
    const d = await dirs()
    expect(d.resolvePluginsStateFile("known_marketplaces.json")).toBe(
      path.join(tmp, "gizzi-home", "plugins", "known_marketplaces.json"),
    )
  })
})

describe("getPluginDirsState", () => {
  test("reports neither dir existing", async () => {
    const d = await dirs()
    const state = d.getPluginDirsState()
    expect(state.canonicalExists).toBe(false)
    expect(state.legacyExists).toBe(false)
    expect(state.legacyHasState).toBe(false)
    expect(state.canonicalHasState).toBe(false)
  })

  test("reports legacy non-empty vs empty", async () => {
    const d = await dirs()
    // Empty legacy dir
    await fs.mkdir(path.join(tmp, "claude-home", "plugins"), { recursive: true })
    let state = d.getPluginDirsState()
    expect(state.legacyExists).toBe(true)
    expect(state.legacyHasState).toBe(false)

    // Legacy with state
    await fs.writeFile(path.join(tmp, "claude-home", "plugins", "installed_plugins.json"), "{}")
    state = d.getPluginDirsState()
    expect(state.legacyHasState).toBe(true)
  })
})

describe("migrateLegacyPluginsDir", () => {
  test("copies legacy state to canonical and leaves legacy intact", async () => {
    const d = await dirs()
    const legacy = path.join(tmp, "claude-home", "plugins")
    await fs.mkdir(path.join(legacy, "cache", "mkt", "plug", "1.0.0"), { recursive: true })
    await fs.writeFile(path.join(legacy, "known_marketplaces.json"), '{"mkt":{}}')
    await fs.writeFile(path.join(legacy, "installed_plugins.json"), '{"version":2,"plugins":{}}')

    const { copied } = await d.migrateLegacyPluginsDir()
    expect(copied).toContain("known_marketplaces.json")
    expect(copied).toContain("installed_plugins.json")
    expect(copied).toContain("cache")

    // Canonical now has the content
    const canonical = path.join(tmp, "gizzi-home", "plugins")
    const km = JSON.parse(await fs.readFile(path.join(canonical, "known_marketplaces.json"), "utf8"))
    expect(km).toEqual({ mkt: {} })
    await fs.access(path.join(canonical, "cache", "mkt", "plug", "1.0.0"))

    // Legacy untouched (copy, not move)
    await fs.access(path.join(legacy, "known_marketplaces.json"))

    // State reflects migration
    const state = d.getPluginDirsState()
    expect(state.canonicalHasState).toBe(true)
    expect(state.legacyHasState).toBe(true)
  })

  test("second run skips entries already present in canonical", async () => {
    const d = await dirs()
    const legacy = path.join(tmp, "claude-home", "plugins")
    await fs.mkdir(legacy, { recursive: true })
    await fs.writeFile(path.join(legacy, "known_marketplaces.json"), "{}")

    await d.migrateLegacyPluginsDir()
    // Mutate legacy; canonical copy must win on the second run.
    await fs.writeFile(path.join(legacy, "known_marketplaces.json"), '{"legacy":true}')
    const { copied, skipped } = await d.migrateLegacyPluginsDir()
    expect(copied).toEqual([])
    expect(skipped).toContain("known_marketplaces.json")
    const canonical = await fs.readFile(path.join(tmp, "gizzi-home", "plugins", "known_marketplaces.json"), "utf8")
    expect(JSON.parse(canonical)).toEqual({})
  })

  test("no-op when legacy dir is absent", async () => {
    const d = await dirs()
    const { copied } = await d.migrateLegacyPluginsDir()
    expect(copied).toEqual([])
  })
})
