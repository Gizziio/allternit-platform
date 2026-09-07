# Steering checkpoint

Goal: Cut gizzi-code 2.0.7 — ship the onboarding auto-pick-brain change (plus the two pre-existing breakage fixes) as a tagged release, same flow as 2.0.6: version bump commit → tag `gizzi-code/v2.0.7` → CI publishes npm + GitHub assets → homebrew tap bump → owner machine upgrade.

Just did: Created worktree `allternit-session-gc-207` on branch `session/gc-207` from origin/main `05e9c0c9f`. Bumped 2.0.6 → 2.0.7 in all five versioned spots (cmd/gizzi-code/package.json, cli-package/package.json, cli-package/install/gizzi.rb, debian control, rpm spec + spec %changelog), mirroring commit c2e0d543c (the 2.0.6 bump). CHANGELOG: Unreleased content moved under `## 2.0.7 — 2026-09-06` with a Fixed section for the feature()-macro and native-sessions TS2552 fixes.

Next: Commit → push branch → fast-forward main → tag `gizzi-code/v2.0.7` → push tag → watch release CI → update homebrew tap formula sha256s → upgrade owner's installed binary → ledger + cleanup.

Open questions: None.
