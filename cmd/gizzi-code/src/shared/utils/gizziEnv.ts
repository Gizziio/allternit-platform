/**
 * GIZZI_ environment access.
 *
 * The CLI owns the `GIZZI_*` namespace exclusively. Upstream-style
 * `CLAUDE_CODE_*` names were purged from the product (hard rename, no legacy
 * fallback): reads and writes here touch only the `GIZZI_<name>` form, and
 * env-var-name registries across the app use `GIZZI_*` strings.
 *
 * Every remaining upstream identifier in the tree is listed with its reason
 * in `docs/anthropic-allowlist.md` (functional/protocol references only).
 *
 * @module gizziEnv
 */

/**
 * Read a GIZZI_ env var. Whitespace-only values count as unset.
 */
export function readGizziEnv(name: string): string | undefined {
  const gizzi = process.env[`GIZZI_${name}`]?.trim()
  if (gizzi) return gizzi
  return undefined
}

/** True when the GIZZI_ form is set (to any value). */
export function hasGizziEnv(name: string): boolean {
  return process.env[`GIZZI_${name}`] !== undefined
}

/**
 * Set the GIZZI_ form. Used for runtime markers and session context for
 * child processes (nested gizzi sessions, SDK consumers).
 */
export function setGizziEnv(name: string, value: string): void {
  process.env[`GIZZI_${name}`] = value
}
