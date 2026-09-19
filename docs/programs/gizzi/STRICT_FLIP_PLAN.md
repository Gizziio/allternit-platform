# gizzi-code strict-mode flip plan

> **STATUS:** Plan — final phase of the TypeScript remediation, after the
> `// @ts-nocheck` burn-down finishes. No code or config changes land from this
> document; it is the sequencing, measurement, and execution contract for the
> phase that follows the burn-down.
>
> **MEASURED:** 2026-09-18 ~21:05–21:21 CDT, on `origin/main` @
> `56085d0db7bd97909117c4166ae25cb9527b2190`, in worktree
> `allternit-ao-strictplan`, TypeScript 5.9.3, `NODE_OPTIONS=--max-old-space-size=8192`,
> after `bash script/ensure-sdk-dist.sh`. Baseline `tsc --noEmit` (current
> config): **0 errors** — the oracle is green today.

## 1. Current state: flag inventory

`cmd/gizzi-code/tsconfig.json` extends `@tsconfig/bun/tsconfig.json`
(`"@tsconfig/bun": "*"` in `cmd/gizzi-code/package.json`). The published base
sets the strict family **on**; the project config turns the two big ones back
**off**:

| Flag | `@tsconfig/bun` base | `cmd/gizzi-code/tsconfig.json` | Effective |
|---|---|---|---|
| `strict` | `true` | **`false`** | **false** |
| `strictNullChecks` (strict member) | true | (via `strict:false`) | **false** |
| `noImplicitAny` (strict member) | true | (via `strict:false`) | **false** |
| `noImplicitThis` (strict member) | true | (via `strict:false`) | **false** |
| `strictBindCallApply` (strict member) | true | (via `strict:false`) | **false** |
| `strictFunctionTypes` (strict member) | true | (via `strict:false`) | **false** |
| `strictPropertyInitialization` (strict member) | true | (via `strict:false`) | **false** |
| `alwaysStrict` (strict member) | true | (via `strict:false`) | **false** |
| `useUnknownInCatchVariables` (strict member) | true | (via `strict:false`) | **false** |
| `noUncheckedIndexedAccess` | true | **`false`** (explicit) | **false** |
| `noFallthroughCasesInSwitch` | true | not overridden | **true** |
| `noImplicitOverride` | true | not overridden | **true** |
| `noUnusedLocals` / `noUnusedParameters` | false | not overridden | false |
| `noPropertyAccessFromIndexSignature` | false | not overridden | false |
| `skipLibCheck` | true | not overridden | true |
| `verbatimModuleSyntax` | true | `false` | false |

Related configs and their effective strictness (verified on current main):

- `cmd/gizzi-code/tsconfig.base.json` extends the same `@tsconfig/bun` base,
  sets `noUncheckedIndexedAccess: false` and `verbatimModuleSyntax: false`,
  and does **not** override `strict` — so `src/runtime/tsconfig.json`,
  `src/others/tsconfig.json`, and `src/cli/tsconfig.json` (which extend the
  base) are **already effectively `strict: true`** for editor/standalone use.
  They do not participate in the root `tsc --noEmit` (`bun run typecheck`
  compiles `tsconfig.json`, whose `include` covers `src/**` flatly; nested
  configs are ignored in that pass), but this means part of the tree already
  authors against strict types.
- `packages/sdk`, `packages/plugin`, `packages/script`, `github/`, and
  `sdks/vscode/` tsconfigs each set `"strict": true` explicitly — the SDK
  packages are already strict-checked standalone.
- `tsconfig.check.json`, `tsconfig.typecheck.json`, `tsconfig.sdk.json`, and
  `src/cli/ui/ink-app/tsconfig.json` extend the root `tsconfig.json` and
  inherit `strict: false`.

## 2. Live measurement (2026-09-18, main @ 56085d0db)

