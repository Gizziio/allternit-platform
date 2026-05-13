# Allternit Design — Agent Handoff Document
**Session cutoff:** 2026-05-09
**Working directory:** `/Users/macbook/Desktop/allternit-workspace/allternit/surfaces/ai.allternit.com`

---

## Context

This document is a complete handoff for the Allternit Design mode. The following tasks are DONE and must not be re-done:

- ✅ #19 Rename "Allternit Studio" → "Allternit Design" (4 files)
- ✅ #20 Fix onboarding gate — shows wizard once, then `NewProjectScreen` on subsequent opens
- ✅ #21 Port DesignDirection system from nexu-io/open-design (`src/lib/design/directions.ts` — 18 directions with OKLch palettes)
- ✅ #22 Replace flat SchoolsGallery with `NewProjectScreen` (`src/views/design/NewProjectScreen.tsx`)
- ✅ #23 Fetch and parse 148 DESIGN.md files → `src/lib/design/design-systems-library.ts`
- ✅ #24 Wire `DesignRegistryView` to real library (replaced `DESIGN_MARKETPLACE` in `design-registry.ts` with a `.map()` over `DESIGN_SYSTEMS_LIBRARY`)
- ✅ #25 Wire Install button to inject DESIGN.md into active session (`handleInstallDesign` in `DesignModeView.tsx`, passes `onInstall` to `DesignRegistryView`)
- ✅ #26 Question-form discovery pattern (already existed: `question-form-parser.ts`, `QuestionFormView.tsx`, `StudioMessageRenderer.tsx`)
- ✅ #27 Anti-slop rules + craft docs merged into `studio-system-prompt.ts` (16-item anti-slop, Typography discipline, Accessibility baseline, Spacing discipline, Motion discipline)
- ✅ #30 SketchEditor: `DesignTldrawCanvas.tsx` (632 lines, full tldraw integration)
- ✅ #31 `ArtifactPreviewPane.tsx` — sandboxed iframe preview with viewport switcher (Desktop/Tablet/Mobile), zoom controls, ResizeObserver fit-to-container
- ✅ #28 EDITMODE live token tweak panel — `iframeRef`, `postMessage` to iframe, `onHtmlChange` persistence via `updateEditModeTokensInHtml`, EDITMODE instruction added to `studio-system-prompt.ts`
- ✅ #29 Token extraction pipeline — `token-extractor.ts` (CSS vars / Tailwind / DTCG), `DesignImportModal.tsx` rewired with tabbed URL + Extract Tokens UI, `isLightColor` fixed for oklch/rgb/hsl
- ✅ #32 Live Artifacts — `live-artifact.ts` (handlebars `{{ }}` interpolation), `LiveArtifactEditor.tsx` (3-pane: template, JSON data, live preview), `live` tab wired into `DesignModeView.tsx`
- ✅ #33 Composio SDK integration — `composio-connector.ts`, API routes (`connections`, `connect`), unified `ConnectorModal.tsx` (Direct + Composio tabs)
- ✅ #34 Orbit Daily Digest — `orbit-engine.ts` (real connector data → enriched LLM prompt), `OrbitView.tsx` (fetches real data, triggers agent, captures digest artifacts from session messages)
- ✅ #35 HTML Linter — `html-linter.ts` (10 rules), `LintBadge` wired into `StudioMessageRenderer.tsx` with score + expandable violations, broken `caps-letter-spacing` regex fixed

---

## A+ Grade Gap Fixes (ALL RESOLVED)

### Gap 1 — Daily Auto-Generate Scheduler for Orbit Digests

**Status:** ✅ Resolved

**Problem:** The OrbitView had a UI toggle for auto-generation but no background scheduler actually triggered it.

**Solution:**
- **New file:** `src/views/design/useOrbitScheduler.ts`
  - `loadSchedule()` / `saveSchedule()` — persist `{ enabled, hour, minute, lastGeneratedAt }` to `allternit-design-orbit-schedule`
  - `shouldGenerate()` — checks if current time is past scheduled slot and last generation was before today's scheduled time
  - `useOrbitScheduler(onGenerate)` — runs `checkAndGenerate()` on mount, then every 60s via `setInterval`, plus on `visibilitychange` when tab becomes visible
