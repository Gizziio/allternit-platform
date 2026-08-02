import { describe, expect, test } from "bun:test"
import { resolveSessionWorktreeEnabled } from "../../src/cli/ui/ink-app/threadWorktree"

// W2b / R3: the live session path (thread.ts TuiThreadCommand) resolves
// worktree creation through the W2 resolver with the parsed CLI flag value.
// yargs boolean negation collapses --worktree / --no-worktree into a single
// boolean|undefined `worktree` arg, which resolveSessionWorktreeEnabled maps
// onto resolveWorktreeEnabled's (cliWorktree, cliNoWorktree) pair.
describe("resolveSessionWorktreeEnabled (live thread.ts path)", () => {
  test("--worktree enables creation when autoCreate is unset", () => {
    expect(resolveSessionWorktreeEnabled(true, undefined)).toBe(true)
  })

  test("--worktree enables creation when autoCreate is false", () => {
    expect(resolveSessionWorktreeEnabled(true, false)).toBe(true)
  })

  test("--no-worktree disables creation even when autoCreate is true", () => {
    expect(resolveSessionWorktreeEnabled(false, true)).toBe(false)
  })

  test("autoCreate = true takes effect when no flag is passed", () => {
    expect(resolveSessionWorktreeEnabled(undefined, true)).toBe(true)
  })

  test("autoCreate = false stays disabled when no flag is passed", () => {
    expect(resolveSessionWorktreeEnabled(undefined, false)).toBe(false)
  })

  test("flag and setting both absent defaults to disabled", () => {
    expect(resolveSessionWorktreeEnabled(undefined, undefined)).toBe(false)
  })
})
