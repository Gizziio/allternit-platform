/**
 * Resolve the xlsx sidecar binary path.
 *
 * Order:
 *  1. `ALLTERNIT_XLSX_SIDECAR_BINARY` env override.
 *  2. `<crate>/target/release/allternit-xlsx-sidecar` (standalone crate build).
 *  3. `<repo root>/target/release/allternit-xlsx-sidecar` — the monorepo's
 *     root Cargo workspace absorbs the crate build when cargo is invoked
 *     from the repo root, which is how CI builds it today.
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BINARY_NAME =
  process.platform === 'win32' ? 'allternit-xlsx-sidecar.exe' : 'allternit-xlsx-sidecar'

export function resolveSidecarBinary(env: NodeJS.ProcessEnv = process.env): string | null {
  const override = env.ALLTERNIT_XLSX_SIDECAR_BINARY
  if (override && existsSync(override)) return override

  const here = dirname(fileURLToPath(import.meta.url))
  // Works from both src/ (dev, tsx) and dist/ (built): the package root is
  // one level up from either.
  const packageRoot = resolve(here, '..')

  const candidates = [
    join(packageRoot, 'crate', 'target', 'release', BINARY_NAME),
    // packages/@allternit/office-xlsx-engine → repo root is three levels up.
    resolve(packageRoot, '..', '..', '..', 'target', 'release', BINARY_NAME),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}
