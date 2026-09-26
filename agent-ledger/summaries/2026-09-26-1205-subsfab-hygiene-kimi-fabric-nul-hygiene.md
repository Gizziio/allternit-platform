# 2026-09-26 ~12:05 — session/subsfab-hygiene — fabric NUL-byte hygiene

Agent: Kimi Code (direct, no sub-executor). Merged: PR #754 → `5fde2e01a`. Branch deleted.

## What

Found while preparing the P3 manual gate: `services/subscription-gateway/src/queue/scheduler.ts`,
`src/worker/supervisor.ts`, and `cmd/cli/bin/allternit.js` each carried a stray NUL byte, so git
treated them as binary (`Bin` in diffs) and grep/code-review silently misbehaved on them. Same
defect class as the `resolve.ts` catch during P4 review (fixed `047f5a770`). All three stripped;
content hash-verified identical to HEAD blobs minus the NUL.

Added `scripts/check-fabric-sources-clean.sh` (perl `/\x00/` scan over the fabric trees' tracked
sources) wired into the gateway `test` script as the durable gate.

## The detection trap (recorded so nobody re-derives it)

`grep $'\x00'` CANNOT detect NUL bytes: bash expands `$'\x00'` to an **empty string**, so the
pattern matches every line of every file — every file appears "contaminated". This produced a
false 175-file mass-contamination alarm tonight before `file`/`git diff Bin` markers and a perl
scanner showed the truth (3 files). Use `perl -ne 'if (/\x00/)'` or git's binary flag.

## Verification

- `pnpm -F subscription-gateway build` clean; `CI=1 pnpm -F subscription-gateway test` — 221 passed + `check-fabric-sources-clean: OK`.
- `pnpm -F @allternit/cli build` + test — 48/48.
- Repo-wide perl NUL scan of all tracked files: only legitimate binaries (fonts, PDFs, GIFs, vendored `rg`, sqlite, .node) contain NUL.

## Gate context

P3 manual gate prep also surfaced the real gate blocker: the worker factory / probe activation
was never wired into `main.ts` (`POST /v1/accounts` only writes the row — no Sessions window,
no probe). Tracked as the next PR (session/subsfab-activate); the gate resumes after it merges.
