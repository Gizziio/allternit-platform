import { describe, expect, test } from "bun:test"
import { resolveWorktreeEnabled } from "../../src/shared/utils/worktreeModeEnabled"
import { resolveWorktreeEnabled as resolveWorktreeEnabledInkApp } from "../../src/cli/ui/ink-app/utils/worktreeModeEnabled"
import { SettingsSchema } from "../../src/shared/utils/settings/types"
import { SettingsSchema as SettingsSchemaInkApp } from "../../src/cli/ui/ink-app/utils/settings/types"

// R4 resolution matrix: --worktree > --no-worktree > worktree.autoCreate > false.
// The resolver exists in two manually-duplicated trees (src/shared/utils and
// src/cli/ui/ink-app/utils) — run the full matrix against both so the copies
// cannot silently diverge.
const resolvers = [
  ["shared", resolveWorktreeEnabled],
  ["ink-app", resolveWorktreeEnabledInkApp],
] as const

for (const [tree, resolve] of resolvers) {
  describe(`resolveWorktreeEnabled (${tree})`, () => {
    test("setting on, no CLI flags → enabled", () => {
      expect(resolve(false, false, true)).toBe(true)
    })

    test("setting on + --no-worktree → disabled (explicit flag beats setting)", () => {
      expect(resolve(false, true, true)).toBe(false)
    })

    test("setting off + --worktree → enabled (explicit --worktree beats everything)", () => {
      expect(resolve(true, false, false)).toBe(true)
      expect(resolve(true, false, undefined)).toBe(true)
    })

    test("both absent → disabled (current behavior unchanged)", () => {
      expect(resolve(false, false, undefined)).toBe(false)
      expect(resolve(false, false, false)).toBe(false)
    })

    test("--worktree wins even over --no-worktree and setting off", () => {
      expect(resolve(true, true, false)).toBe(true)
      expect(resolve(true, true, true)).toBe(true)
    })
  })
}

// R3: worktree.autoCreate is an optional boolean defaulting to unset (→ false)
const schemas = [
  ["shared", SettingsSchema],
  ["ink-app", SettingsSchemaInkApp],
] as const

for (const [tree, schema] of schemas) {
  describe(`SettingsSchema worktree.autoCreate (${tree})`, () => {
    test("parses worktree.autoCreate: true", () => {
      const parsed = schema().parse({ worktree: { autoCreate: true } })
      expect(parsed.worktree?.autoCreate).toBe(true)
    })

    test("autoCreate is absent when not set (resolver defaults to false)", () => {
      const parsed = schema().parse({ worktree: { symlinkDirectories: ["node_modules"] } })
      expect(parsed.worktree?.autoCreate).toBeUndefined()
      expect(resolveWorktreeEnabled(false, false, parsed.worktree?.autoCreate)).toBe(false)
    })

    test("settings without a worktree block stay valid", () => {
      const parsed = schema().parse({})
      expect(parsed.worktree).toBeUndefined()
    })
  })
}
