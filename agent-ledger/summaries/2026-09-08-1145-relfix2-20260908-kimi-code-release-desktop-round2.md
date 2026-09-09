# Session attestation — relfix2-20260908 (kimi-code)

**Date:** 2026-09-08 · **Branch:** `session/relfix2-20260908` → PR #159, merge `3c1d7ab51`

## Context

Run 34279647474 (desktop-v1.1.1 after PR #156): the gizzi workspace-install fix
held in all three jobs — failures moved to older bit-rot. Notably `gh release
list` shows NO desktop release has ever published; the pipeline never went
green end-to-end and the installed 1.1.0 app was built locally.

## Fixes

1. **macOS E0463** (`can't find crate for 'core'`, x86_64-apple-darwin target
   missing): workflow installed toolchain 1.91.0 + targets, but repo
   `rust-toolchain.toml` pins 1.94.1 → cargo used 1.94.1 without targets.
   Aligned all three jobs to `dtolnay/rust-toolchain@1.94.1`.
2. **Windows node-gyp `unknown version "18"`**: windows-latest now ships VS2026
   which node-gyp 11.x cannot detect; better-sqlite3 compile failed. Moved the
   job to `windows-2019` (VS2019, supported by node-gyp).
3. **Linux `Could not find protoc`**: added `apt-get install -y
   protobuf-compiler` before the api build (prost-build requirement).

## Verification / status

YAML valid; root-cause evidence from run 34279647474 failed logs
(/tmp/relfail.log). Re-pointed tag desktop-v1.1.1 → run 34281758242; monitor
cron 01M21FCKVQN6VS5HM79B0FX08G reports outcome. Honest deferral: Windows
native-build health on windows-2019 is inferred from the image's VS2019
toolchain, not yet proven by a green run.

## Cleanup

Worktree removed, branch deleted local + remote.
