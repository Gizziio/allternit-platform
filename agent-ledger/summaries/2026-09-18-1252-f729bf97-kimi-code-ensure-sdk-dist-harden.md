# 2026-09-18-1252 — ensure-sdk-dist hardening: dep-snapshot staleness + os-contracts noEmitOnError (session f729bf97, kimi-code)

**Outcome: recurrence prevention for the 2026-09-18 poisoned-dist incident landed (PR #604, merged b2150cf0e).**
Both deferred follow-ups from the 1238 RED-main investigation are now closed: the
`ensure-sdk-dist.sh` freshness blind spot and the `office-engine/` scratch-dir
gitignore item.

## What was built

Incident being prevented (full mechanism in
`2026-09-18-1238-f729bf97-kimi-code-fabric-transport-zod-red-main.md`): PR #597
left pnpm-lock workspace links stale → os-contracts installed with no nested zod
→ its build resolved root-hoisted zod v4 instead of its own zod v3 → build
ERRORED under v4 but still emitted (no `noEmitOnError`) → dist `.d.ts` declared
v4-map-shaped `z.ZodEnum<{...}>` → the dist was newer than src, so the script's
missing-or-older-than-src check called it fresh → gizzi-code tsc failed with 6
TS2339s. Root cause was fixed in #599/#600; this PR prevents recurrence.

Two guards:

1. **Dependency-snapshot staleness** (`cmd/gizzi-code/script/ensure-sdk-dist.sh`):
   a new `dep_snapshot` helper records the resolved version of every runtime dep
   (node_modules walk-up from the package dir through each parent dir — mirrors
   node/pnpm resolution, including the root-hoisted fallback that caused the
   incident) into `<dist>/.build-deps.json` after every managed build. Applies to
   all three managed packages (`packages/sdk`, `sdk/computer-use`,
   `platform/packages/os-contracts`; sdk has zero runtime deps → stable `{}`).
   Freshness order per package: sentinel missing → sidecar missing (stale-once,
   dist predates the check) → src newer than sentinel → **dep snapshot != sidecar**
   → rebuild. A resolution drift now forces a rebuild even when the dist is newer
   than src — the exact case that defeated the old check.
2. **Fail-fast** (`platform/packages/os-contracts/tsconfig.build.json`):
   `"noEmitOnError": true`, and the script now propagates the os-contracts build
   exit code (loud exit 1 on build failure instead of continuing). A future
   wrong-zod-major build fails instead of emitting a poisoned `.d.ts`.
   packages/sdk / sdk/computer-use keep their tolerant contract (the SDK's ~1.8k
   baseline type errors must not fail its build — unchanged behavior there).

Plus: root `.gitignore` gained `surfaces/allternit-desktop/resources/office-engine/`
(untracked scratch dir the pnpm workspace glob ingests on any install; the nested
desktop .gitignore already ignored it — the root line states intent at the repo
boundary; the dir itself was left on disk, NOT deleted). `cmd/gizzi-code/AGENTS.md`
SDK-dist-preflight paragraph updated to the new contract.

## Simulation proof (fresh worktree on origin/main, pnpm 10 install)

- Fresh build → sidecar written: os-contracts `{"zod": "3.25.76"}` (its nested
  zod, not the root-hoisted 4.3.6).
- Re-run with matching sidecar → **no rebuild** (idempotent).
- Hand-poisoned sidecar (fake zod version) → **rebuild triggered**, sidecar
  corrected back to 3.25.76.
- **Full incident repro**: temporarily moved os-contracts' nested
  `node_modules/zod` aside (resolution falls back to root zod v4 — the exact
  #597 state) → sidecar mismatch detected → rebuild attempted → build failed
  with the exact incident errors (`TS2554: Expected 2-3 arguments, but got 1`,
  spine.ts lines 36/67/108/119/131/148) → `noEmitOnError` blocked the emit →
  script **exit 1**, no poisoned dist left behind. Nested zod restored →
  idempotent pass.
- Sidecar deleted → stale-once rebuild + sidecar rewritten.

## Gates (at merge base 6a3ad035f)

- `cd cmd/gizzi-code && bash script/ensure-sdk-dist.sh && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → **exit 0**
- `bun run test` → **1353 tests, 0 fail, 42 skip across 107 files, SMOKE PASS**
- `node scripts/release-preflight.mjs` → **52 passed, 0 failed** (exit 0;
  note: an earlier piped `| tail -4` masked the exit code on a stderr warning —
  re-run unpiped, clean)
- `scripts/git-discipline-check.sh` → **PASS** (see final-state evidence in this
  session's closing summary)

## PR / merge

- PR #604 (`ao/ensure-sdk-dist-harden`), merged **b2150cf0e906e1e427d48aa1f718f247405e111e** (merge commit, `gh pr merge --merge`).
- Commits: `9c39b256a` fix(gizzi-code) (script + tsconfig + .gitignore + AGENTS.md), `01815dba5` chore(steering) checkpoint.

## Scope notes

Files touched: `cmd/gizzi-code/script/ensure-sdk-dist.sh`,
`platform/packages/os-contracts/tsconfig.build.json` (tsconfig only), root
`.gitignore`, `cmd/gizzi-code/AGENTS.md` (doc), `.steering/checkpoint.md`.
Untouched per rules: release-desktop.yml, surfaces/allternit-desktop/ sources,
services/voice/, services/local-engine/, build-production.js,
release-preflight.mjs (run only), queue.json.

## Honest deferrals

- None. Both 1238 follow-ups closed. Desktop binary rebuild (lifecycle step 8)
  is N/A — nothing the desktop bundles changed (build-script hardening + docs +
  gitignore only); the change does not alter any bundled source or sidecar.