Method: `npx tsc --noEmit --<flag>` from `cmd/gizzi-code` (CLI flags override
the config; no tsconfig was modified). Errors counted as `grep -c 'error TS'`
on tsc's output. The 2026-09-18 morning probe measured ~138 errors under
`--strictNullChecks`; the numbers below are larger because the burn-down has
since stripped `@ts-nocheck` from more files — every burned file is newly
exposed to whatever strict flag is being measured. **These are the numbers to
plan against; re-measure at phase start.**

### Per-flag error counts

| Probe | Errors | Unique files | Top codes |
|---|---|---|---|
| `--strictNullChecks` | **212** | 110 | TS2345 ×66, TS18048 ×58, TS2339 ×50, TS2322 ×22, TS2722 ×8, TS2769 ×2, TS18046 ×2, TS2790/2783/2532/2430 ×1 each |
| `--noImplicitAny` | **293** | 141 | TS7011 ×147, TS7053 ×52, TS7018 ×39, TS7006 ×28, TS7016 ×16, TS7005 ×4, TS7010 ×3, TS2345 ×2, TS7034/7008 ×1 each |
| `--noUncheckedIndexedAccess` | **0** | 0 | — (no-op without `strictNullChecks`; see below) |
| `--strictBindCallApply` | **0** | 0 | — |
| `--strictFunctionTypes` | **2** | 2 | TS2322, TS2345 (`src/cli/ui/ink-app/utils/computerUse/mcpServer.ts`, `src/vault/connectors/sidecar.ts`) |
| `--noImplicitThis` | **0** | 0 | — |
| `--useUnknownInCatchVariables` | **3** | 1 | TS2345 ×3 (`src/runtime/services/analytics/growthbook.ts`) |
| `--alwaysStrict` | **0** | 0 | — |
| `--strictPropertyInitialization` | n/a | — | TS5052: cannot be probed standalone (requires `strictNullChecks`) |
| `--strict` (full) | **221** | 145 | TS18048 ×58, TS7053 ×48, TS2345 ×29, TS2322 ×24, TS7006 ×23, TS7016 ×16, TS2722 ×8, TS2339 ×6, TS18046 ×2, six codes ×1 |

Directory split of the full `--strict` run: **212 in `src/`, 8 in `test/`, 1
in `packages/`**. For `--noImplicitAny`: 266 `src/`, 10 `test/`, 10
`packages/`, 1 `script/`. For `--strictNullChecks`: 209 `src/`, 2 `script/`,
1 `test/`. The strict flip must fix all three trees (the burn-down queue only
accounts for `src/`).

Key readings of the data:

1. **`strictNullChecks` is the whole game for value-nullability.** Full
   `--strict` (221) is barely above `--strictNullChecks` alone (212) — but
   they are not supersets of each other (only 80 of 110 snc-only files also
   appear in the full-strict list; with `noImplicitAny` also on, implicit
   `any`s absorb some nullability errors and produce different, fewer
   downstream errors). Plan against the per-flag counts, not the delta.
2. **`noUncheckedIndexedAccess` is currently free but not really.** It adds
   `undefined` to index-signature reads, which is only enforced once
   `strictNullChecks` is on — so "0 errors today" means "unmeasured", not
   "clean". It must be re-measured *after* snc lands; expect a fresh,
   moderate error population (index reads across the burned tree suddenly
   yielding `T | undefined`). Budget a dedicated phase for it.
3. **`noImplicitAny` is the largest single-flag population (293)** and the
   most mechanical: TS7011 evolving-array `any[]` (147) and TS7018/TS7006
   unannotated params (67) are annotate-in-place fixes; TS7053 (52) is
   `Record<string, …>` index access; TS7016 (16) is untyped imports
   (needs a `@types` package or a local declaration — the one class that can
   escape "type-only" and needs review per occurrence).
4. **Six of the eight strict members cost ≤3 errors today.** The trivial
   tail (`alwaysStrict`, `strictBindCallApply`, `noImplicitThis` = 0;
   `strictFunctionTypes` = 2; `useUnknownInCatchVariables` = 3) plus
   `strictPropertyInitialization` (only probeable once snc is on) fits in one
   PR after the big two land.
