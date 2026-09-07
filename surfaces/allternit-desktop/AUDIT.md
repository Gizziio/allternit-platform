# Allternit Desktop Audit

> **STATUS: Partially superseded (2026-09-03).** This is a point-in-time
> snapshot from 2026-07-03. For the current production-readiness assessment,
> see [`reports/2026-09-03-production-readiness-gap-analysis.md`](../../reports/2026-09-03-production-readiness-gap-analysis.md).
> Known-stale items below: the "No bundled services" model (the app now
> bundles sidecar binaries — see `ARCHITECTURE.md` and `BUILD.md`), and the
> build/typecheck table (commands have since gained `prepare:*` prerequisites).

Date: 2026-07-03
Auditor: Kimi Code CLI
Scope: `surfaces/allternit-desktop` — Electron shell for the Allternit platform.

## Build / Typecheck Status

| Check | Command | Result |
|-------|---------|--------|
| Typecheck (main) | `tsc --noEmit -p src/main/tsconfig.json` | PASS |
| Typecheck (preload) | `tsc --noEmit -p src/preload/tsconfig.json` | PASS |
| Build | `npm run build` | PASS |
| Electron dev | `npm run dev` | NOT RUN (requires built/pre-built native deps) |
| Packaged build | `npm run build:electron` | NOT RUN (requires `prepare:platform-static`, `download:lima`, signing/notarization) |

## Architecture Summary

- **Main process**: `src/main/unified-main.ts` (~2440 LOC) + managers in `src/main/`.
- **Preload**: `src/preload/index.ts` (~513 LOC) exposes `window.allternit` and `window.allternitSidecar`.
- **Renderer**: Loaded from remote `https://ai.allternit.com` in production, or `http://localhost:3013` in dev. Local static fallback to `http://localhost:8013` if remote is unreachable.
- **Modes**: bundled (local backend auto-managed), remote (user VPS), development (localhost:4096).

## Feature Inventory

### Implemented

| Feature | Location | Notes |
|---------|----------|-------|
| Splash window | `unified-main.ts` | Inline HTML, service status UI, auth gate |
| Main window | `unified-main.ts` | Bounds persistence, event forwarding, protocol handler for `allternit-api://` |
| Backend manager | `backend-manager.ts` | Install/update/start local Rust backend |
| Gizzi runtime | `gizzi-manager.ts` | AI runtime on port 4096 |
| VM / Lima | `lima.ts` | Lima VM download/install/start/stop/status |
| Auth | `auth-manager.ts` | Session, accounts, sign-out |
| Tunnel (Cloudflare) | `tunnel-manager.ts` | Enable/disable web access |
| Tray | `unified-main.ts` | Tray menu, minimize-to-tray |
| Theme | `unified-main.ts` | Light/dark/system |
| Window controls | `unified-main.ts` | Minimize, maximize, fullscreen, bounds, etc. |
| Store / persisted state | `persisted-state.ts` | electron-store wrapper |
| Feature flags | `feature-flags.ts` | Runtime flag manager |
| Permission guide | `permission-guide.ts` | macOS Accessibility / Screen Recording onboarding |
| Extension bridge | `unified-main.ts` | Native messaging host socket relay |
| MCP host | `mcp-host-manager.ts` | MCP server management |
| Mini apps | `mini-apps-manager.ts` | Install/start/stop/status |
| Notebook manager | `notebook-manager.ts` | Notebook lifecycle |
| Worker bus | `workers/worker-bus.ts` | Renderer → main → worker round-trip |
| Office host detection | `unified-main.ts` | Word/Excel/PowerPoint installed/running status |
| Menu bar / startup on login | `unified-main.ts` | macOS menu-bar mode and login-start |
| Find in page | `unified-main.ts` | WebContents find API wrapper |
| Locale | `unified-main.ts` | get/set locale |
| HyperFrames | `unified-main.ts` | check/render (delegates to manager) |
| Research backend | `unified-main.ts` | start/stop/status |

### Stubbed / Partial

| Feature | Location | Gap |
|---------|----------|-----|
| Chrome side-by-side embed | Removed from preload/main (2026-07-03) | Was advertised but unimplemented; removed until `chrome-embed/` wiring is ready. |

## IPC Contract Check

- 94 preload API calls.
- 97 main-process handlers across `src/main/`.
- All preload calls have matching handlers.
- 3 handlers are internal and not exposed in preload (expected): `app:quit`, `mini-window:hide`, `mini-window:toggle`.

## Potential Issues / Risks

1. **Remote platform dependency**: Production loads `https://ai.allternit.com`. If that domain is down or unreachable, the app falls back to local static UI served by the Rust API. The fallback path needs verification.
2. **Hard-coded ports**: 8013 (API), 4096 (gizzi), 3013 (dev UI) are scattered across source. Should be centralized in config.
3. **macOS-only permissions**: Accessibility/Screen Recording guide is macOS-centric. Windows/Linux paths are not covered.
4. **Lima bundling**: `download:lima` script and `resources/lima/` are macOS/Linux VM tooling; Windows story is unclear.
5. **No unit tests**: No test suite for main/preload logic.
6. **Large main process file**: `unified-main.ts` is 2440 LOC and mixes window management, IPC wiring, backend orchestration, and inline HTML. Consider splitting further.
7. **Chrome embed stub**: Advertised in preload but not implemented.
8. **Build artifacts**: `dist/` is checked in (generated files), which can cause drift. Should be gitignored and produced by CI.

## Recommendations

1. ~~Implement Chrome embed or remove the API from preload until ready.~~ Done: removed from preload and main IPC.
2. Centralize port/configuration constants.
3. Add a smoke test that starts Electron in CI with `--disable-gpu` and verifies the splash window loads.
4. Gitignore `dist/` and `release/`; build them in CI.
5. Verify the offline fallback path (`http://localhost:8013` static UI) end-to-end.
6. Document Windows/Linux equivalents for Lima/permissions.
7. Add `@allternit/desktop` to the root workspace or CI so it builds on every commit.

## Verdict

**Builds and typechecks cleanly.** The desktop shell is feature-complete for the bundled/remote backend model. The only explicit stub is Chrome side-by-side embed. The main risk areas are runtime reliability of backend startup, offline fallback, and cross-platform parity.