- **Updated:** `src/views/design/OrbitView.tsx`
  - Imports `useOrbitScheduler`, `saveSchedule`, `loadSchedule`
  - Added bell icon toggle (ON/OFF) + native `<input type="time">` picker in header
  - `toggleSchedule(enabled)` and `setScheduleTime(hour, minute)` handlers
  - Scheduler callback reuses same `fetchOrbitData → buildOrbitPrompt → sessionSendMessage` flow as manual generation
  - Auto-generated digests saved with id prefix `orbit-auto-*`

### Gap 2 — Composio SDK Installation Check

**Status:** ✅ Resolved

**Problem:** API routes used raw `fetch` instead of `@composio/core` SDK with no graceful fallback.

**Solution:**
- **New file:** `src/lib/design/composio-client.ts`
  - `getComposioSDK()` — attempts `await import('@composio/core')` once, caches result; logs and returns `null` on failure
  - `listConnections(apiKey)` — uses SDK `Composio.connectedAccounts.list()` if available, falls back to raw `fetch` to `backend.composio.dev`
  - `getAuthUrl(apiKey, appName, redirectUri, user?)` — uses SDK `client.apps.getAuthUrl()` if available, falls back to raw `fetch`
- **Updated:** `src/app/api/design/composio/connections/route.ts` — now imports `listConnections` from `composio-client`
- **Updated:** `src/app/api/design/composio/connect/route.ts` — now imports `getAuthUrl` from `composio-client`
- Both routes still return 503 when `COMPOSIO_API_KEY` is missing — this is correct for the optional managed-OAuth path

### Gap 3 — Slack CORS Handler (Direct Connector Proxies)

**Status:** ✅ Resolved

**Problem:** Direct Slack connector called `slack.com/api` from the browser, which would hit CORS blocks.

**Solution:** Created 4 server-side proxy routes so the browser only makes same-origin requests:
- **New file:** `src/app/api/design/connectors/github/route.ts` — proxies to `api.github.com`, normalizes to `{ activities: [...] }`
- **New file:** `src/app/api/design/connectors/linear/route.ts` — proxies to `api.linear.app/graphql`, normalizes to `{ issues: [...] }`
- **New file:** `src/app/api/design/connectors/notion/route.ts` — proxies to `api.notion.com/v1/search`, normalizes to `{ pages: [...] }`
- **New file:** `src/app/api/design/connectors/slack/route.ts` — proxies to `slack.com/api/*`, normalizes to `{ messages: [...] }`

**Updated:** `src/lib/design/direct-connectors.ts`
- All `fetchGitHubActivity()`, `fetchLinearIssues()`, `fetchNotionPages()`, `fetchSlackMessages()` now POST to `/api/design/connectors/{service}` instead of calling external APIs directly
- Same return types → zero consumer code changes

### Bonus Bug Fix — Composio Error Propagation

**Fixed:** `src/lib/design/composio-connector.ts`
- `getComposioConnections()` was returning `[]` on 503 instead of throwing, which caused `ConnectorModal` to set `composioAvailable(true)` and show enabled Connect buttons that would open `undefined` URLs
- Now properly throws on non-ok response → UI correctly shows "Composio is not configured" message
- `initiateComposioConnect()` now checks `res.ok` before parsing

---

## File Reference Map

