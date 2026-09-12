# Steering checkpoint

## Session H — surgicaleye-0911 (active)
Session: session/surgicaleye-0911, worktree allternit-session-surgicaleye-0911,
from origin/main @ dc372e2f3. Plan at .steering/plans/plan-surgicaleye-0911.md.

Goal: (1) Click-to-target surgical edit — click an element in the artifact
preview → seeds the SurgicalEditPanel target (mapping doc §3 port #5, shortcut
version of Onlook's DOM↔code binding; postMessage-only over the sandboxed
opaque-origin ArtifactRenderer iframe). (2) `/design [prompt]` command in
gizzi-code → deep-link into A:// Studio (mapping doc §2 row 12).

Just did: worktree created, deps installed, code read (ArtifactRenderer,
SurgicalEditPanel, surgical-edit.ts, DesignModeView, gizzi-code command
registry, desktopDeepLink.ts, desktop protocol handling, /design route).

Next: implement Part 1 (aio-targeting util + renderer wiring + panel seeding +
tests), Part 2 (deep link + desktop main handler + gizzi-code command),
verify (typecheck, vitest, gizzi-code typecheck + production build, preflight),
PR → merge, ledger, desktop rebuild + bundle grep, cleanup.

## Goal (other sessions — untouched below)
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
