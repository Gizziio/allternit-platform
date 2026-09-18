# 2026-09-18 S3 packages→platform/packages move — attestation

Session: ao/folder-s3-packages (orchestrator step S3) · Agent: kimi-code · PR #597 · merge 8e30e66c1

## What was done

Consolidated `packages/@allternit/*` into `platform/packages/*` per the PR #582 ownership design. 38 package dirs moved via `git mv` (1,052 renames), `types/allternit-types` flattened to `types-allternit-types`, the orphaned non-workspace `packages/computer-use` container moved along, and the emptied `packages/` root was deleted. Package `name` fields unchanged — consumers resolve by workspace name.

## How it works

Workspace globs in `pnpm-workspace.yaml` now cover `platform/packages/*` + `platform/packages/*/*` (second level required for the `plugin-sdk/website` importer). tsconfig path maps in `cmd/gizzi-code` and `services/replies-runtime`, the cmd/gizzi-code build scripts (`.driver-build.ts`, `build-production.js`, `ensure-sdk-dist.sh`), `cmd/gizzi-code/bun.lock`, `sdk/computer-use` jest moduleNameMapper, deploy/publish workflow triggers, and `scripts/analyze-packages.ts` (`PACKAGE_ROOT = 'platform/packages'`) all point at the new root. Relative depths are unchanged (packages/@allternit/<n> and platform/packages/<n> are both 2 levels from root), so every `link:`/`../../` prefix survived verbatim.

## Verification evidence

- pnpm-lock.yaml: hand-edited on pristine HEAD — exactly 58 line renames (importer keys + link tails), zero version bumps. (The first plain `pnpm install` churned @babel/core 7→8; discarded per the S2 playbook.) `pnpm install --frozen-lockfile` exit 0, run twice, byte-stable.
- After a fresh `rm -rf node_modules` + frozen reinstall (pre-move symlinks pointed at dead paths — caused a transient TS2307 in replies-runtime, cleared by relink): `tsc --noEmit` exit 0 for replies-contract, replies-reducer (after building its composite dep), os-contracts, executor-core, parallel-run, plugin-sdk, services/replies-runtime.
- `node scripts/release-preflight.mjs` → 52/0.
- `cargo metadata --no-deps` exit 0.
- `cmd/gizzi-code`: `bash script/ensure-sdk-dist.sh` (rebuilt os-contracts dist at the new path) + `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → exit 0.
- Root eslint config loads (`npx eslint --print-config` exit 0); CI on PR #597 all green (incl. validate-typography, which consumes the edited script).
- Final sweep: zero functional references to `packages/@allternit` outside dated/generated records (agent-ledger, docs audits/archives/learnings/parity reports, alabs-generated-courses) and forbidden trees.

## Incidents / honest deferrals

- The initial `pnpm install` (pre-move) rewrote pnpm-lock.yaml with @babel/core 8.0.1 churn — caught, discarded, hand-edit used instead. Root cause: plain install re-resolves; HEAD's lockfile is fine under `--frozen-lockfile`.
- Left untouched per process rules: `cmd/gizzi-code/src/runtime/fabric/transport.ts` + `src/codemap/render-html.ts` stale path comments (src edits forbidden; cosmetic), `surfaces/allternit-desktop/.../workflow_runner.py` comment (forbidden tree), all dated docs.
- Desktop binary rebuild (lifecycle step 8) skipped deliberately: no bundled-code change (name-based resolution); flagged to owner.
- CommRails DAG plan entry not created (orchestrator-assigned step executed under the parent task's tracking).
