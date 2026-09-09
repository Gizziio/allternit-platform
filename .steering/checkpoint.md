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

---

<!-- merged checkpoint from branch ao/allternit-runtime-fork (P0 engine fork, completed 2026-09-09) -->

# Steering checkpoint — ao/allternit-runtime-fork (P0)

## Goal
Phase P0 of the ao v3 engine fork (queue rq-20260908-028, decision fork_reskin): vendor herdr v0.9.0 into `infrastructure/executor/ao-engine/`, gut the herdr.dev phone-home surface, build as `ao` binary, keep diff mergeable with upstream. Spec: docs/ALLTERNIT_RUNTIME_MAP.md + docs/ALLTERNIT_RUNTIME_P0_TASK.md.

## Just did
- Vendored herdr v0.9.0 (SHA b99002ac99b09e00b4ca692436cb15a6b0d676f1) into infrastructure/executor/ao-engine/ (src/, tests/, vendor/ incl. patched portable-pty + libghostty-vt, build.rs, LICENSE, build-referenced assets/docs/skills). Excluded .git, rust-toolchain.toml (conflict documented).
- Workspace wiring: member added; `[[bin]] name = "ao"`; portable-pty [patch.crates-io] at workspace root (version-specific 0.9.x, other members on 0.8 unaffected).
- Gut list applied: update.rs trimmed to residue (Version + pkg-manager path detection, no network); product_announcements.rs deleted + wiring neutralized (UI/API surface left inert); manifest_update.rs remote catalog fetch removed (offline local-cache verification; local override cache mechanism kept); remote/attach.rs release-asset download from herdr.dev manifests removed (offline error with HERDR_REMOTE_BINARY guidance); `herdr update` + `herdr channel` subcommands removed.
- Remaining herdr.dev hits: comments/docs + `herdr:devin` protocol identifier only (grep evidence pending in build evidence step).
- THIRD_PARTY_NOTICES.md herdr entry added.

## Next
- DONE: final commit (docs/ALLTERNIT_RUNTIME_P0_NOTES.md) + push. P0 complete; NOTES is the deliverable sentinel.

## Open questions
- RESOLVED: katakana test regression was workspace dep drift, not the gut — ratatui-core 0.1.2 breaks it (bisected; ratatui 0.30.2/line-clipping 0.3.8/unicode-segmentation 1.13.3/compact_str 0.9.1 all PASS). Pinned ratatui =0.30.0 + ratatui-core =0.1.0 in ao-engine; test passes in-workspace now.
- RESOLVED: unit-suite SIGPIPE death is pre-existing — pristine herdr v0.9.0 (built standalone, rustc 1.94.1) dies identically (signal 13 after ~2185 ok; also env failure plugin_link_creates_stable_config_and_state_dirs which passes in isolation). Documented, not fixed (out of scope: unrelated pre-existing breakage).
- rustc 1.94.1 compiles herdr 0.9.0 cleanly; the 1.96.1 pin is not needed. zig 0.15.2 required (ZIG env var or PATH; /opt/homebrew/opt/zig@0.15/bin/zig).
