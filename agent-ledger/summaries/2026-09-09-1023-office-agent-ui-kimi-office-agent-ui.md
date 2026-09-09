# office-agent-ui — session/office-agent-ui (agent-22, kimi-code)

**Date:** 2026-09-09 ~09:30–10:25 · **PR:** #211 → merge SHA `32cffddce` · Branch `session/office-agent-ui` (deleted after merge)

## What was done (owner's 7-item brief)

1. **One chat pane only** — `OfficeAiSlot` (packages/@allternit/allternit-office-suite/src/extensions/OfficeAiSlot.tsx) no longer renders the "Built-in" fallback tab. When a host registers extensions, the agent panes are the only chat surface; with no extensions the app's built-in panel renders exactly as before. The built-in panel is not mounted when extensions exist.
2. **Renamed to "Allternit Office Agent"** — every office-surface string across the suite + four vendored apps: extension descriptor name, panel title, empty state, system prompt, docs ribbon entry + group label (`strings-ribbon.ts` ×19 locales), docs/sheets/slides/pdf built-in panel headers + aria labels + collapsed rails. Platform-wide "Allternit AI" references outside office surfaces were left untouched per the brief.
3. **Real brand icons** — new `AllternitBrandMark` component (suite `src/components/AllternitBrandMark.tsx`): the pixel-A matrix mark from `surfaces/ai.allternit.com/public/favicon.svg` (14×14 cells on an 18-pitch, coral `#D97757` core), `adaptive/light/dark` tones matching `AProtocolWordmark`'s convention. Exported through the suite index + `@allternit/office-suite/bridge` so the vendored apps (which already import the bridge) can render it. Replaces the genspark sparkle badge (`GensparkMark`/renamed copies) in all ribbon AI entries, panel headers, chat panels, and collapsed rails. Summarize/Polish keep their existing functional inline-SVG glyphs (they were never phosphor/genspark).
4. **Wired AI Summarize / AI Polish** — new `assistantPreset` window-event bus (suite `src/extensions/assistantPreset.ts`): `requestAssistantPreset(appKey, instruction)` dispatches `allternit:assistant-preset`; the `AllternitAssistantPanel` subscribes and runs matching requests through the same `run()` path as a typed message. Docs `onAiPreset` (Summarize/Polish + context-menu Editor/Translate/synonyms), sheets `onAiRun` (Check/Analyze), and slides `pushAiPreset` (Beautify/FactCheck/Image) all dispatch alongside their existing built-in wiring, so standalone hosts without extensions are unchanged (event is a no-op with no listener). Document context comes from the PR #188 `activeDocument` registry (name + 4000-char excerpt) via the loop's `buildContext`. Reply streams into the agent pane (`onText`). Sheets/slides equivalents were wired, not removed.
5. **Collapsed-rail collision fix** — reproduced and measured in-browser (Playwright, web shell over in-shell docs editor). Office ribbons already drop their tab row to y=44 when the shell sets `html[data-rail-collapsed='true']` (docs `styles.css`), leaving y[0,44] as the reserved strip. The collision was the **second fixed row**: the "Collapsed Agents mascot pill" at `fixed top-[52px]` (web: x[4,40]×y[52,92]; electron clearance 72) landed on the ribbon tab row (x[12,824]×y[50,85]) covering the File tab / quick-access icons. Fix in `FloatingWidgets.tsx`: the pill is removed and the GizziMascot becomes a button inside the single 44px collapsed-controls row (after the sidebar toggle). After: all collapsed chrome x[0,124]×y[0,44]; ribbon tab row clear. Electron keeps `trafficLightClearance=72` and stays within the same reserved strip.
6. **Same setup across docs/sheets/slides/pdf** — all four vendored apps: `OfficeAiSlot` gained an `expand` prop (each app wires it to its dock/copilot open state) and renders the slot's own branded collapsed rail (`.office-ext-rail`, brand mark, "Expand Allternit Office Agent") instead of relying on the built-in panel's rail; the pdf app's duplicate self-rendered rail button was removed.
7. **Duplicate launchers removed** — `DocumentsView` (cowork) drops the `OfficeLauncherView` embed for a hub-pointer empty state ("Documents live in the Office & Extensions hub" + Open button → `browser-extensions` view), keeping its reusable-workflows section. `DesignModeView` loses the Documents tab (both tab lists, the render block, the lazy import); the `design-view-docs` ViewRegistry entry, design rail config item, and nav.types/nav.policy entries were removed. `OfficeLauncherView.tsx` **deleted** (fully unused — verified zero references; `OfficeLauncherPage` was already gone since PR #203). The ACI hub `BrowserExtensionsView` → `OfficeSuiteSection` embed stays untouched as the single office surface.

Also: deleted `surfaces/ai.allternit.com/vite.config.scratch-verify.ts` — a scratch Playwright config accidentally committed to main with PR #203 (verified unreferenced by any script/workflow before removal).

## Verification evidence

- `pnpm run typecheck` clean: `@allternit/office-suite`, `office-docs-app`, `office-sheets-app`, `office-slides-app`, `office-pdf-app`, platform `tsc --noEmit` (4GB heap).
- vitest: suite package 13/13; platform `src/shell` 20/20.
- `vite build` green (27.8s).
- Playwright e2e (scratch config, chromium via `chromium-1234` executablePath, mocked `/api/agent-chat` SSE, private dev server on port 3013): **18/18** —
  - `office-launcher.spec.ts` 4/4 (incl. `/office` redirect to home)
  - `office-agent.spec.ts` 2/2 NEW (exactly one `.office-ext-tab` = "Allternit Office Agent", zero "Built-in", brand svg in header; Summarize click → enabled with content → user message with the summarize prompt in the pane → streamed reply rendered → request carried the typed document text as context)
  - `office-ai.spec.ts` 4/4 retargeted (docs/sheets/slides/pdf agent composer streams through the transport)
  - `office-extensions-view.spec.ts` 3/3 (design studio asserts the Documents tab is gone)
  - `office-markdown.spec.ts` 4/4 (hub handoffs unaffected)
- Collapsed-rail fix: measured bounding boxes before (pill y[52,92] overlapping ribbon tabs y[50,85]) and after (all chrome y[0,44]); screenshots inspected.

## Incidents

- PR-create heredoc quoting failed once; body written via file instead. No code incidents; no merge conflicts (checkpoint merged cleanly).
- Playwright first run failed 7/7 for a scratch-config bug of my own (missing `baseURL` for relative `page.goto`s) — config fixed, not product code.

## Honest deferrals

- **Built-in sheets `propose_operations` tool execution is no longer reachable** on any platform surface (all register the agent extension, so the built-in panel never mounts). The tool-execution e2e was removed; the vendored code remains for standalone use without the suite host. If the owner wants workbook tools inside the agent pane, that is a new feature (the host `OfficeAgentLoop` already speaks the tool protocol — see office-ai `loop.ts`), not done here.
- **Desktop Electron e2e not run** — the owner's `Allternit-Desktop-fresh.app` holds the single-instance lock (instant launch failure; not killed per standing rule). The changed geometry is the shared `RailControls` code and the reserved-strip CSS applies on desktop too; the 72px clearance path is untouched. Worth one manual glance on the desktop build.
- The built-in docs/sheets/slides/pdf panels still carry "Allternit Office Agent" headers but are now dead code on extension-registered hosts (kept intentionally for standalone hosts; full removal would be a separate cleanup).
- Unrelated dirty `pnpm-lock.yaml` in the shared checkout (another session's) left untouched.
