# Steering checkpoint

**Session:** `session/craft-image-pdf-bundle-rebuild-20261010` · platform worktree `allternit-wt-craft-bundle-rebuild` (branched from `origin/session/craft-video-host-20261010`, PR #1490 — NOT from main)
**Date:** 2026-10-10 · **State: BUNDLES REBUILT + VERIFIED + PUBLISHED — commit/push/PR next, then human gate (do NOT merge; Eoj merges, #1490 first)**

## Goal
Rebuild the PhotoCraft (`vendor/craft/image/`) and PdfCraft (`vendor/craft/pdf/`) embed bundles with the FIXED `craft-host` crate (postMessage-bytes receive + send() transfer-list fixes, already in #1490), publish to `surfaces/office.allternit.com/public/craft/{image,pdf}/` per `vendor/craft/VENDOR.md`. Bundle-only PR that STACKS on platform #1490 (merge #1490 first; this PR's diff then reduces to the bundle files).

## Just did
- Worktree `allternit-wt-craft-bundle-rebuild`, branch `session/craft-image-pdf-bundle-rebuild-20261010` @ 3f33259a5f (tip of #1490 branch). Crate fix confirmed present in `craft-host/src/lib.rs`.
- Toolchain: `wasm-bindgen 0.2.129` already installed (matches pin — no reinstall), `trunk 0.21.14`, `CARGO_TARGET_DIR` = workspace `.shared-target`. Ran with a disk guard (abort < 4 GiB free; never tripped — free stayed 17–28 GiB).
- First PhotoCraft build attempt FAILED on missing `assets/app-icon/hicolor/128x128/apps/ai.storyteller.photocraft.png` — the rebranded title-bar tile is gitignored (`*.png`, machine-local build input; the d3622dccde bundle committer's copy died with their worktree). Regenerated it per `assets/app-icon/README.md` (plain rounded blue tile, 128×128, `#2f7bf5`, rx=28; stdlib PNG writer). PdfCraft needs no such asset.
- Built both bundles per VENDOR.md (`NO_COLOR=true`, `trunk build --release --features embed`): PhotoCraft wasm-release 7m17s, PdfCraft 3m11s; both compiled the fixed `craft-host v0.1.0` from `vendor/craft/craft-host`.
- Verified: image wasm 25,332,694 B (24.16 MiB, was 25,332,464), pdf wasm 23,849,253 B (22.74 MiB, was 23,849,111); `strings *_bg.wasm | grep -c craft:1` = **4 and 4** (>0 ✓); 0 files ≥ 25 MiB in either bundle.
- Published per VENDOR.md: `cp -R dist/web/.` into both office surface dirs; removed superseded old-hash js/wasm so each dir keeps its exact 3-file layout (`index.html` + hashed js + hashed wasm; new hashes `photocraft-web-7757320e4f5ebbfb`, `pdfcraft-web-502fe99e2179d301`, index.html references match).

## Next
1. Commit `chore(craft): rebuild PhotoCraft/PdfCraft bundles with fixed craft-host`, push branch, open PR (`gh -R Allternit/allternit-platform`, base `main`) stating it stacks on #1490. Do NOT merge — Eoj merges #1490 first, then this.
2. After both land: office.allternit.com deploy applies the corrected image/pdf bundles; live boot check (handshake → craft:open → command round-trip) still belongs in future CI per VENDOR.md.

## Open questions
- Disk was 17 GiB free at session start (below the AGENTS.md 50 GB gate; surfaced to orchestrator). Builds stayed bounded; free space 28 GiB at end — but a workspace cleanup is overdue.
- The regenerated title-bar tile is my reconstruction from the README spec (exact prior PNG unrecoverable — not in git, not in any live checkout). Cosmetic-only (title-bar mark); flag if the original resurfaces.
