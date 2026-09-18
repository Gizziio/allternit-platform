# 2026-09-18 — ao/queue-hardening: burn-down queue builder hardening (kimi-code)

**PR:** #591 (merged, merge commit `8920e62cb23fd58098ab424a74e9e6a5cd7ad390`)
**Branch:** `ao/queue-hardening` (worktree `allternit-ao-queuehard`, deleted after merge)
**Gates:** `tsc --noEmit` exit 0 · `bun run test` SMOKE PASS 107 entries (1353 tests, 0 fail, post-rebase) · `release-preflight.mjs` 52/0 · CI 9/9 incl. `@ts-nocheck ratchet`

## What was done

Hardened `cmd/gizzi-code/script/typecheck-burndown/build-queue.mjs` (zero-dep, deterministic) from pilot batch b0001's 16 escalations — three avoidable causes the builder now pre-flags and auto-quarantines instead of discovering mid-batch:

1. **suspect-malformed** (14 files) — a string/comment/regex/template-aware bracket-pairing lexer plus an ESM rule: `export`/`import` declarations at brace depth > 0 (outside `namespace`/`declare module` blocks) mean an enclosing body was never closed — exactly the TEMPORARY SHIM stub signature. The pairing check alone misses these stubs (their piled-up trailing closers pair cleanly by count/order), so the export-at-depth rule carries the detection. Caught all 12 pilot shims + 2 more the pilot never reached (`services/compact/snipProjection.ts`, `services/contextCollapse/persist.ts`). Validated against all 1555 queued files with zero false positives — the corpus includes regex-heavy parsers, compiled JSX with inline sourcemaps, template unions like `'>' | '>>'`, and JSX text apostrophes, all of which the lexer handles (regex-vs-division via preceding-token heuristic with postfix-`!` and keyword tracking; JSX `</tag`/`/>` only exempted in .tsx).
2. **suspect-dead-shim** (20 files) — every relative import specifier resolved against the disk with exact-case verification via readdir (macOS case-insensitive `statSync` cannot see the TS1261 casing trap). Unresolved or case-mismatched specifiers quarantine the file. Caught all 4 pilot escalations (`udsClient.ts` nonexistent target, `Markdown.ts` `Markdown.js` vs `markdown.ts`, `PermissionUpdateSchema.ts`/`settings.ts` wrong relative paths) plus 16 further future escalations pre-flagged. Three of the files were deleted by the shim-triage commit (`602109d0f`) that landed on main during this PR — a concurrent-merge race handled by rebasing and regenerating.
3. **alias** — queued paths sharing one realpath (symlink pairs): canonical path stays queued, aliases quarantined with `aliasOf`. **Corpus currently has zero pairs** — the `protectedNamespace.ts` pair already lost its headers in the pilot (both files now start with `/**`, not in the queue). The check is in place for future pairs; documented in the builder header.

Zero-importer detection is informational only: `stats.zeroImporter` = 252 (many are entrypoints), never quarantined.

## Output schema (backward-compatible)

- New `quarantined[]`: `{path, reason, detail?}` / `{path, reason: "alias", aliasOf}`; excluded from all batches.
- New `stats` fields only: `quarantined`, `quarantinedByReason`, `zeroImporter`, `totalAccounted`.
- b0001 (all 16 remaining files quarantined) retires as a zero-file DONE record preserving `state`, `escalated` (16), `note`, `burnedFiles: 226`; re-runs idempotent.
- Packing unchanged: 5–7k LOC, leaf-first, twin adjacency. 103 batches / 1518 files / 492,198 LOC (post-shim-triage).

## Guard test (`test/ts-nocheck-guard.test.ts`, 5/5)

- **No untracked burns** (pilot's second suggestion): live handwritten-nocheck population + DONE batches' recorded `burnedFiles` must equal `stats.totalAccounted`. Pure static check, no tsc.
- Quarantine stable-or-shrinking (every live detection already committed), disjoint from batches, headers retained, counts consistent.
- "Population never grows" baseline updated to queued + quarantined.

## Incidents / honest notes

- Mid-PR, origin/main advanced 13 commits (eslint-gate fix, shim-triage deleting 3 of the 4 pilot dead-shim files, cloud-relay cut). Rebased; queue.json regenerated (quarantine 37→34, dead-shim 23→20); all gates re-run green on the rebased tree. One local git fumble (amended the wrong commit during conflict resolution) was corrected with a soft reset before pushing — final history is two clean commits.
- The `.steering/checkpoint.md` update rode inside the feat commit instead of a separate docs commit (cosmetic; both conventional prefixes would have been acceptable).
- Deferred (by design, same gate as the pilot's escalations): the 34 quarantined files need a dedicated cleanup pass with behavior-change approval — fix shim grammar, repair or delete dead re-export shims, decide the entrypoint story for zero-importer files.
