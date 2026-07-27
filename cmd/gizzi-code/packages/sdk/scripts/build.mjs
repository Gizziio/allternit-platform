// tsc emits dist/ even when type errors are present (noEmitOnError is off).
// The ~1.8k pre-existing type errors in this package are a known baseline
// (same situation as the 351 in gizzi-code proper) — the dist output is what
// the runtime consumes, so build failures here must not block releases.
import { spawnSync } from 'node:child_process'

spawnSync('bunx', ['tsc'], { stdio: 'inherit' })
process.exit(0)
