Goal: Harden cmd/gizzi-code/script/ensure-sdk-dist.sh against the 2026-09-18 poisoned-dist incident (PR #597 stale lockfile links → os-contracts built against root-hoisted zod v4, errored, still emitted v4-typed .d.ts; mtime freshness called it fresh) + one-line root .gitignore fix for surfaces/allternit-desktop/resources/office-engine/.
Just did: (a) dep-snapshot staleness: every managed package (packages/sdk, sdk/computer-use, platform/packages/os-contracts) now records its resolved runtime-dep versions in dist/.build-deps.json at build time; missing sidecar or resolution drift → rebuild. (b) os-contracts tsconfig.build.json gains noEmitOnError + the script propagates its build exit code (fail-fast instead of poisoned emit). Root .gitignore gains the office-engine scratch line (note: nested surfaces/allternit-desktop/.gitignore already covers it — root line is the requested belt-and-suspenders). cmd/gizzi-code/AGENTS.md preflight paragraph updated.
Verified by simulation: fresh build writes sidecar (zod 3.25.76); idempotent on match; fake sidecar version → rebuild; REAL repro (nested zod temporarily removed → resolution falls back to root v4) → mismatch detected, build fails with the exact incident TS2554s, script exits 1, no poisoned emit; missing sidecar → stale-once rebuild.
Next: full gates (tsc --noEmit, bun run test, release-preflight 52/0) → commit, PR, merge --merge, shared-checkout pull --ff-only, ledger attestation, git-discipline-check PASS.
Open questions: none.

Goal: Harden the typecheck burn-down queue builder (ao/queue-hardening) from pilot b0001's 16 escalations — pre-flag/quarantine the three avoidable causes.

Just did: Extended build-queue.mjs with three zero-dep static checks, validated against the full 1555-file corpus with zero false positives:
  (a) suspect-malformed — string/comment/regex/template-aware bracket-pairing lexer + ESM rule (export/import at brace depth >0 outside namespace/declare blocks). Catches all 12 pilot TEMPORARY SHIM stubs + 2 more genuine shims (snipProjection.ts, persist.ts) that b0001 never reached.
  (b) suspect-dead-shim — relative import specifiers resolved against disk, exact-case verified via readdir (macOS case-insensitive TS1261 trap). 23 files incl. all 4 pilot escalations (udsClient, Markdown case-mismatch, PermissionUpdateSchema, settings).
  (c) alias — realpath grouping; symlink duplicates quarantined with aliasOf. Corpus currently has ZERO pairs: the protectedNamespace pair already lost its headers in the pilot (both start with `/**` now, not in queue) — check is in place for future pairs.
  Quarantined files (37) excluded from batches; b0001 retired as zero-file DONE record carrying escalated/note/burnedFiles (226). Packing 5-7k LOC + leaf-first unchanged: 103 batches, 1518 files, 492198 LOC. New stats: quarantined/quarantinedByReason/zeroImporter(252)/totalAccounted. Guard test gained: no-untracked-burns identity (live + recorded burns === totalAccounted) + quarantine stable-or-shrinking & disjoint-from-batches. All 5 guard tests green; queue.json regeneration byte-deterministic (verified 3 runs).

Next: pnpm install → gates (tsc --noEmit, bun run test, release-preflight 52/0) → commit, PR, merge --merge, shared-checkout sync, ledger attestation, git-discipline-check.

Open questions: none — 25 additional dead-spec files (beyond the pilot's 4) are genuinely unresolvable (TS2307-on-burn); quarantining them is the spec'd behavior, the follow-up cleanup pass fixes specifiers with behavior-change approval.

## 2026-09-18 b0002 ts-burn handoff note
Goal: burn-down batch b0002 (DONE, PR #596 merged 7faf84556).
Just did: 68 files burned type-onlyly, 2 escalated (sliceAnsi twins blocked by
ambient ansi-tokenize decl in src/types/global.d.ts).
Next: future batches should fix src/types/global.d.ts ambient declarations
(ansi-tokenize, lodash-es/memoize.js, @modelcontextprotocol/sdk) instead of
accumulating TODO(types) local mirrors — that file is owned by no batch and is
now the burn-down's biggest single blocker. ALSO: stale branch
`ao/cut-dormant-stubs` (3 unmerged commits: dormant-stub cuts + burn-down
collateral sync) predates the merged shim-triage work (58c8a9007/e30330713
landed versions of it) — owner should verify it is superseded and delete it, or
add it to .steering/git-discipline-allowlist with a reason. I passed it as an
intentional argument to git-discipline-check for my session attestation only.
Open questions: who owns src/types/global.d.ts corrections?

## 2026-09-18 S3 packages→platform/packages move (ao/folder-s3-packages)
Goal: consolidate packages/@allternit/* → platform/packages/* (S3 of folder reorg).
Just did: 38 dirs git mv'd (types/allternit-types flattened to types-allternit-types; computer-use container moved too; packages/ root deleted). Sweep: pnpm-workspace globs, 3 deploy/publish workflows, scripts (analyze-packages PACKAGE_ROOT, alabs-course-pipeline, validate-typography, sync-course), tsconfig paths (replies-runtime, cmd/gizzi-code), cmd/gizzi-code build scripts (.driver-build.ts, build-production.js, ensure-sdk-dist.sh), bun.lock, sdk jest config, code comments (orchestrator headers, Rust port comments, Swift comments), root docs (README/AGENTS/REPO_STRUCTURE/THIRD-PARTY-NOTICES/NATIVE_SESSIONS). Lockfile: hand-edited 58 importer/link renames on pristine HEAD (the initial plain `pnpm install` churned @babel/core 8.0.1 — discarded, per S2 playbook); `pnpm install --frozen-lockfile` exit 0.
Next: fresh frozen reinstall (stale workspace symlinks), re-run gates, commit, PR, merge, ledger attestation.
Open questions: none. Left intentionally: agent-ledger, docs/{audit,archive,learnings,parity-reports*,*audit,research,programs,Core_System,Business_Strategy,agent-tasks,Audits_and_Research,upstream,public/parity}, alabs-generated-courses (dated/generated records); cmd/gizzi-code/src fabric/transport.ts + codemap/render-html.ts stale path comments (src edits forbidden); surfaces/allternit-desktop py comment (tree forbidden).

## 2026-09-18 kimi-fewshot session (session/kimi-fewshot)
Goal: Break KimiCliHead's per-task constant-policy collapse (0.318 agreement) via few-shot in-context distillation from Tier A labelled traces. Prompt-space only, kimi -p subscription, zero local training.
Just did: Fixed the parked Tier A trace scripts (tier_a_traces.py moved to core/ for package-relative imports, ABSTAIN_OPTION added to decision_head.py, SyntheticTask gained optional step_trees honored by _step_trees). Generated evaluation/tier-a/traces.jsonl (419 train / 94 val / 66 heldout). Implemented --few-shot N for the kimi head: core/kimi_fewshot.py (train-split-only selection with hard held-out invariant asserted in code, random/interleaved order, default/task-neutral framing, prompt block rendering) + KimiCliHead(few_shot_block) + eval CLI flags. 22 new unit tests, all green (87 passed 1 skipped full targeted suite).
Next: commit, push, launch Pass 1 eval (N=8, random order, default framing) in background (~30 min), analyze collapse anatomy vs 0.318 baseline.
Open questions: none. Note: allternit-commrails binary not on PATH in this env — DAG plan not created; tracking via this checkpoint instead. 4 ruff findings in touched files are pre-existing on HEAD (left as-is).
