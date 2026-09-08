/**
 * Capability epoch (Bot Mode, D5 — see docs/GIZZI_BOT_MODE_SPEC.md).
 *
 * The epoch is a cheap content hash over everything that shapes what a bot
 * can do and who it works with: identity metadata, SOUL.md, the memory note
 * list, and the sorted teammate roster. When any of it drifts, the epoch
 * changes and the canonical chat's persona injection is rebuilt exactly once,
 * then re-stamped via `setCapabilityEpoch`.
 *
 * Pure functions only (fs reads happen in canonical-chat.ts) so bun tests can
 * drive this without a store or a database.
 */

/** FNV-1a 32-bit, rendered as 8 hex chars. Small, dependency-free, stable. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // hash *= 16777619 (FNV prime) via shifts to stay in 32-bit uint space.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

export interface CapabilityEpochInput {
  /** Bot name (slug), title, description, and model pin — the identity block. */
  name: string
  title: string
  description: string
  model: string | null
  /** SOUL.md content (null when the file is absent). */
  soul: string | null
  /** Memory note file names (contents hashed separately from the list). */
  memoryFiles: string[]
  /** Teammate roster — bot names from listBots(); sorted inside. */
  rosterNames: string[]
}

/**
 * Compute the capability epoch for one bot. Component order is fixed and
 * NUL-delimited so distinct component lists cannot collide by concatenation
 * (e.g. ["ab","c"] vs ["a","bc"]).
 */
export function computeCapabilityEpoch(input: CapabilityEpochInput): string {
  const components = [
    input.name,
    input.title,
    input.description,
    input.model ?? "",
    input.soul === null ? "" : fnv1a(input.soul),
    [...input.memoryFiles].sort().join(","),
    [...input.rosterNames].sort().join(","),
  ]
  return fnv1a(components.join(""))
}
