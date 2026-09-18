# Attestation: global.d.ts ambient shadow purge + sliceAnsi twin burn

**Session:** ao/global-dts-fix (worktree `allternit-ao-globaldts`, branch `ao/global-dts-fix`)
**Agent:** kimi-code subagent | **Date:** 2026-09-18 | **PR:** #599 | **Merge SHA:** 233edafb8bbb507badddded7507f8eb75203230a

## What was done

Audited all 98 hand-written `declare module` blocks in `cmd/gizzi-code/src/types/global.d.ts` against the actually-installed packages (each block classified: shadowing real types → delete; correct augmentation for untyped dep → keep; uninstalled but imported → keep+flag; zero importers → delete), then verified every deletion empirically against the full-program oracle. 54 blocks removed, 44 kept (19 lodash-es subpath shims — installed lodash-es 4.18.1 ships no types and no @types/lodash-es exists; native/uninstalled-module shims; the glob block that merges with missing-modules.d.ts to supply the `glob` named export; and the 11 @modelcontextprotocol/sdk blocks whose pre-1.29 `Server` ctor shape checked callers in computerUse/engine/server.ts and vault/mcp-server.ts still construct with — deleting the group surfaces exactly 2 errors there, verified empirically; SDK 1.29 changed the ctor to (info, options?), migration is behavior work for an owning batch).

Burned the escalated sliceAnsi twins (`src/cli/ui/ink-app/utils/sliceAnsi.ts`, `src/shared/utils/sliceAnsi.ts`): removed `// @ts-nocheck`, both typecheck against the real @alcalzone/ansi-tokenize 0.2.5 types with zero residual fixes. The bogus ambient block (2-arg reduceAnsiCodes, non-discriminated Token) was what tsc checked against — the package is exports-only with no main, so classic resolution fails and the ambient won (proven empirically: re-adding the block reproduces 6 fantasy-shape errors in the twins).

Guard identity: the 1122 queue regen had re-listed the twins under the new b0001 and dropped the original b0002's DONE history, so the +2 burn is recorded as a retired zero-file DONE record for the original b0002. queue.json reconciled on top of the concurrently-merged b0003 burn (PR #597): live 1453 + recorded 22 (b0003 20 + this 2) = 1475 = totalAccounted. stats: totalNocheck 1909→1907, totalQueueFiles 1434→1432, totalQueueLoc 478939→478750.

question.ts latent bug (b0002 finding) CONFIRMED and annotated: `src/runtime/integrations/question/question.ts` imports the `Bus` class from `@/runtime/bus/bus` (instance `on`/`off`/… only — no static `publish` exists) and calls `Bus.publish` at the ask/reply/reject sites; the correct import is the `Bus` namespace from `@/shared/bus`. Added `TODO(runtime)` at the call site naming it. No behavior change.

## Incidents / findings

1. **Pre-existing red main (tracked blocker, NOT fixed here):** after rebasing onto the PR #597 merge (packages S3 consolidation), `npx tsc --noEmit` shows 6 errors in `src/runtime/fabric/transport.ts:51-56` (`Property 'read' does not exist on type 'Values<{...}>'` — zod v3/v4 enum typing drift against the rebuilt `@allternit/os-contracts` dist). Reproduced identically with my commit fully reverted — origin/main alone is red. Outside this change's file scope; the owning team should fix before the next burn batch tries to use the tsc oracle.
2. **Ambient-vs-real precedence is per-specifier and empirical:** ambient blocks win for exports-only packages (ansi-tokenize, MCP SDK subpaths) and augment resolved modules for others (glob merged real + two ambient copies). The only reliable oracle is deleting the block and running tsc.
3. **Latent for a future batch:** still-queued `src/shared/utils/textHighlighting.ts:166` calls `reduceAnsiCodes(codes, [])` — the fantasy 2-arg form; runtime no-op (extra arg ignored), but its burn must drop the `, []` (its ink-app twin already uses the correct 1-arg form).
4. `src/types/missing-modules.d.ts` declares `@modelcontextprotocol/sdk/types` (no `.js`) and `glob` — outside this session's edit scope; its `sdk/types` block may shadow for any no-.js importer.

## Verification evidence

- `bash script/ensure-sdk-dist.sh && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`: 0 errors attributable to this change (6 pre-existing transport.ts errors, reproduced on origin/main without this commit)
- `bun run test` (cmd/gizzi-code): SMOKE PASS, 1311 pass / 0 fail / 42 skip, all 5 ts-nocheck guard tests green incl. identity 1453 + 22 = 1475
- `npx eslint` on 4 changed source files: 0 new problems (8 pre-existing; one fewer than baseline — the shared twin's nocheck-ban error burned away)
- `node scripts/release-preflight.mjs`: 52 passed, 0 failed
- Manual grep of all `reduceAnsiCodes` call sites: twins 1-arg ✓; textHighlighting twins flagged above
- pnpm-lock.yaml install drift reverted both times; final tree = 5 intended files only

## Honest deferrals

- The 6 transport.ts errors on main (incident 1) — pre-existing, outside scope, needs an owning fix before the tsc oracle is trustworthy for burn batches again.
- MCP SDK Server-ctor migration (2 checked callers) and question.ts behavior fix — both deferred to owning batches with TODO markers.
- `.steering/checkpoint.md` intentionally untouched (session file-scope constraint).
