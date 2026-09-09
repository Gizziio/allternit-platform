# Steering checkpoint — session/relfix6-20260908

## Goal
Get the `desktop-v1.1.1` release tag to a green CI run (repo Gizziio/allternit-platform). Run 10
failed preflight before any build: the workflow still referenced the deleted Python/PyInstaller
voice tree (PR #194 voice-cleanup) and had no step producing the REQUIRED `whisper-cli` sidecar.

## Just did
- Merged origin/main (`0e923fe3a`+) into the session branch.
- Replaced both PyInstaller voice steps in release-desktop.yml with cargo builds of the Rust
  voice crate (`cargo build --release -p voice-service`, lipo universal on macOS →
  `resources/bin/allternit-voice-service`, `.exe` copy on Windows), plus whisper-cli sidecar
  steps (macOS: `services/voice/build-whisper.sh`; Windows: clone whisper.cpp + cmake with the
  VS2022 toolset already installed via choco).
- Updated scripts/release-preflight.mjs: dropped the three deleted python paths from the
  implicit existence list (added services/voice/Cargo.toml + build-whisper.sh), replaced the
  PyInstaller/Python-pin toolchain check with a "job cargo-builds voice-service" check, and
  noted the run-11 update in the header.
- Verified: `node scripts/release-preflight.mjs` → 26 passed, 0 failed. Local
  `cargo build --release -p voice-service` running to confirm the bin name (`voice-service`).

## Next
- Confirm local release build produces target/release/voice-service.
- Commit, push, PR, `gh pr merge --merge`; repoint the desktop-v1.1.1 tag to the new main;
  confirm run 11; re-arm the */9 monitor cron with the new run id.
- On green: final report (release URL, install-over-/Applications reminder, unsigned note),
  ledger attestation (runs 1–11 + deferrals), then cleanup (worktree, branch local+remote, cron).

## Open questions
- Windows whisper-cli cmake build is untested on the runner (cmake is preinstalled on
  windows-latest; VS2022 via choco). If it fails, fallback: ALLTERNIT_ALLOW_MISSING_WHISPER
  opt-out mirroring local-engine, recorded as a deferral.
