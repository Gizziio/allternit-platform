# Browser View — Gap Analysis & Remediation Plan

## Executive Summary

The browser view (`BrowserCapsuleEnhanced`, 2168 lines) is the most divergent surface in the platform. It uses hardcoded colors, a completely different chat architecture (extension sidepanel shell), demo/fake features, and Electron-specific Chrome embedding that leaks into the web build. This doc catalogs every gap and the fix for each.

---

## 1. Color / Theme — CRITICAL

**Problem:** The browser uses hardcoded grays (`#202020`, `#313131`, `#12100f`, `#1a1a1a`) and sand accent (`#D4B08C`) everywhere. It does NOT use `MODE_COLORS.browser` (steel blue `#69A8C8`) or the platform's `BACKGROUND` / `TEXT` tokens.

**Impact:** The browser looks like a different app. No visual continuity with chat/cowork/code/design surfaces.

**Files affected:**
- `BrowserCapsuleEnhanced.tsx` — 50+ hardcoded color literals
- `BrowserChatPane.tsx` / `BrowserExtensionPane.tsx` — sidepanel uses its own dark theme
- `ExtensionSidepanelShell.tsx` — 1463 lines of custom CSS-in-JS with hardcoded colors
- `BrowserNativeComposer.tsx` — custom composer styling

**Fix:** Replace all hardcoded colors with:
- Background: `BACKGROUND.primary` (`#1A1612`) or `MODE_COLORS.browser.base` (`#20262B`)
- Accent: `MODE_COLORS.browser.accent` (`#69A8C8`)  
- Text: `TEXT.primary` / `TEXT.secondary` / `TEXT.tertiary`
- Borders: `MODE_COLORS.browser.border`
- Nav/tab bar: `GLASS.base` or `GLASS.thin`

---

## 2. Chat Pane Architecture — CRITICAL

**Problem:** The chat pane is NOT a chat thread. It is `BrowserExtensionPane` wrapped in `ExtensionSidepanelShell` (1463 lines). This shell has:
- Its own header ("Allternit Extension / Chrome Sidepanel")
- A settings/config view
- A history list view  
- A history detail view
- A composer with URL detection, capture cards, @mentions
- Heavy custom CSS animations (glow, pulse, border shimmer)
- Empty-state typing animation

**Impact:** The browser chat looks and behaves nothing like ChatView, CodeCanvas chat, or Cowork chat. Users have to learn a completely different UI pattern.

**Comparison with platform chat:**
| Feature | Platform Chat (ChatView) | Browser Chat (ExtensionSidepanelShell) |
|---------|------------------------|----------------------------------------|
| Message list | Scrollable thread with avatars | Hidden inside "history" sub-view |
| Composer | Bottom-fixed textarea + send | Bottom-fixed textarea + capture cards |
| Agent mode | Backdrop glow + context strip | MatrixLogo toggle + sidepanel header |
| Empty state | Suggested prompts | Typing animation + description |
| Settings | Global settings panel | In-pane config view |

**Fix:** Replace `ExtensionSidepanelShell` with a simple chat thread component that:
1. Reads `history` + `activity` + `status` from `browserAgent.store.ts`
2. Renders messages in a scrollable list (user/agent avatars, timestamps)
3. Shows streaming/thinking state
4. Has a simple composer at bottom (textarea + send/stop)
5. Uses the same empty-state pattern as ChatView (suggested prompts)
6. Reuses platform components where possible

**Files to modify/create:**
- NEW: `BrowserChatThread.tsx` — simple message thread
- NEW: `BrowserComposer.tsx` — simple composer matching platform
- DELETE: `ExtensionSidepanelShell.tsx` (or keep for actual extension packaging only)
- DELETE: `BrowserExtensionPane.tsx`
- DELETE: `BrowserExtensionViews.tsx`
- DELETE: `browserExtensionPane.adapter.ts`
- DELETE: `browserChatPane.store.ts`
- DELETE: `BrowserChatPaneMenu.tsx`
- DELETE: `BrowserNativeComposer.tsx`
- MODIFY: `BrowserChatPane.tsx` — render new thread instead of extension pane

---

## 3. Chrome Embed / External Chrome — CRITICAL

**Problem:** The browser has extensive code for launching an external Chrome instance via Electron's `window.chromeEmbed` API and WebRTC streaming (`chrome-stream` tab type). This includes:
- `ChromeStreamView.tsx` — WebRTC client for streaming remote Chrome
- `launchEmbeddedChrome()` in `BrowserCapsuleEnhanced` — creates `/api/v1/chrome-sessions` and polls for 30s
- `useChromeEmbed` state + `chromeEmbedContainerRef`
- "Chrome" button in nav bar (visible in Electron shell)
- Home page shows "Open Chrome Browser (for extensions)"
- `chrome-stream` tab type in `browser.types.ts` and `browser.store.ts`

**Impact:** 
- Non-Electron builds show fallback UI that navigates to Chrome Web Store in iframe
- The Chrome stream tab type is dead weight in web builds
- Polling `/api/v1/chrome-sessions` adds latency and error noise
- The nav bar has a prominent "Chrome" button that doesn't belong in the web platform

**Fix:** Remove ALL Chrome embed/stream infrastructure. The browser view should only support:
- `web` tabs (iframe/webview)
- `a2ui` tabs (agent-generated UI)

**Files to delete:**
- `ChromeStreamView.tsx`
- `useChromeSession.ts` (if exists)

