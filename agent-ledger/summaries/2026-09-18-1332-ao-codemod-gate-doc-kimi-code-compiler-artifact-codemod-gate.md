# Session summary: ao/codemod-gate-doc (compiler-artifact codemod gate)

- **Date:** 2026-09-18 1332
- **Agent:** kimi-code
- **Branch:** `ao/codemod-gate-doc` → PR **#611**, merge SHA **1c841f0f35efb7d1000f5c28d1bb3c7f0fff768c**
- **Base:** origin/main @ 0f324019e (fetched fresh; concurrent burn-b0008 / dormant-stub-decisions merges landed during the session, no file overlap)

## What was done

Step 1 (gate commit) of the ink-app React Compiler artifact de-compile codemod: documentation + tooling conventions only. Zero `.tsx` conversions — those land in 8–12 per-subtree follow-up PRs.

Decision recorded (owner-approved 2026-09-18): **ADOPT-AS-SOURCE**. The ~360 `.tsx` files under `cmd/gizzi-code/src/cli/ui/ink-app/` are React Compiler build output committed as canonical source since the repo's root commit. Provenance re-verified in this session: `git show 2bda61382:cmd/gizzi-code/src/cli/ui/ink-app/components/Spinner.tsx` line 2 carries `import { c as _c } from "react/compiler-runtime"`. No pre-compiler source exists anywhere (Anthropic-internal upstream, unrecoverable).

Changes (3 files, +211):

1. `docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md` (new, 190 lines) — the definitive reference: fingerprint (`react/compiler-runtime` import / `$[n]` slots) + detection grep; verified scale (360 files: 348 outside vendored subtrees, 12 under vendored `ink/`, 0 under `vim/`); stub machinery inventory with exact file:line (cmd/gizzi-code/tsconfig.json:139, cmd/gizzi-code/tsconfig.base.json:45, ink-app/tsconfig.json:63, src/vendor/react-compiler-runtime.ts, script/build-production.js:105-127 + 342-350, src/types/react.d.ts:12); React 19.2 sentinel-mismatch incompatibility warning (`react.compiler_cache_miss` vs `react.memo_cache_sentinel` — never let the real runtime load); codemod plan (inline `$[k]` as consts at first use preserving evaluation order, drop `_c`, rename `t0` → Props destructuring where a Props type exists, keep `_tempN` helpers, strip nocheck headers where files typecheck clean / keep TODO(types) otherwise; final PR deletes stub machinery after the detection grep returns zero); burn-down interaction (artifacts queue-excluded via `COMPILER_ARTIFACT_FINGERPRINTS` at build-queue.mjs:60-64; conversion PRs must regenerate queue.json + ts-nocheck baseline in the SAME PR); risk register (hook-order shifts around early returns, FuzzyPicker-style hand patches preserved because the codemod operates on current text, sentinel leak, burn-batch collisions).
2. `eslint.config.js` — ignore the artifact set computed at config load by scanning the ink-app subtree for the same fingerprint. Evidence the edit was needed: before the change, root eslint linted the artifacts and reported problems on them (`eslint .../components/Spinner.tsx` → 2 errors + 5 warnings, exit 1). Root eslint is not wired into any workspace `lint` script or CI workflow (verified: no `.github/workflows/*.yml` references eslint; no workspace package lint script runs root eslint). Burn-down is tsc-based and untouched.
3. `cmd/gizzi-code/src/vendor/react-compiler-runtime.ts` — one-line pointer comment to the new doc at the top of the stub.

Untouched per instructions: `build-production.js`, tsconfigs, `queue.json`, `scripts/release-preflight.mjs` (run only), all `.tsx`, release-desktop.yml, surfaces/allternit-desktop/, services/voice/, services/local-engine/.

## Verification evidence

- `node scripts/release-preflight.mjs` → **52 passed, 0 failed** (worktree, run via symlinked shared node_modules — symlink removed after verification, no installs)
- `eslint --version` → v10.10.0 (config loads)
- `eslint cmd/gizzi-code/src/cli/ui/ink-app/components/Spinner.tsx` → "File ignored because of a matching ignore pattern" (was 2 errors + 5 warnings before)
- `eslint cmd/gizzi-code/src/cli/ui/ink-app/app.tsx` (non-artifact) → identical `@typescript-eslint/ban-ts-comment` error as before the change — non-artifact behavior unchanged
- Markdown sanity: 4 code fences balanced, headings intact

## Incidents / honest deferrals

- None. No escalations.
- Desktop rebuild (lifecycle step 8): N/A — docs + root eslint config only; nothing the desktop bundles changed (eslint.config.js is not part of the gizzi-code production bundle; the vendor stub change is a comment).
- Follow-up work: 8–12 per-subtree codemod PRs per the doc's §6, then the final stub-machinery deletion PR.

## Final state

- Shared checkout synced: main @ 1c841f0f3 (fast-forward over 0f9cceeaf)
- Session worktree `allternit-ao-codemodgate` removed, branch `ao/codemod-gate-doc` deleted local + remote
- `scripts/git-discipline-check.sh` PASS (verbatim below)
