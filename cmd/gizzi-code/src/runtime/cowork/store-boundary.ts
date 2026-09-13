/**
 * A:// store consolidation boundary (P-T1) for gizzi-code's Cowork store.
 *
 * The Cowork runtime persists runs/jobs/events in local Drizzle tables
 * (`cowork.sql.ts`). Under the A:// consolidation boundary that local store
 * is a **legacy projection** whenever gizzi is paired with a canonical
 * Allternit API: canonical run/job/event state lives in the
 * `allternit-cowork-runtime` SQLite store served by allternit-api's
 * fabric-transport API (`/api/v1/fabric/transport/*`), and the local tables
 * must not accept writes that would fork that state.
 *
 * Modes (resolved once, in order):
 *   1. `GIZZI_COWORK_STORE=canonical|legacy` — explicit operator choice.
 *   2. `ALLTERNIT_COWORK_CANONICAL=1` → `canonical`.
 *   3. Default → `legacy` (standalone gizzi: the local store IS the only
 *      store, so it remains canonical for that deployment). Legacy mode logs
 *      a one-time deprecation warning naming this boundary.
 *
 * In `canonical` mode every Cowork store write is gated off with a clear
 * error naming the fabric-transport endpoints to use instead; reads still
 * served from the local projection are explicitly marked legacy.
 */

export type CoworkStoreMode = "canonical" | "legacy"

export class CoworkStoreBoundaryError extends Error {
  readonly entity: string
  readonly mode: CoworkStoreMode
  constructor(entity: string) {
    super(
      `cowork store boundary: refusing local ${entity} write — gizzi is paired with a ` +
        `canonical Allternit API (ALLTERNIT_COWORK_CANONICAL=1 or GIZZI_COWORK_STORE=canonical). ` +
        `Submit work through the fabric transport instead: POST /api/v1/fabric/transport/intents ` +
        `(canonical run/job/event state), or set GIZZI_COWORK_STORE=legacy explicitly to keep ` +
        `local-only operation (standalone deployments).`,
    )
    this.name = "CoworkStoreBoundaryError"
    this.entity = entity
    this.mode = "canonical"
  }
}

let resolvedMode: CoworkStoreMode | undefined
let warnedLegacy = false

export function resolveCoworkStoreMode(env: NodeJS.ProcessEnv = process.env): CoworkStoreMode {
  if (resolvedMode) return resolvedMode
  const explicit = env.GIZZI_COWORK_STORE
  if (explicit === "canonical" || explicit === "legacy") {
    resolvedMode = explicit
  } else if (env.ALLTERNIT_COWORK_CANONICAL === "1") {
    resolvedMode = "canonical"
  } else {
    resolvedMode = "legacy"
  }
  return resolvedMode
}

/** Test seam: reset the cached mode/warning state. */
export function resetCoworkStoreBoundaryForTests(): void {
  resolvedMode = undefined
  warnedLegacy = false
}

/**
 * Gate a Cowork store write. Throws `CoworkStoreBoundaryError` in canonical
 * mode; in legacy mode logs a one-time deprecation warning and allows.
 */
export function assertCoworkWriteAllowed(entity: string, env: NodeJS.ProcessEnv = process.env): void {
  const mode = resolveCoworkStoreMode(env)
  if (mode === "canonical") {
    throw new CoworkStoreBoundaryError(entity)
  }
  if (!warnedLegacy) {
    warnedLegacy = true
    // Lazy import keeps this module loadable in non-gizzi tooling.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Log } = require("@/shared/util/log") as typeof import("@/shared/util/log")
    Log.create({ service: "cowork-store-boundary" }).warn(
      "local Cowork store writes are the legacy projection under the A:// consolidation boundary " +
        "(P-T1); canonical run/job/event state lives in the fabric-transport store. " +
        "Set GIZZI_COWORK_STORE=canonical when paired with an Allternit API to enforce.",
    )
  }
}

/** True when the local store may serve reads as a legacy projection. */
export function isLegacyProjectionMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveCoworkStoreMode(env) === "legacy"
}
