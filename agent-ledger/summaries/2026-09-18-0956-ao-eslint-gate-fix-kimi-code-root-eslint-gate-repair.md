# ao/eslint-gate-fix — root eslint gate repair (typescript-eslint + eslint-plugin-react-hooks declared)

**Session:** ao/eslint-gate-fix (worktree `allternit-ao-eslintgate`)
**Agent:** kimi-code subagent
**Date:** 2026-09-18 0956
**PR:** #588, merge commit `8b5af4a3b`

## What was done

The burn-down pilot (PR #586, batch b0001) flagged that the repo-wide eslint gate was unverifiable: root `eslint.config.js` failed to LOAD, so "zero new eslint-disable" could not be checked. Root cause confirmed: the root config imports `@eslint/js`, `typescript-eslint`, and `eslint-plugin-react-hooks`, and **no package.json in the repo declared any of them**. They resolved only via `shamefully-hoist=true` hoisting luck; `typescript-eslint` (the meta-package) appears in no workspace dependency graph, so it was never installed — every root `npx eslint` died with `ERR_MODULE_NOT_FOUND: Cannot find package 'typescript-eslint'`.

Fix (root `package.json` + `pnpm-lock.yaml` only):

- `typescript-eslint: ^8.70.0` in root devDependencies. Version choice: peers `eslint ^8.57 || ^9 || ^10`, `typescript >=4.8.4 <6.1.0` — matches the repo's existing `@typescript-eslint/*` ^8 pins, root typescript 5.9.3, and the eslint 10.10.0 that root `npx eslint` resolves to. Root owns it because the config is root-level; verified no per-package config imports it except `cmd/gizzi-code/sdks/vscode/eslint.config.mjs`, which is self-contained with its own declared deps.
- `eslint-plugin-react-hooks: ^7.1.1` in root devDependencies — after adding typescript-eslint the config load advanced one import and failed identically on this package (also undeclared anywhere; absent from `node_modules/.pnpm` entirely). Current major, flat-config compatible.

Lockfile: +213 lines, pure additions (root importer devDeps + `@typescript-eslint/*` 8.70.0 tree + eslint-plugin-react-hooks). No existing entries modified. No rules weakened, no severities changed, no eslint-disable added anywhere.

## Verification evidence

- Pre-fix repro in shared checkout: `npx eslint cmd/gizzi-code/script/` → `ERR_MODULE_NOT_FOUND: Cannot find package 'typescript-eslint'` (ESLint 10.10.0).
- Post-fix, fresh worktree at the PR branch: `npx eslint cmd/gizzi-code/script/` → config loads, 12 problems reported (9 errors / 3 warnings, all pre-existing findings in burn-down-adjacent but non-`src` files).
- Burn-down gate target: `npx eslint` on a 5-file sample of the burned batch under `cmd/gizzi-code/src` (snapshot.ts, continuity/handoff-emitter.ts, continuity/types.ts, continuity/parsers.ts, ui/allternit/inline-coerce.ts) → exit 0, no config-load failure. Gate is verifiable.
- Full-repo count (newly visible backlog), `npx eslint .` excluding `services/mailflare`: **3,052 files with problems; 3,744 errors; 2,925 warnings; 5 fatal parse errors**. Top error rules: `@typescript-eslint/ban-ts-comment` (2,262 — largely the remaining burn-down queue), `@typescript-eslint/no-namespace` (617), `no-useless-escape` (182). Top warnings: `@typescript-eslint/no-unused-vars` (2,205), `prefer-const` (241), `react-hooks/exhaustive-deps` (206). The 5 fatals are pre-existing syntax-broken files (e.g. `packages/@allternit/contracts/layer-boundary/layer-boundary-contracts.ts` "Invalid character", a SkillsPanel.tsx, an alabs excerpt file).
- `node scripts/release-preflight.mjs` → **52 passed, 0 failed** (run, never edited).
- `pnpm run typecheck` at root: fails in a FRESH worktree on (1) `@allternit/provider-adapters` TS6305 (composite project reference to unbuilt `replies-contract/dist` — disappears after `pnpm --filter @allternit/replies-contract build`) and (2) `@allternit/office-slides-editor` TS2550/TS7006 in `../office-pptx-engine/src/slide-transfer.ts` (tsconfig `lib` below es2021). **Both reproduced identically on a pristine `origin/main` throwaway worktree** (60e6cef71) — pre-existing build-order/config issues, unrelated to this devDeps-only change. Shared checkout (with built dists) is unaffected in kind.
- git-discipline-check.sh after merge + ff-only pull: PASS (verbatim in session report).

## Caveats filed for follow-up (not done here)

1. **Backlog triage:** 3,744 errors / 2,925 warnings now visible repo-wide. The burn-down lanes own their slices; no mass-disable or severity changes were made. Suggested immediate look: the 5 fatal parse-error files.
2. **`npx eslint .` crashes loading `services/mailflare/eslint.config.mjs`** (`eslint-config-next` uninstalled) — mailflare is an npm-managed vendored project excluded from the pnpm workspace; its node_modules has never been installed in any checkout. Pre-existing; the operational gate lints targeted paths, not `.`.
3. **`@eslint/js` and `eslint` itself remain undeclared at root** — they resolve via shamefully-hoist transitive hoisting today. A follow-up hardening PR should declare `eslint` (pinning the major the repo intends) and `@eslint/js` at root.
4. Typecheck fresh-worktree composite build-order (TS6305 class) and the office-slides-editor lib es2021 issue are pre-existing and tracked here for the next session that touches those packages.

## Incidents / honest deferrals

- `origin/main` advanced mid-session (78a9b6376 → 60e6cef71, another session's ledger attestation); branch rebased cleanly before PR.
- Desktop rebuild (lifecycle step 8) skipped deliberately: this change is root devDeps-only; nothing the desktop bundles was touched. Preflight 52/0 confirms the release path is intact.
- `.steering/checkpoint.md` not updated: subagent process contract (parent-defined hard rules) took precedence; steering consult would have round-tripped through the orchestrator.
