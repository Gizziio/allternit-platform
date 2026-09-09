# Desktop v1.1.1 release repair — session/relfix6-20260908

**Agent:** kimi-code · **Date:** 2026-09-09 · **Branch:** `session/relfix6-20260908`
**Outcome:** `desktop-v1.1.1` release published after 14 CI runs (11 of them repair rounds). Release: https://github.com/Gizziio/allternit-platform/releases/tag/desktop-v1.1.1

## Why

Desktop v1.1.0 shipped bundled `allternit-api`/`gizzi-code` binaries built ~1 hour before the native-sessions feature merged, so session pickup was broken in the desktop app. v1.1.1 republishes with fresh backends. The release night (2026-09-09) then burned 13 failed/cancelled runs on a chain of unrelated CI breakages, each only visible after the previous one was fixed — exactly the failure mode the repo's later `scripts/release-preflight.mjs` (added mid-incident by a parallel session) now guards.

## Repair rounds (merged PRs from this session)

Earlier rounds (from the compacted prior session window): #156 bun.lock→pnpm root install, #159 Rust 1.94.1 toolchain + protoc, #162 vendored openssl, #163 windows-latest + VS2022 choco + node heap, #165 win32-x64 target + protoc brew/choco, #166 pnpm desktop-deps step + `cfg(unix)` gating, #169 rails UDS peer transport gating, #175 unconditional `tracing::warn` import, #182 notarize loud-skip when no Apple secrets, #193 cross-platform prepare-office-addins, #197 `shell:true` npm spawn fix.

This window:

- **PR #199 → `37ead7188`** — run 10 failed the new Release preflight with 6 findings: the workflow still referenced the deleted Python/PyInstaller voice tree (voice-cleanup PR #194 deleted `services/voice/api`, `services/voice/voice`, the pyinstaller spec while PR #198's workflow steps referencing them merged in parallel), and no step produced the REQUIRED `whisper-cli` sidecar. Fix: replaced both PyInstaller steps with `cargo build --release -p voice-service` (lipo universal → `allternit-voice-service`; `.exe` on Windows), added whisper-cli steps (macOS `services/voice/build-whisper.sh`; Windows whisper.cpp + cmake with the choco VS2022 toolset). Updated `scripts/release-preflight.mjs` accordingly. Verified: local `cargo build --release -p voice-service` produced `target/release/voice-service` (3.6 MB); preflight 26/0.
- **PR #200 → run-11 fix** — Build Linux died in the gizzi-code worker bundle: the voice service's dynamic `import('audio-capture-napi')` could not be resolved. Root cause: Bun.build does not apply tsconfig `paths` to dynamic imports. Fix: `bundlePlugin.onResolve` in `cmd/gizzi-code/script/build-production.js` mapping `audio-capture-napi` → the committed throwing stub (same pattern as `@allternit/extension`). Verified by local repro + full `bun run script/build-production.js --target=darwin-arm64` (172 MB binary, `--version` 2.0.7).
- **PR #202 → run-12/13 fix** — Build Windows deps install: node-gyp `Could not find any Visual Studio installation to use` while compiling better-sqlite3. Root cause: windows-latest image now also ships **VS18**, which node-gyp 11.x reports as "unknown version", and its PowerShell auto-detection crashes with a maxBuffer RangeError before considering the choco-installed VS2022 toolset. Fix: `GYP_MSVS_VERSION: "2022"` env on the Windows deps-install step (node-gyp then goes straight to vswhere for 17.x).
- **PR #207 → run-13/14 fix** — Build Windows reached NSIS and died: `cannot find specified resource "build/LICENSE.txt"`. The file is referenced by electron-builder `extraFiles` + `nsis.license` but was never committed — `build/` is gitignored at root, and macOS dmg only warns about the miss. Fix: `.gitignore` negation for `surfaces/allternit-desktop/build/` (merged alongside a parallel session's libghostty-vt `build/` negations) + committed `build/LICENSE.txt` (MIT text per root package.json).

## Run history (release-desktop.yml @ desktop-v1.1.1)

| Run | Result | Blocker |
|---|---|---|
| 1–9 | failure chain | see earlier rounds above (toolchain, openssl, addins, npm.cmd shim…) — macOS green runs 8–9, Windows reached packaging run 9 |
| 10 `34324094223` | preflight fail (6 findings) | deleted voice python tree + missing whisper-cli → PR #199 |
| 11 `34325636354` | Linux fail | audio-capture-napi dynamic import → PR #200 |
| 12 `34326880923` | Windows fail | node-gyp VS18 detection crash → PR #202 (macOS+Linux green) |
| 13 `34332678495` | Windows fail | NSIS missing build/LICENSE.txt → PR #207 (all prior Windows steps first-time-green: whisper-cli cmake, voice-service cargo) |
| 14 `34338164000` | **SUCCESS + release published** | — |

## Verification evidence

- Run 14: all jobs green incl. `Create GitHub Release`. Assets: `Allternit-Desktop-1.1.1-arm64.dmg` (551 MB), `-x64.dmg` (557 MB), both `.zip`s, `Allternit-Setup-1.1.1.exe` (394 MB), blockmaps + `latest-mac.yml`/`latest.yml` auto-update manifests.
- `node scripts/release-preflight.mjs` green (26/0) after every workflow change.
- Local production build of gizzi-code (`darwin-arm64`) passes post-fix; binary runs.

## Honest deferrals

- **DMG is unsigned/unnotarized** (no Apple secrets in the repo — by owner's decision, PR #182 makes notarization skip loudly). Users must right-click → Open on macOS.
- **Windows installer is unsigned** (no code-signing cert in CI).
- **Windows**: no `/terminal` routes (mux is UDS-only) and no UDS peer push (HTTP inbox polling fallback) — pre-existing platform gaps, unchanged by this release.
- **Windows local-engine sidecar** still opted out via `ALLTERNIT_ALLOW_MISSING_LOCAL_ENGINE=1` (crate has unix-only deps; 1.1.0 shipped without it too).
- **Linux desktop job** invokes electron-builder directly (no prepare-platform-static gate), so its artifacts ship without voice/local-engine sidecars — non-blocking, noted in preflight output; Linux artifacts are a smoke test, not published.
- Native `audio-capture-napi` is never bundled (stub always routes voice capture to the sox/arecord fallback); bundling the real native module is future work.
- whisper-cli model `ggml-tiny.en.bin` is downloaded at runtime from huggingface, not bundled.

## User action

Install `Allternit-Desktop-1.1.1-arm64.dmg` over `/Applications/Allternit Desktop.app` so the bundled backend (allternit-api + gizzi-code) picks up the native-sessions routes.