5. **File concentration is workable.** snc hotspots: `src/runtime/services/
   oauth/client.ts` (15) + its ink-app twin (13), `src/runtime/integrations/
   plugin/codex.ts` (12), `src/runtime/tools/builtins/grep.ts` (10). Twin
   pairs burn like the burn-down's twin batches — fix runtime, port to
   ink-app.

## 3. Sequencing recommendation

Keep `tsc --noEmit` (current config, the CI oracle) green after every PR.
Each strict member is landed as a real `compilerOptions` change in
`cmd/gizzi-code/tsconfig.json` only when its standalone probe reads 0; until
then, the flag lives only in measurement/guard invocations, never in the
config. Recommended order:

**Phase 0 — prerequisite: burn-down completes.** The nocheck burn-down
(~85 batches remaining at measurement time; 366 files already burned, 1,089
queue files / 396,717 LOC live) must finish first. A file still carrying
`// @ts-nocheck` is invisible to every probe above; flipping strict while
1,000+ files are suppressed would strand an unknown error population in
already-"done" work. Gate: `queue.json` has no live batches (or the residual
is explicitly allowlisted per `test/ts-nocheck-allowlist.txt`) and
`bash script/check-ts-nocheck.sh` passes at the reduced baseline.

**Phase 1 — `noImplicitAny` (293 errors / 141 files).** Largest but most
mechanical; fixes are local annotations with no ripple into other files'
types (an inferred `any` is already `any` for its consumers). Landing it
first shrinks the TS7006/TS7011 noise so Phase 2's nullability errors are
read at full fidelity instead of being masked by `any`. Flip
`"noImplicitAny": true` in tsconfig when the probe reads 0.

**Phase 2 — `strictNullChecks` (212 errors / 110 files).** The semantic
core: TS2345/TS18048/TS2339 are real possibly-null flows. These fixes are
the ones most likely to touch logic guards (`if (!x) return`), so this phase
carries the highest review bar and the "type-only rule" needs its strictest
enforcement (see §4). Flip `"strictNullChecks": true` when 0.

**Phase 3 — `noUncheckedIndexedAccess` (re-measure; today unreadable).**
After Phase 2, run the probe and burn down whatever it reports, then flip
`"noUncheckedIndexedAccess": true` (matching the base).

**Phase 4 — trivial tail + `strict: true` (≤~10 errors).** Fix the
`strictFunctionTypes` (2) and `useUnknownInCatchVariables` (3) stragglers,
re-probe `strictPropertyInitialization` (TS5052 blocked the standalone probe;
under snc it becomes measurable — expect small), then delete the
`"strict": false` and `"noUncheckedIndexedAccess": false` overrides from
`cmd/gizzi-code/tsconfig.json` and let the `@tsconfig/bun` base flow through.
Final state: `"strict": true` + `noUncheckedIndexedAccess: true` inherited,
no local overrides. `bun run typecheck` must be 0 before and after.

**Do NOT flip flags in the other order.** snc-before-nia would let
implicit-`any` files masquerade as clean; nia-before-snc is a no-op (proven
above: 0 errors today) and would land a false "done".

### Interplay with the 360 React Compiler artifacts

The ~360 `.tsx` compiler artifacts under `src/cli/ui/ink-app/` (348 outside
the vendored subtrees, 12 double-excluded under `ink/`) carry
`// @ts-nocheck` headers and are excluded from the burn queue via
`COMPILER_ARTIFACT_FINGERPRINTS` in `build-queue.mjs`. **`@ts-nocheck`
suppresses all semantic errors — including every strict-family error — in
those files, so the de-compile codemod does NOT need to precede the strict
flip.** The artifacts stay quiet under `strict: true`; the strict phase
proceeds on the handwritten tree regardless of codemod progress.

