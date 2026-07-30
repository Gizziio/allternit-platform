/**
 * Shared precedence rules for resolving which project-instructions file
 * "wins" at a given directory level, across both the interactive TUI
 * pipeline (claudemd.ts) and the headless/server session pipeline
 * (session/instruction.ts). GIZZI.md is canonical; CLAUDE.md and AGENTS.md
 * are read for compatibility with repos crossing over from Claude Code or
 * already using the cross-tool AGENTS.md convention.
 */

export const ROOT_INSTRUCTION_FILENAMES = ["GIZZI.md", "CLAUDE.md", "AGENTS.md", "CONTEXT.md"] as const

export const LOCAL_INSTRUCTION_FILENAMES = ["GIZZI.local.md", "CLAUDE.local.md"] as const

export const RULES_DIRNAMES = [".gizzi/rules", ".claude/rules"] as const

/**
 * Companion file read alongside the root marker at every directory level —
 * not a precedence alternative to GIZZI.md, an addition to it. No legacy
 * name to be compatible with; this is a gizzi-only convention.
 */
export const ANTI_PATTERNS_FILENAME = "ANTI_PATTERNS.md"

/**
 * Given the filenames (or dirnames) that exist at one directory level,
 * return the highest-precedence match, or undefined if none exist.
 */
export function pickWinner(
  existingNames: Iterable<string>,
  precedence: readonly string[],
): string | undefined {
  const set = existingNames instanceof Set ? existingNames : new Set(existingNames)
  for (const name of precedence) {
    if (set.has(name)) return name
  }
  return undefined
}
