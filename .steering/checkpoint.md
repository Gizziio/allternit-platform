# Steering checkpoint

## Goal
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

---

## Goal
Session: session/p2wins-0911, worktree allternit-session-p2wins-0911, from
origin/main @ 474348b40. Three locked P2 quick wins: (1) IndexedDB file
versions in project-file-store (DB v2, fileVersions store, cap 10, history UI
in ProjectFileWorkspace); (2) Team tab honesty label (pure mock, zero network
calls — in-tab notice); (3) artifact sandbox policy codified in DESIGN.md after
auditing ArtifactRenderer.tsx. Plan at .steering/plans/plan-p2wins-0911.md.

## Just did
- Worktree created on origin/main @ 474348b40; pnpm install running in background.

## Next
- Read project-file-store.ts, gallery-store.test.ts, ProjectFileWorkspace.tsx,
  DesignTeamWorkspace.tsx, ArtifactRenderer.tsx, DESIGN.md.
- Implement item 1 (store + APIs + tests), item 2 (notice), item 3 (audit + doc + issue).
- Verify: typecheck 0 errors; vitest src/lib/design src/shell src/views/design all green.

## Open questions
- None.

---

## Goal
Session: session/p2wins-0911 — implement + verify three P2 quick wins, merge,
ledger, desktop rebuild, cleanup.

## Just did
- Item 1 DONE: project-file-store DB v2 with `fileVersions` store (keyPath id,
  record {id: projectId:path, projectId, path, versions[{hash,content,savedAt}]}),
  djb2 hash, dedupe of back-to-back identical writes, cap 10 (drop oldest),
  listFileVersions + restoreFileVersion (restore is itself recorded). History
  popover in ProjectFileWorkspace.tsx (ClockCounterClockwise button, timestamps
  newest-first, "Restore this version" buttons). 8 new tests with store-aware
  fake IDB (multi-store + onupgradeneeded); covers accumulate, cap, restore,
  per-path isolation, v1→v2 upgrade. 8/8 pass.
- Item 2 ALREADY SATISFIED on main: DesignTeamWorkspace.tsx:174-188 honesty
  banner landed today in ef79c4166 ("Preview — collaboration is not wired up
  yet... mock data"). Plain Register 1, in-tab. No new code needed; verified.
- Item 3 DONE: audit found HTML path sound (no allow-same-origin, srcDoc,
  storage shim) but REAL hole: SVG + Markdown renderers injected artifact
  markup into host document via dangerouslySetInnerHTML. Fixed in code: both
  now route through the sandboxed HTMLRenderer iframe. New
  ArtifactRenderer.test.tsx (4 tests: no allow-same-origin for all types,
  svg/md in iframe, shim idempotence). DESIGN.md §11 "Artifact sandbox" added:
  enforced vs advisory (CSP NOT set, egress not blocked — follow-up issue to
  file with gh).
- Verification: pnpm typecheck 0 errors; vitest src/lib/design src/shell
  src/views/design 82/82 across 14 files (baseline 66/12; +8 mine, +8 from
  concurrent fedesign merge).

## Next
- Commit, push, PR, merge --merge. File CSP follow-up gh issue. release-preflight.
- Desktop rebuild (bin copy + npm run dist background), bundle grep, DMG swap.
- Ledger branch + summary + PR + merge. Cleanup.

## Open questions
- None.