Caveats: (a) any artifact the codemod converts and *doesn't* fully type-fix
re-enters the ordinary burn queue per §7 of
`INK_APP_COMPILER_ARTIFACTS.md` — it must then survive strict too, which the
codemod PRs should verify by running the Phase-relevant probe alongside
`bun run typecheck`. (b) The stub machinery (`src/vendor/react-compiler-runtime.ts`,
the three tsconfig `paths` entries, the `build-production.js` inline stub)
is untouched by the strict flip and is deleted only by the codemod's final
PR after the `react/compiler-runtime` import grep returns zero — a separate
track, scheduled independently. (c) When the burn-down's quarantined /
allowlisted stragglers are eventually resolved, their fixes are validated
against strict by the same per-flag probes.

## 4. Execution plan

### Lanes and batches (mirroring the burn-down)

- **Oracle.** `bun run typecheck` (current config) stays the merge gate —
  it is 0 errors today and must remain 0 after every strict PR. The strict
  gate is a *second* invocation: `NODE_OPTIONS=--max-old-space-size=8192 npx
  tsc --noEmit --<flag>` for the phase's flag, whose error count must ratchet
  down monotonically. Both invocations run after
  `bash script/ensure-sdk-dist.sh`.
- **Batch construction.** Generate a per-flag error-file queue from the probe
  output, ordered leaf-first using the same dependency logic as
  `build-queue.mjs` (reuse `resolveImport` / closure sizing by importing the
  module — it is already import-safe). Pack batches of ~15–25 files or
  ~30–50 errors, keeping twin pairs (`src/runtime/*` ↔
  `src/cli/ui/ink-app/*`) adjacent, and cap each batch at what one lane can
  verify in a session. Errors in `test/` and `packages/` are queue members
  too — they are not covered by the burn-down's src-only accounting.
- **Type-only rule.** Same discipline as the burn-down: fixes are type
  annotations, non-null assertions where the invariant is locally provable,
  guard clauses, `as const` / `satisfies`, and generic parameters. No import
  specifier changes, no runtime-behavior refactors, no dependency additions
  (except the reviewed TS7016 `@types` cases, one PR each). Phase 2
  (strictNullChecks) tightens this: a "fix" that changes control flow gets a
  `TODO(types)` + `@ts-expect-error` instead, with a `LATENT_BUG_DECISIONS.md`-style
  ledger entry — the 20 TS18048 ×58 files will hide real null-flow bugs; the
  point of the phase is to surface them, not to paper over them.
- **Guard / ratchet.** New `script/strict-flip/` artifacts, modeled on
  `script/typecheck-burndown/` + `script/check-ts-nocheck.sh`:
  - `script/strict-flip/baseline.json` — per flag: `count`, file list, probe
    command, source SHA (regenerated with `--update` when a batch lands, same
    commit as the fixes).
  - `script/strict-flip/check.sh` — runs the phase flag's probe, fails if
    count > baseline, prints the delta (like `check-ts-nocheck.sh`).
  - `test/strict-flip-guard.test.ts` — the invariants as a bun test, mirroring
    `test/ts-nocheck-guard.test.ts`: (1) per-flag error count never grows
    (escape hatch: `test/strict-flip-allowlist.txt`); (2) every file listed
    in the baseline still exists in it until its burn PR removes it in the
    same commit; (3) burned-count identity: live errors + recorded burns =
    baseline total, so a fix that lands without bookkeeping fails.
  - Wire `check.sh` into `.github/workflows/gizzi-code-quality.yml` next to
    the `ts-nocheck-ratchet` job. The existing nocheck guard keeps running
    unchanged through the whole phase; when the flip completes it remains as
    the permanent "no new suppression" ratchet.
