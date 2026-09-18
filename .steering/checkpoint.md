Goal: Harden the typecheck burn-down queue builder (ao/queue-hardening) from pilot b0001's 16 escalations — pre-flag/quarantine the three avoidable causes.

Just did: Extended build-queue.mjs with three zero-dep static checks, validated against the full 1555-file corpus with zero false positives:
  (a) suspect-malformed — string/comment/regex/template-aware bracket-pairing lexer + ESM rule (export/import at brace depth >0 outside namespace/declare blocks). Catches all 12 pilot TEMPORARY SHIM stubs + 2 more genuine shims (snipProjection.ts, persist.ts) that b0001 never reached.
  (b) suspect-dead-shim — relative import specifiers resolved against disk, exact-case verified via readdir (macOS case-insensitive TS1261 trap). 23 files incl. all 4 pilot escalations (udsClient, Markdown case-mismatch, PermissionUpdateSchema, settings).
  (c) alias — realpath grouping; symlink duplicates quarantined with aliasOf. Corpus currently has ZERO pairs: the protectedNamespace pair already lost its headers in the pilot (both start with `/**` now, not in queue) — check is in place for future pairs.
  Quarantined files (37) excluded from batches; b0001 retired as zero-file DONE record carrying escalated/note/burnedFiles (226). Packing 5-7k LOC + leaf-first unchanged: 103 batches, 1518 files, 492198 LOC. New stats: quarantined/quarantinedByReason/zeroImporter(252)/totalAccounted. Guard test gained: no-untracked-burns identity (live + recorded burns === totalAccounted) + quarantine stable-or-shrinking & disjoint-from-batches. All 5 guard tests green; queue.json regeneration byte-deterministic (verified 3 runs).

Next: pnpm install → gates (tsc --noEmit, bun run test, release-preflight 52/0) → commit, PR, merge --merge, shared-checkout sync, ledger attestation, git-discipline-check.

Open questions: none — 25 additional dead-spec files (beyond the pilot's 4) are genuinely unresolvable (TS2307-on-burn); quarantining them is the spec'd behavior, the follow-up cleanup pass fixes specifiers with behavior-change approval.
