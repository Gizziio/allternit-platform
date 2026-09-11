# Session bbf3793b — ACI Allternit Office extraction (kimi-code)

**Date:** 2026-09-11 · **Agent:** kimi-code · **Branch:** `session/bbf3793b` · **PR:** #338 → merge `ab3f4eab4`

## What was done

ACI-mode restructure of the Allternit office surface (owner-requested):

- **ACI Extensions**: ACI rail tab "Office & Extensions" renamed to **ACI Extensions**; the `OfficeSuiteSection` office block removed from `BrowserExtensionsView` (extensions manager only; "Browser Extensions" wording swept). Internal view id `browser-extensions` deliberately unchanged (label-only rename; id appears in 11+ files incl. the desktop main-process bridge — full id rename deferred).
- **Allternit Office window**: `/office` route resurrected as `OfficePage` → `OfficeDesktopView` (new), hosting the suite in a popped-out Electron window mirroring the Design window profile line-for-line (1440×960, min 960×640, `hiddenInset` titlebar, `trafficLightPosition {x:16,y:16}`, `backgroundColor #0F0C0A`, sandboxed preload, will-navigate guard, window-open deny→external). The 56px header (`DesignModeView`'s exact inline styles) carries the **A://TERNIT OFFICE wordmark** via `AProtocolWordmark suffix="OFFICE" theme="adaptive"` (`office-wordmark` testid).
- **Electron plumbing**: `shell:open-office-window` handler in `unified-main.ts` (officeWindow module var, reuse-focus branch), preload `shell.openOfficeWindow`, `lib/open-office-window.ts` (web fallback: `window.open('/office')`), `globals.d.ts` declaration.
- **ACI bottom rail** (`ShellRail`): in `browser` mode only, the footer Design button becomes **Allternit Office** — full wordmark at height 10 when sidebar labels are on (~180px, fits the 248px rail; wordmark replaces the text label), collapsed A:// mark at 16px when labels are off. The `MoreDropdown` Design item swaps likewise via new optional `designLabel`/`designIcon` props. `ShellApp` wires `onOpenOfficeWindow`. Home/Code modes untouched.
- **Open behavior**: office cards in the window open editors in the MAIN window via the existing `shell:open-office` bridge (docs/sheets/slides/pdf/markdown with artifactId); handoffs (per-renderer in-memory file-handoff store) and bridge-incapable targets (`sign`, `markdown-preview`) navigate inside the office window itself.
- **Routing/bridge**: `desktop-bridge` `launcher` target → `openOfficeWindow()` (was: select ACI Extensions hub tab). App menu "Allternit Office" (`openOfficeTarget('launcher')`) now opens the window. `DocumentsView` points at Allternit Office. Docs (`office-suite.mdx`, `OFFICE_TARGET_MACHINE_SETUP.md`) + stale comments (office-programs.ts, ShellApp, routes.tsx, OfficeSuiteSection, ExtensionCard) updated.

## How it works

The office window loads the platform origin's `/office` (local static export in prod, Vite dev URL in dev) — no remote origin, no security-config changes. `OfficePage` mirrors `DesignPage`'s provider stack (Tooltip/Voice/Mode(browser)/Session/GlobalDropzone). Editor handoffs stay on the main window so the single-window shell model from PR #203 is preserved.

## Verification evidence

- Desktop `npm run typecheck` + `npm run build` (main/preload/auth): PASS.
- Desktop vitest: 125/125 (18 files).
- Platform vitest (`src/views/office`, `src/shell`): 20/20.
- Platform `typecheck:fast`: zero errors in touched files; pre-existing unrelated errors remain on main (`packages/@allternit/office-{pdf,sheets,slides}-app` asset module declarations, `harfbuzzjs`, `UnifiedTerminal` css import, `FabricSessionPanel` comparison).
- `node scripts/release-preflight.mjs`: **35 passed, 0 failed** (was 26 checks at commandment-writing time; script has since grown).
- Playwright chromium: **13/13** — `aci-extensions-view` (tab rename/extensions-only/footer swap/popup flow) 4, `office-launcher` (wordmark header, cards, docs editor, pdf handoffs) 5, `office-markdown` (rtf→preview, docx routing, save-as-artifact, url→markdown) 4. Office engine served from a scratch `:8099` (`OFFICE_ENGINE_PORT=8099 pnpm dev`, anydoc 0.1.6 confirmed in /health).
- Merge conflict with main (another session had added the same `AProtocolWordmark` import to `ShellRail`): resolved by dropping the duplicate; re-typechecked clean; shell vitest 20/20 re-run post-merge.

## Incidents / honest deferrals

- **Playwright browser**: the pinned chromium-1208 download stalled twice (~1.5MB in 25 min; CDN slow from this machine). Ran via a scratch config pointing `executablePath` at the already-cached chromium-1234 headless shell (same workaround as the 2026-09-09 office-dedup session). Scratch config deleted after the runs. First cold-cache parallel run flaked 3 pdf tests (worker contention); all passed warm and at `--workers=2`.
- **Desktop Electron e2e** (`npm run test:e2e`) NOT run locally: requires the full packaged app and the single-instance lock is held by the owner's running desktop app; launcher-path change covered by updated `office-windows.spec` (expects a `/office` window) and CI.
- **Initial full parallel Playwright run** failures were environmental (browser missing / cold-server contention), not product bugs — root-caused before proceeding.
- Desktop DMG rebuild from merged main ran per ritual step 8 (sidecars copied from the shared checkout's `resources/bin/`; unsigned `CSC_IDENTITY_AUTO_DISCOVERY=false`).
- The shared `allternit-desktop-preview` checkout is on a detached HEAD with another session's uncommitted manifest edits — left untouched per worktree-ownership rules; attestation lands via this ledger branch instead of a direct main commit.
