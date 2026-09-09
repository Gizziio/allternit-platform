# Checkpoint — session/office-agent-ui (agent-22, 2026-09-09)

## Task: office-agent-ui (consolidate Allternit Office UI, full repo ritual)

Worktree: `~/Desktop/allternit-workspace/allternit-session-office-agent-ui`, branch `session/office-agent-ui` from origin/main @ fcf42e286.

## The 7 items
1. One chat pane only — remove "Built-in" tab from editor AI panel.
2. Rename all user-facing "Allternit Assistant"/"Allternit AI" strings in office suite + 4 vendored apps to "Allternit Office Agent". Do NOT rename platform-wide refs.
3. Real brand icons (AProtocolWordmark / favicon.svg) for panel + chat icon, not phosphor.
4. Wire dead "AI Summarize"/"AI Polish" ribbon buttons through the assistant pipeline (activeDocument registry, PR #188) with streamed reply in agent pane. Fix icons. Sheets/slides/pdf: wire or remove equivalents.
5. Collapsed-rail collision fix in FloatingWidgets.tsx (top row spacing vs collapsed-rail icons).
6. Same setup across docs/sheets/slides/pdf apps.
7. Remove OfficeLauncherView embeds from DocumentsView + DesignModeView; delete component if unused.

## Progress
- [x] worktree created at origin/main fcf42e286
- [ ] scouting reads
- [ ] tasks 1–4 + 6 (suite + vendored apps)
- [ ] task 5 (collapsed rail)
- [ ] task 7 (launcher embeds)
- [ ] verify: typecheck, vitest, vite build, playwright smoke
- [ ] PR → merge → ledger → cleanup

## Guardrails
- Never edit shared checkout allternit/ or other sessions' worktrees.
- Don't regress PR #188 (activeDocument, assistant panel model-id logic).
- PR merges conflict only ever on .steering/checkpoint.md → checkout --ours.
- Desktop electron e2e defer if owner's app is running.

## Update 10:20
- All 7 tasks implemented in worktree.
- Task 5 root cause measured: office ribbons drop their tab row to y=44 when
  html[data-rail-collapsed] (shell attribute), but RailControls rendered a
  second fixed row (Agents mascot pill) at top-[52px] x∈[4,40] which landed
  on the ribbon tab row (y∈[50,85]). Fix: mascot folded into the single 44px
  controls row (FloatingWidgets.tsx). Verified: controls+ mascot x[0,124]×y[0,44],
  ribbon tabs y≥50, no overlap; src/shell vitest 20/20.
- vite.config.scratch-verify.ts (leaked to main from PR #203) deleted.
- design-view-docs route + design rail Documents entry + nav types/policy removed.
- office-ai.spec.ts: tool-execution e2e REMOVED (built-in sheets tool panel
  unreachable on extension-registered hosts); streaming tests rewritten to the
  agent pane. New office-agent.spec.ts: single-pane assertion + Summarize wiring
  (prompt + document context + streamed reply).
- Verify in flight: platform build (bg), playwright office-launcher+office-agent (bg).
