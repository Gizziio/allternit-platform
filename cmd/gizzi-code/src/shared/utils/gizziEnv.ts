/**
 * GIZZI_ / CLAUDE_CODE_ dual-name environment access.
 *
 * The CLI is a fork of an upstream product whose documented configuration
 * surface uses `CLAUDE_CODE_*` environment variables. The fork owns the
 * `GIZZI_*` namespace. Rather than a one-shot rename (which breaks users and
 * child processes that follow upstream docs), vars the CLI itself sets are
 * dual-named:
 *
 * - WRITES go through {@link setGizziEnv}, which sets both `GIZZI_<name>`
 *   and `CLAUDE_CODE_<name>` so nested/legacy children still see the value.
 * - READS go through {@link readGizziEnv}, which prefers `GIZZI_<name>` and
 *   falls back to `CLAUDE_CODE_<name>` — existing user habits and CI setups
 *   keep working.
 *
 * Vars the CLI only reads (never sets) still reference `CLAUDE_CODE_*`
 * directly where they are part of the upstream/SDK contract; see
 * docs/UPSTREAM_COMPAT.md for the full triage list.
 *
 * @module gizziEnv
 */

/**
 * Read a dual-named env var: `GIZZI_<name>` wins, `CLAUDE_CODE_<name>` is
 * the legacy fallback. Whitespace-only values count as unset.
 */
export function readGizziEnv(name: string): string | undefined {
  const gizzi = process.env[`GIZZI_${name}`]?.trim()
  if (gizzi) return gizzi
  const legacy = process.env[`CLAUDE_CODE_${name}`]?.trim()
  if (legacy) return legacy
  return undefined
}

/** True when either the GIZZI_ or the legacy CLAUDE_CODE_ form is set (to any value). */
export function hasGizziEnv(name: string): boolean {
  return (
    process.env[`GIZZI_${name}`] !== undefined ||
    process.env[`CLAUDE_CODE_${name}`] !== undefined
  )
}

/**
 * Set both the GIZZI_ and legacy CLAUDE_CODE_ forms. Used for runtime
 * markers and session context that child processes (nested gizzi sessions,
 * SDK consumers following upstream docs) expect under the upstream name.
 */
export function setGizziEnv(name: string, value: string): void {
  process.env[`GIZZI_${name}`] = value
  process.env[`CLAUDE_CODE_${name}`] = value
}
