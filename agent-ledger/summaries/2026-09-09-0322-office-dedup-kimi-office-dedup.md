# Session office-dedup — retire the standalone office suite — 2026-09-09

Agent: kimi-code (subagent, agent-22) · Branch: `session/office-dedup` · PR #203 → merge `c3c10894e`

## What was done

Owner-confirmed dedup: the shell's ACI "Office & Extensions" hub (`browser-extensions` view →
`BrowserExtensionsView` → `OfficeSuiteSection`, in-shell `docs`/`sheets`/`slides`/`pdf` views) is
the SINGLE office surface. Removed the duplicate standalone suite:

**Desktop (`surfaces/allternit-desktop`)**
- Deleted the per-program office BrowserWindows: `officeWindows` map, `openOfficeWindow`,
  `resolveOfficeUrl`, window-opening in `openOfficeWithFile`/`openDocsWindow`.
- All office opens (tray menu, "Open with Allternit" file associations on macOS `open-file` /
  Windows `second-instance` / cold-start argv, `shell:open-office` + `shell:open-docs` IPC,
  `ALLTERNIT_OPEN_DOCS_ON_START`) now focus the main window and deliver over preload channels:
  existing `office:open-file` (`{name, bytes}`) + new sibling `office:open-target`
  (`{target, artifactId}`) exposed as `office.onOpenTarget` in `src/preload/index.ts`.
  Deliveries queue (`pendingOfficeDeliveries`) and flush on the main window's
  `did-finish-load` (registered in `createMainWindow`) so cold-start opens can't drop.
- Tray "Allternit Office" submenu → single item opening the hub (`launcher` target).
- `office-programs.ts` kept as pure helpers (`editorForFile`/`extractOfficeFileArg`/
  `isOfficeTarget` still drive routing); `officePathFor` still exported + unit-tested.

**Platform (`surfaces/ai.allternit.com`)**
- `desktop-bridge.ts`: file-open approach = **in-shell view with route fallback** — when ShellApp
  is mounted (`/` or `/shell`) deliveries dispatch `allternit:open-view` with
  `handoffId`/`artifactId` context (ShellApp already listens; registry views accept the
  context); otherwise navigate to the editor route with handoff state. `launcher` →
  `browser-extensions` hub (fallback `/`). Chosen over pure route navigation because the shell
  is the mounted surface in the normal desktop flow and keeps rail/hub context.
- Removed `/office` route + `src/pages/OfficeLauncherPage.tsx`; `/office` now redirects to `/`
  (old bookmarks/desktop shortcuts don't 404). `OfficeLauncherView.tsx` kept for the
  cowork/design embeds (out of scope, untouched). Editor routes + PR #191 OfficePageChrome kept.

**Tests**: desktop `office-windows`/`docs-window` specs rewritten for main-window in-shell
delivery (addInitScript seeds the onboarding key); platform `office-launcher.spec` → `/office`
redirect + hub flows via new `tests/helpers/office-hub.ts`; `office-markdown.spec` repointed
through the hub (route assertions dropped — in-shell opens don't navigate); hub pdf tests use
`getByText('hello.pdf').first()` (strict-mode, 3 in-shell matches). `office-suite.mdx` updated.

## Files changed

- `surfaces/allternit-desktop/src/main/unified-main.ts`, `src/preload/index.ts`,
  `tests/office-windows.spec.ts`, `tests/docs-window.spec.ts`
- `surfaces/ai.allternit.com/src/routes.tsx`, `src/views/office/desktop-bridge.ts`,
  `src/pages/OfficeLauncherPage.tsx` (deleted), `tests/office-launcher.spec.ts`,
  `tests/office-markdown.spec.ts`, `tests/helpers/office-hub.ts` (new)
- `surfaces/docs/surfaces/office-suite.mdx`

## Verification

- Desktop `pnpm run typecheck` (main+preload): PASS. `vitest office-programs`: 5/5.
- Platform `pnpm run typecheck`: PASS. `vitest src/shell src/views/office`: 20/20. `vite build`: PASS.
- Playwright chromium: office-launcher + office-markdown specs **9/9 PASS** (~20s warm). Ran via
  a scratch config (`executablePath` → complete chromium-1234 build, private port 5199) because
  the shared ms-playwright cache for the pinned 1208 rev was mid-repair by session webmcp-play
  and port 5177 was serving that session's dev server (reuseExistingServer). Scratch config
  deleted after the run.
- Desktop electron e2e NOT run locally: the owner's desktop app (Allternit-Desktop-fresh.app)
  holds the `requestSingleInstanceLock`, so the test instance exits instantly ("Process failed
  to launch", verified). Left the owner's app running; specs compile and run in CI.

## Incidents / notes

- PR #203 conflicted once (another session merged mid-flight); only `.steering/checkpoint.md`
  conflicted — resolved keeping this session's checkpoint.
- First cold playwright run flaked on the two pdf handoff tests (heavy vendored module graph);
  warm runs pass — noted as cold-start flake, not a regression.
- Pre-existing e2e noise (unrelated): Clerk key warning, 403 agent-seed calls vs dev gateway,
  CORS on :8013 peers API.

## Deferrals

- Desktop electron e2e local run (single-instance lock held by the running production app; CI-covered).
- Platform playwright.config `reuseExistingServer`/`5177` collision with concurrent sessions
  not changed (would alter CI behavior).
