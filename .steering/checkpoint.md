# Steering checkpoint — session/cu17-batchgate

**Goal:** P1 of spec `stagehand-batch-fork` — batch grant gate (Rust), gateway-routed sidecar inference + Browserbase URL scrub, ActionIntent coverage (dialogs/tabs/files) + screenshot hashing. Three slices + fix, then PR + ledger attestation.

**Done:**
- Slice 1 `5bc039aa2`: Rust batch grant gate (`aci_batch.rs`), sidecar `actBatch`. Tests 19/19; aci suites 51→70.
- Slice 2 `f49d2bf5c`: gateway-routed sidecar inference (mock|gateway modes, A://C default, fail-closed) + Browserbase URL scrub (grep-clean built artifact). Smoke 6/6, typecheck/build green.
- Slice 3 `a74d8bfa9`: ActionIntent coverage (tab.open/focus/close, dialog.accept/dismiss via host CDP, file.upload with sandbox containment, download listing) + screenshot SHA-256 at capture. Smoke 11/11; @allternit/browser vitest 89/89.
- Fix `1990fd8f0`: sidecar client deadline loop (found by live smoke).
- Verification: cargo aci 70/0; runtime typecheck+build green; smoke 11/11; vitest 89/89; **live gated-batch smoke 11/11** (grant→approve→execute on local page→receipt correct; replay/tamper denied; halt position recorded); release-preflight 35/0 (script now has 35 checks, all pass — untouched release path).

**Next:** push branch, `gh pr create` with evidence, wait checks, `gh pr merge --merge`, record PR + SHA. Then ledger attestation via detached worktree from origin/main + push HEAD:main, remove worktree, delete session branch local+remote.

**Open questions:** none.
