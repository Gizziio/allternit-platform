# Steering checkpoint

## Goal
Session E: session/rendercompare-0911, worktree allternit-session-rendercompare-0911,
from origin/main @ dce56e070. Mapping doc §3 port #2 ("P1.5") — render-and-compare
self-verification: shared `scripts/render-artifact-screenshot.mjs` (Chrome +
playwright-core, ad-hoc resolution), bounded "Self-verification" block in
composeStudioSystemPrompt, max 2 passes, final PNG persisted as project file
`/.renders/<timestamp>.png`. Plan at .steering/plans/plan-rendercompare-0911.md.
Steering agent: a session mid-flight on surfaces/ai.allternit.com/skills/ and
studio-system-prompt.ts — if this PR conflicts or falls behind main, merge
origin/main in, resolve, re-verify, re-push.

Also active — Session G (fedesign-0911): mapping doc §2 row 5 / §4 — vendor
Anthropic's verified `frontend-design` skill (github.com/anthropics/skills,
Apache-2.0) as the base of the studio steering layer, ADAPTED to Allternit brand
law (amber/ivory/graphite, deny-list vs html-linter P0s, Inter kept only as local
fallback alias). Steering reference doc + bounded "Design taste" block in
`composeStudioSystemPrompt` — NOT a bundled creation skill.
Session: session/artifactsapi-0911, worktree allternit-session-artifactsapi-0911,
from origin/main @ 9b01fc5bf. DESIGN BEFORE BUILD — design doc + tracking
issues only for the A:// Artifacts API (mapping doc §2 row 16, Eoj amendment
2026-09-11). Plan at .steering/plans/plan-artifactsapi-0911.md.

Also active — Session G (fedesign-0911): mapping doc §2 row 5 / §4 — vendor
Anthropic's verified `frontend-design` skill (github.com/anthropics/skills,
Apache-2.0) as the base of the studio steering layer, ADAPTED to Allternit brand
law (amber/ivory/graphite, deny-list vs html-linter P0s, Inter kept only as local
fallback alias). Steering reference doc + bounded "Design taste" block in
`composeStudioSystemPrompt` — NOT a bundled creation skill.
Session: session/fedesign-0911, worktree allternit-session-fedesign-0911, from
origin/main @ 9b01fc5bf (rebased onto post-#382 main).
Plan at .steering/plans/plan-fedesign-0911.md.

## Just did
- (rendercompare-0911) Worktree created from origin/main @ dce56e070; pnpm install done
  (1m13s); playwright-core resolvable from root node_modules, Chrome present,
  release-preflight baseline 35/0. Plan + checkpoint written; implementation starting.
- (rendercompare-0911) Implemented: scripts/render-artifact-screenshot.mjs (pure helpers
  parseArgs/resolveOutputPath/chromeCandidates factored out; ad-hoc playwright-core
  resolution + Chrome discovery mirroring client-report screenshot.js) + 11 node:test
  helper tests (11/11). Studio system prompt gained bounded "Self-verification — render
  and compare (binding, max 2 passes)" block with exact command line + repo-root mount
  note; 5 new vitest assertions. LIVE RENDER CHECK PASSED: fixture <h1>Render check</h1>
  -> real Chrome PNG 9825 bytes 1280x800 via both --html-file and stdin; fixtures deleted.
  Awaiting typecheck + vitest before commit.
- (rendercompare-0911) ALL GATES GREEN: typecheck 0 errors; vitest src/lib/design
  src/shell src/views/design 79/79 across 13 files (baseline 66/66 @12 — main gained
  tests from other sessions; this change adds 5 in studio-system-prompt.test.ts);
  release-preflight 35/0; node --test scripts/render-artifact-screenshot.test.mjs 11/11.
- (artifactsapi-0911) Worktree created. Read the real code first: ArtifactRenderer.tsx (sandboxed
  srcDoc iframe + storage shim), artifact-parser.ts (splitOnArtifacts),
  gallery-store.ts / project-file-store.ts (the two IndexedDB stores),
  artifact-export.ts (client-side export tiers), artifact_routes.rs (existing
  *document* artifact API — adjacent, untouched), migrations V1–V145
  (next: V146), docs/NATIVE_SESSIONS.md + AGENT_EMAIL_RAIL.md for doc style.
- (artifactsapi-0911) Wrote `docs/design/artifacts-api.md` (8 sections, DECIDED/OPEN marked).
- (fedesign-0911) Vendored adapted reference at
  `surfaces/ai.allternit.com/skills/references/frontend-design.md`; bounded
  "Design taste (steering — binding)" block in composeStudioSystemPrompt; new
  studio-system-prompt.test.ts (8 tests). Verified: typecheck 0 errors, vitest
  src/lib/design + src/shell 63/63, release-preflight 35/0. Pushed session/fedesign-0911.

## Next
- (artifactsapi-0911) Commit + push session/artifactsapi-0911; PR → merge (--merge).
- (artifactsapi-0911) gh issues: epic + 3 phase issues (enhancement label), linked.
- (artifactsapi-0911) Ledger branch session/ledger-artifactsapi-0911: summary + LEDGER.md bullet,
  PR, merge.
- (artifactsapi-0911) Cleanup: worktree remove, delete both branches local+remote. No desktop
  rebuild (docs-only, ritual skip rule).
- (fedesign-0911) PR #390 merge → ledger branch → desktop rebuild → bundle grep →
  DMG swap → cleanup.

## Open questions
- §6 publish/relay tier questions (4 publish + 2 relay) are OPEN for Eoj —
  listed in the design doc; Phase 3 blocked on the publish answers.
- (fedesign-0911) None.