| File | Status | Notes |
|------|--------|-------|
| `src/lib/design/editmode-parser.ts` | ✅ Created | Parser done, UI wired |
| `src/components/design/ArtifactPreviewPane.tsx` | ✅ Edited | EDITMODE panel, iframeRef, onHtmlChange persistence |
| `src/lib/design/studio-system-prompt.ts` | ✅ Edited | EDITMODE instruction block added |
| `src/lib/design/token-extractor.ts` | ✅ Created | CSS vars / Tailwind / DTCG extractor |
| `src/views/design/DesignImportModal.tsx` | ✅ Edited | "Extract Tokens" tab added |
| `src/lib/design/live-artifact.ts` | ✅ Created | Live artifact engine with `{{ }}` interpolation |
| `src/views/design/LiveArtifactEditor.tsx` | ✅ Created | Template + data + preview editor |
| `src/views/design/DesignModeView.tsx` | ✅ Edited | `live`, `orbit` tabs + ErrorBoundary + types |
| `src/lib/design/composio-connector.ts` | ✅ Created | Composio client module (fixed 503 propagation) |
| `src/lib/design/composio-client.ts` | ✅ Created | SDK-aware client with fetch fallback |
| `src/app/api/design/composio/connections/route.ts` | ✅ Created | GET connections API route (uses composio-client) |
| `src/app/api/design/composio/connect/route.ts` | ✅ Created | POST connect API route (uses composio-client) |
| `src/app/api/design/connectors/github/route.ts` | ✅ Created | Server proxy for GitHub API |
| `src/app/api/design/connectors/linear/route.ts` | ✅ Created | Server proxy for Linear API |
| `src/app/api/design/connectors/notion/route.ts` | ✅ Created | Server proxy for Notion API |
| `src/app/api/design/connectors/slack/route.ts` | ✅ Created | Server proxy for Slack API |
| `src/views/design/ConnectorModal.tsx` | ✅ Created | Unified modal (Direct + Composio tabs) |
| `src/lib/design/orbit-engine.ts` | ✅ Created | Orbit digest engine with real connector data |
| `src/views/design/OrbitView.tsx` | ✅ Created | Orbit UI view with scheduler |
| `src/views/design/useOrbitScheduler.ts` | ✅ Created | Background daily digest scheduler |
| `src/lib/design/html-linter.ts` | ✅ Created | HTML quality linter (10 rules) |
| `src/components/design/StudioMessageRenderer.tsx` | ✅ Edited | LintBadge + linter call + htmlOverrides persistence |
| `src/lib/design/direct-connectors.ts` | ✅ Edited | Routes through server proxies (CORS-safe) |
| `src/views/design/DesignRegistryView.tsx` | ✅ Edited | TAG_CATEGORIES + TOP_CREATORS updated for 148-entry library |
| `src/components/design/ErrorBoundary.tsx` | ✅ Created | Wraps tab content to prevent full crash |

---

## Architecture Decisions

### Connector Strategy
- **Direct Tokens** (default/free): Users paste own tokens → stored in `localStorage` under `allternit-design-connector-tokens` → API calls route through `/api/design/connectors/*` server proxies
- **Composio** (optional/managed): Only available if `COMPOSIO_API_KEY` is set in server env → OAuth popup flow → 503 graceful fallback when key missing

### Orbit Digest Flow
1. `OrbitView` / `useOrbitScheduler` triggers generation
2. `fetchOrbitData(sources)` gathers real data from connected sources via server proxies
3. `buildOrbitPrompt(projectName, data)` injects raw JSON into LLM prompt
4. Agent synthesizes into HTML artifact with EDITMODE config
5. `OrbitView` subscribes to session messages, captures `<artifact>` blocks
6. Digests persisted to `allternit-design-orbit-digests`

### Composio SDK Fallback
- `composio-client.ts` dynamically imports `@composio/core` at runtime
- If import fails (package not installed), logs to console and falls back to raw `fetch`
- No build-time dependency on the SDK

---

## Key Patterns to Follow

- **No build commands** during task work — never run `tsc`, `npm build`, `cargo build`
- **Read before editing** — always Read a file before using Edit tool
- **CSS variables** for all colors: `var(--bg-primary)`, `var(--text-secondary)`, `var(--accent-primary)`, `var(--border-subtle)`, `var(--surface-panel)`, `var(--surface-hover)`
- **No external API calls from browser** — route through `/api/...` Next.js routes
- **localStorage** for user preferences: key pattern `allternit-design-*`
- **Zustand store** for session management: `useDesignSessionStore` + `useDesignSessionActions` from `src/views/design/DesignSessionStore.ts`
- **sendMessageStream(sessionId, { text })** to inject context into active session
- **No comments** unless the WHY is non-obvious; no docstrings
