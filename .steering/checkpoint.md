# Steering checkpoint — session/5c233b1c

## Goal
Phase 2 follow-up of spec bot-identity-computer (user-directed, 2026-09-09): (1) remove the
replaced bot-creation path in CreateAgentForm (bot mode + forge theater) since CreateBotForm
is canonical; (2) size presets UI on the Create Bot Computer step; (3) fleet "provision
computers" action on the Bots hub; (4) watch/takeover desktop UX polish.

## Just did
- All four items implemented and verified: 432/432 tests in src/lib/bots pass (incl. new
  fleet-provision + size-preset tests); typecheck zero errors in touched files (15 total,
  all pre-existing env issues vs main's 24).
- Fixed a real crash: `BotDesktopStatus` type lacked `'creating'`, so the statusBadge lookup
  at BotComputerViewport would throw while a desktop is provisioning. Type widened + badge +
  provisioning panel added.
- Big Five sliders KEPT in agent creation: agent.service.ts:1511 reads config.personality at
  runtime, so they are runtime-effective, not theater. Only bot-mode duplication + forge
  animation removed. VMOperatorStep kept in EditAgentForm.

## Next
1. Commit, push, PR, merge (expect checkpoint.md conflict with main — keep mine).
2. Ledger attestation on main; queue history event + dashboard; brain draft (no confirm).
3. Remove worktree + branch; verify clean state.

## Open questions
- None blocking. Honest deferral: no live Incus desktop was booted; watch/takeover changes
  verified by static analysis, not a runtime repro.
