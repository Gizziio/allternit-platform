# Steering checkpoint

## Goal
Allternit Office extensions overhaul (worktree `allternit-session-office-ext-20260907`, branch `session/office-ext-20260907`).

## Status — COMPLETE, merge to main in progress
- Phase 0 `761c5ff20` — audit hygiene (typecheck red, CI paths, plugin-registry, stale artifacts/externals, pdfjs 6 + destroy() migration, docs drift, hosting origin decision)
- Phase 1 `40732354d` — native extension slot in `@allternit/office-suite`; Allternit Assistant occupies each app's AI chat section; wired into office.allternit.com + ai.allternit.com platform views (covers desktop Office windows)
- Phase 2 `2964082b9` — MS Office add-in full in-pane AI (mode switch, live document context, real model default), platform.allternit.com/office-addins hosting via Pages postbuild, manifests 1.1.0.0, 143 tests green
- Phase 3 `7a16924d6` — GenOffice copy rename, extensions README refresh, DEPENDENCY_AUDIT note resolved, session attestation + ledger entry
- Final sweep green: desktop typecheck, @allternit/ai typecheck+build, extension wxt build, office-surface typecheck+build, suite typecheck, add-in 143/143 tests + typecheck
- Merged origin/main (153291895) into session branch; conflicts resolved in .steering/checkpoint.md (kept this session's) and agent-ledger/LEDGER.md (union of both sessions' entries)

## Remaining
- Push the merge commit; merge session/office-ext-20260907 into local main (shared checkout currently has another session's staged/unstaged work — merge must be done carefully or deferred to orchestrator); then worktree cleanup per AGENTS.md.

## Flags (unchanged, see attestation)
- Sideload smoke in real Office apps is manual; ARCHITECTURE.md vs settings-panel conflict needs product decision; sdk/allternit-sdk still on pdfjs 5.x (separate owner).