**Files to modify:**
- `browser.types.ts` — remove `ChromeStreamTab` and `'chrome-stream'` from union
- `browser.store.ts` — remove `addChromeStreamTab`, `ChromeStreamTab` imports
- `BrowserCapsuleEnhanced.tsx` — remove `ChromeStreamView` import, `launchEmbeddedChrome`, `closeEmbeddedChrome`, `useChromeEmbed` state, `chromeEmbedContainerRef`, Chrome button in nav bar, Chrome home page option, `chrome-stream` content branch

---

## 4. Browser Load Time — HIGH

**Problem:** 
- Initial tab is `https://www.google.com` — requires external network load
- iframe uses `getWebProxyUrl()` which proxies through backend — adds round-trip
- `iframeLoaded` has a 3-second fallback timeout that fires even when iframe loads quickly
- `setTabLoading(activeTabId, true)` is set but `setTabLoading(activeTabId, false)` only fires on `iframe.onload` (unreliable for cross-origin)
- Loading overlay shows "SYNCING_SUBSTRATE" with ArchitectLogo — cool but slow-feeling

**Impact:** First paint of browser content feels sluggish. The proxy can fail or be slow.

**Fix:**
1. Change default tab to a local/fast page (e.g., `about:blank` or a local new-tab page)
2. Remove the 3-second fallback timeout — trust `onLoad`/`onError`
3. Show a minimal loading spinner instead of the full "SYNCING_SUBSTRATE" overlay
4. Add a proper error boundary with retry for proxy failures
5. Pre-warm the proxy connection

---

## 5. Tab Bar Production Polish — MEDIUM

**Problem:**
- Tabs use inline styles exclusively (no Tailwind)
- Tab colors are hardcoded `#313131` / `#202020` / `#999`
- No drag-to-reorder
- Tab overflow dropdown is basic
- Favicon loading can fail silently (falls back to Globe icon)
- Tab close button only shows on hover or when active — inconsistent with Chrome/Edge
- Middle-click to close is supported but not documented

**Fix:**
1. Use Tailwind classes + design tokens for tab styling
2. Add `MODE_COLORS.browser` accent to active tab indicator
3. Improve favicon loading (use `allternit.com` fallback favicon service or skip for internal pages)
4. Always show close button on active tab, show on hover for inactive
5. Add tab drag-to-reorder (optional, can defer)

---

## 6. Fake / Demo Features — MEDIUM

**Problem:** The browser includes several non-production features:
- Extension manager with curated catalog (Claude, uBlock, 1Password, Grammarly)
- Extension permission system (cookies, scripts, camera, etc.)
- `CanvasMode` and `StudioMode` — placeholder screens
- `AgentPopup` polls `http://localhost:3000/health` (hardcoded dev URL)
- Screenshot functionality draws placeholder canvas (not actual screenshot)

**Fix:**
- Remove extension catalog and permission UI (keep extension toggle for Allternit Agent only)
- Remove `CanvasMode` and `StudioMode` or make them hidden behind feature flags
- Fix `AgentPopup` to not poll localhost (or remove health check)
- Remove screenshot or implement properly via `html2canvas` or platform screenshot API

---

## 7. Navigation Bar Polish — MEDIUM

**Problem:**
- URL bar uses `#202020` background with hardcoded 16px border-radius
- No URL parsing/pretty-printing (shows raw proxy URLs)
- Lock icon is always shown regardless of actual security state
- Back/forward buttons don't reflect actual iframe history
- The "Chrome Web Store" button in nav bar is Electron-only but confusing

**Fix:**
- Style URL bar with `GLASS.thin` or `GLASS.base`
- Pretty-print URLs (hide proxy prefix, show hostname)
- Remove fake lock icon or make it reflect actual protocol
- Improve back/forward (can read iframe history where possible)
- Remove Chrome Web Store button

---

## Recommended Execution Order

| Phase | Scope | Estimated Impact | Risk |
|-------|-------|-----------------|------|
| 1 | Remove Chrome embed/stream | High | Low (deletion only) |
| 2 | Fix colors to design tokens | High | Medium (visual regression risk) |
| 3 | Rebuild chat pane | Very High | Medium (behavioral change) |
| 4 | Fix load time | Medium | Low |
| 5 | Tab bar polish | Medium | Low |
| 6 | Remove fake features | Low | Low |

---

## Files to Delete

```
src/capsules/browser/
  ChromeStreamView.tsx
  BrowserExtensionPane.tsx
  BrowserExtensionViews.tsx
  browserExtensionPane.adapter.ts
  browserChatPane.store.ts
  BrowserChatPaneMenu.tsx
  BrowserNativeComposer.tsx
  extension-sidepanel/ExtensionSidepanelShell.tsx
  extension-sidepanel/ExtensionSidepanelShell.types.ts
```

## Files to Modify

```
src/capsules/browser/
  BrowserCapsuleEnhanced.tsx      — colors, remove chrome embed, nav bar polish
  BrowserChatPane.tsx             — render new thread
  browser.store.ts                — remove chrome-stream tab type
  browser.types.ts                — remove ChromeStreamTab
  browserAgent.store.ts           — no changes (keep as data layer)
```

## Files to Create

```
src/capsules/browser/
  BrowserChatThread.tsx           — message thread matching platform chat
  BrowserComposer.tsx             — simple composer
```