- **Per-PR verification cadence** (every batch PR): `bun run typecheck` (0),
  phase-flag probe (count down by the batch's claimed errors), `bash
  script/check-ts-nocheck.sh` (still green), `bun test` for touched areas,
  `bun run script/build-production.js` (the Bun.build production bundle —
  it does not apply tsconfig paths and bundles the stub machinery; it must
  keep building through every phase), plus the strict-flip guard.
- **Merge discipline.** Same as burn-down: one batch per PR, conventional
  commits (`fix(gizzi-code): strict burn <flag> b<n>`), merge commit, ledger
  attestation per session.

### Effort estimate (from the measured counts)

| Phase | Errors | Files | Est. batches (≈30–50 err) | Character |
|---|---|---|---|---|
| 1 noImplicitAny | 293 | 141 | 7–9 | mechanical annotation; TS7016 needs review |
| 2 strictNullChecks | 212 | 110 | 5–7 | semantic; guard-adding; highest review bar |
| 3 noUncheckedIndexedAccess | TBD (re-measure) | TBD | 2–4 (guess) | `| undefined` propagation |
| 4 tail + strict:true | ≤~10 | ≤~10 | 1 | trivial + config flip |
| **Total** | **~515 + P3** | **~260 + P3** | **~15–21 PRs** | |

The burn-down's observed pace (~10–13 min per batch end-to-end including PR +
merge + attestation, 40 burn PRs on 2026-09-18) is the best calibration for
lane throughput. Strict batches carry a heavier verification bar (two tsc
oracle runs + production bundle), so assume **~20–40 min per batch per lane**.

**Calendar at 2–4 lanes:** Phase 1 ≈ 1–2 days, Phase 2 ≈ 1–2 days, Phase 3
≈ 1 day (after re-measure), Phase 4 ≈ hours. **Total ≈ 4–7 working days of
lane time** once the burn-down gate clears, plus one re-measurement day for
P3. At 2 lanes take the upper bound; at 4 lanes the lower. This excludes the
burn-down itself (~85 batches ≈ 2–4 lane-weeks at current pace) and the
React-Compiler codemod track (8–12 PRs, independent).

## 5. Risks

- **The error-count tail.** Experience with strict rollouts (and the
  burn-down's own quarantine lesson) says the last 10% of errors cost like
  the first 90%. The measured hotspots are generic-adjacent (`oauth/client.ts`
  twins, `codex.ts`) and covariance-flavored (`strictFunctionTypes`'s
  `sidecar.ts` extractor). Mitigation: pull gnarly files into dedicated solo
  batches early (the burn-down's >1,500-LOC solo rule, adapted per error
  count) rather than letting them stall a batch at the end; allow
  `@ts-expect-error` + ledger entry as a completion mechanism so a single
  file never blocks a phase flip, with a standing "expect-error debt" count
  in the baseline.
- **Bun.build production bundle.** Every PR must keep
  `script/build-production.js` green. Strict-mode fixes are type-level and
  erased at compile time, so bundle behavior should not change — but the
  check is cheap insurance against an accidental runtime edit slipping
  through under the "type-only" rule (a non-null assertion is fine; a moved
  guard is not).
- **Test flakiness under stricter types: none expected, verify anyway.**
  Types are erased at runtime; no test behavior should change. The risk is
  false confidence in the other direction: a Phase-2 "type-only" fix that
  silently alters a code path (adding an early `return` inside a loop is
  type-correct and behavior-changing). Hence the per-PR `bun test` for
  touched areas plus the production-bundle check, and why Phase 2 forbids
  control-flow edits outright.
- **Measurement drift.** The numbers above decay the moment the burn-down
  merges more batches (more files leave suppression → more strict errors
  appear; the snc count grew 138 → 212 within a day). The phase must
  re-measure at Phase 0 gate and regenerate baselines from its own probes,
  never reuse this document's tables as targets.
- **Probe/config skew.** All measurement used CLI flags overriding the
  config; if any tsconfig edit ships mid-phase (e.g. a codemod PR touching
  the `react/compiler-runtime` paths), re-run the phase probe before batch
  packing. The final Phase-4 diff is deliberately tiny — delete two override
  lines — so the flip itself is reviewable in one glance.
- **Phase 3 is a measured unknown.** `noUncheckedIndexedAccess` reading 0
  today is an artifact of snc being off (the `| undefined` it adds is
  unenforced without it). Re-measure after Phase 2 lands before committing to
  Phase 3's batch count; if it explodes, it may deserve splitting into
  src/ vs test/ sub-phases.
