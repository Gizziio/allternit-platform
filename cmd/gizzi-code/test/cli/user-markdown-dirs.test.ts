import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { homedir } from "os"
import path from "path"
import { getUserMarkdownDirs } from "../../src/cli/ui/ink-app/utils/markdownUserDirs"

let savedGizzi: string | undefined
let savedClaude: string | undefined

beforeEach(() => {
  savedGizzi = process.env.GIZZI_CONFIG_DIR
  savedClaude = process.env.CLAUDE_CONFIG_DIR
})

afterEach(() => {
  if (savedGizzi === undefined) delete process.env.GIZZI_CONFIG_DIR
  else process.env.GIZZI_CONFIG_DIR = savedGizzi
  if (savedClaude === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = savedClaude
})

describe("getUserMarkdownDirs", () => {
  test("gizzi home first, legacy claude home merged after", () => {
    process.env.GIZZI_CONFIG_DIR = "/tmp/u-gizzi"
    process.env.CLAUDE_CONFIG_DIR = "/tmp/u-claude"
    expect(getUserMarkdownDirs("commands")).toEqual([
      path.join("/tmp/u-gizzi", "commands"),
      path.join("/tmp/u-claude", "commands"),
    ])
  })

  test("defaults to ~/.claude/<subdir> as the legacy fallback", () => {
    process.env.GIZZI_CONFIG_DIR = "/tmp/u-gizzi"
    delete process.env.CLAUDE_CONFIG_DIR
    expect(getUserMarkdownDirs("commands")).toEqual([
      path.join("/tmp/u-gizzi", "commands"),
      path.join(homedir(), ".claude", "commands"),
    ])
  })

  test("both-exist case keeps both entries (merge, gizzi first) — directories of independently-named items", () => {
    process.env.GIZZI_CONFIG_DIR = "/tmp/u-gizzi"
    process.env.CLAUDE_CONFIG_DIR = "/tmp/u-claude"
    const dirs = getUserMarkdownDirs("skills")
    expect(dirs).toHaveLength(2)
    expect(dirs[0]).toContain("u-gizzi")
  })

  test("identical homes collapse to a single dir", () => {
    process.env.GIZZI_CONFIG_DIR = "/tmp/same"
    process.env.CLAUDE_CONFIG_DIR = "/tmp/same"
    expect(getUserMarkdownDirs("commands")).toEqual([path.join("/tmp/same", "commands")])
  })

  test("subdir is appended per scope", () => {
    process.env.GIZZI_CONFIG_DIR = "/tmp/u-gizzi"
    process.env.CLAUDE_CONFIG_DIR = "/tmp/u-claude"
    expect(getUserMarkdownDirs("agents")).toEqual([
      path.join("/tmp/u-gizzi", "agents"),
      path.join("/tmp/u-claude", "agents"),
    ])
  })
})
