# A2rchitech Session Summary — Shell UI + Electron Browser Capsule + Miniapps
**Date:** 2026-01-26  
**Topic:** Shell UI correctness + Browser capsule (Electron BrowserView) + windowing + miniapp capsules + A2UI/AG-UI direction

---

## 1) Current reality check (what we observed)
- Electron launches and loads the Shell UI dev server (Vite) correctly.
- The **browser capsule UI on screen is still the old/incorrect experience** relative to the intended design:
  - Not behaving like a windowed capsule (drag/snap/tab/dock behaviors missing or not wired to visible UI).
  - Browser content not reliably rendering/interactive (BrowserView attach/bounds/IPC issues were repeatedly suspected).
  - The visual chrome we designed (tabs, proper controls, capsule-grade layout) is not showing.

**Key meta-finding:** we repeatedly had “new code exists” vs “render pipeline still uses old components” drift. The browser view had to be intercepted so `browser_view` uses the new shell-side windowed implementation rather than `apps/ui` legacy rendering.

---

## 2) Architecture decisions we converged on
### 2.1 Intent signal (HUMAN vs AGENT)
- We needed an explicit navigation intent to route:
  - **User-initiated navigation → HUMAN** (Electron BrowserView)
  - **Agent-initiated navigation → AGENT** (Playwright stream)
- Implemented concept: `NavIntent = "user" | "agent"` and action IDs separated.

### 2.2 Render routing ownership
- **Do not import shell components into apps/ui** (avoids circular deps).
- Correct approach: **intercept in shell** before `renderCanvas()` routes to legacy `apps/ui` BrowserView.

---

## 3) Work done (what exists in repo, per the agent’s audits)
### 3.1 Host abstraction (Electron)
- `apps/shell/src/host/electronBrowserHost.ts`: wrapper around `window.a2Browser` IPC API.
- `apps/shell/src/host/browserActions.ts`: binds capsule actions to host calls.
- `apps/shell/src/host/types.ts`: includes NavIntent type.
- `apps/shell/src/host/electron.d.ts`: window typing.

### 3.2 Windowing system (Shell UI)
- `apps/shell/src/components/windowing/` includes:
  - `WindowManager.tsx`
  - `CapsuleWindowFrame.tsx`
  - `WindowedBrowserView.tsx`

Hardening items addressed (in code iterations):
- Throttle bounds sync, **force emit** on pointerup/cancel.
- Pointer capture + cancel handlers.
- Content bounds computation + DOM-derived title bar height.

### 3.3 Routing cutover
- `apps/shell/src/components/CapsuleView.tsx` was intended to intercept `browser_view` and render `WindowedBrowserView` directly (bypass legacy `apps/ui` BrowserView).

---

## 4) The persistent blockers (why UI still looks wrong)
### 4.1 Rendering pipeline drift
- Even when new components exist, **the view registry / canvas renderer** can still route to `apps/ui` legacy BrowserView unless the shell intercept is correct *and active*.

### 4.2 Electron BrowserView attach/bounds/IPC mismatch
Failure modes identified:
- IPC contract mismatches (`send` vs `handle` / `invoke`).
- Zero/tiny bounds, wrong coordinate space, or DPR normalization issues.
- Stage attachment not truly happening even if logs print.

### 4.3 UX not implemented as OS-like windowing
Even when WindowManager/Frame exists, user-visible behaviors were not present:
- Minimize, tabbing, dock restore, drag-to-tabstrip, reopen recents.
- Capsule icon system (SVG, type-based).
- Miniapp capsule docking/floating in a cohesive way.

---

## 5) Target shell UX (what “done” looks like)
### 5.1 Capsule OS interactions
- Window states: normal / minimized / maximized / tabbed / closed (soft close).
- DockBar: minimized capsules + pinned launchers; click restores.
- TabStrip: drag window into strip → tab; click restores; survives hide/show.
- Snap grid with guides.
- Iconography: capsule type → SVG icon registry (no emojis).
- Miniapp capsules: Inspector + Agent Steps as capsules (dock right rail or float).

### 5.2 A2UI + AG-UI direction
- A2UI = schema-driven UI plane (adapters map state → schema; renderer inflates schema).
- AG-UI = runtime schema patches (agent adds tools/buttons/miniapps via JSON patch).

---

## 6) Joe’s directives (critical)
- **Tauri is no longer needed. Remove legacy code and references.**
- Visual + functional completion is the priority: miniapp capsules, tabbing/docking/minimize, custom icons.

---

## 7) Immediate next steps (engineering plan)
1. Prove correct render path (browser_view → WindowedBrowserView, not apps/ui).
2. Finish OS-window model (window states + DockBar + TabStrip + restore).
3. Make browser actually browse (IPC contract correct; attach stage; non-zero bounds).
4. Miniapp capsule system (Inspector + Agent Steps as real capsules).
5. Iconography system (SVG assets for capsules; auto-assign on create).
6. Tauri purge (delete dead paths, references, files).

---

# Appendix A — Prompt for the next coding agent (UI completion + cleanup)

**Role:** You are the implementation agent working inside the A2rchitech monorepo. Your job is to make the Shell UI behave like a real “capsule OS” and to remove legacy Tauri code. Do NOT hand-wave. Produce commits that change the visible UI.

## Objective (non-negotiable outcomes)
1. Browser capsule is a draggable/resizable/snap-to-grid window with correct chrome.
2. Windows can be minimized to a DockBar, restored by clicking their icon.
3. Windows can be dragged into a TabStrip (become tabs), clicked to restore; soft-closed windows can be reopened.
4. Miniapp capsules exist (Inspector + Agent Steps at minimum) and can be spawned, docked, or floated.
5. Capsule icons are **SVG assets**, type-based, no emojis.
6. Tauri is fully purged (delete code, remove references, remove dead files).

## Hard constraints
- Avoid circular deps: **apps/ui must not import from apps/shell**.
- Intercept in shell for browser/miniappps; legacy `apps/ui` BrowserView must not render `browser_view`.
- Keep changes incremental and testable.

## What to inspect first
1. `apps/shell-electron/main/index.cjs` (load URL + preload + IPC handlers)
2. `apps/shell/src/components/CapsuleView.tsx` (browser_view routing)
3. `apps/shell/src/components/windowing/WindowManager.tsx` + `CapsuleWindowFrame.tsx`
4. Confirm the app is wrapped in `WindowManagerProvider` in `apps/shell/src/App.tsx`

## Implementation deliverables
### D1 — Window State Machine
- Add `state: 'normal'|'minimized'|'maximized'|'tabbed'|'closed'` to window model.
- Implement actions: minimize/restore/tab/soft-close/reopen.

### D2 — DockBar
- Bottom dock showing minimized capsules + pinned launch icons.
- Click restores previous bounds/state.

### D3 — TabStrip
- Top strip that accepts drag-drop from title bar.
- Dropped window becomes tab; click restores.

### D4 — Miniapp Capsules
- Inspector + Agent Steps as real capsules (spawn + float + dock).

### D5 — Capsule Iconography
- `CapsuleIconRegistry.ts` mapping capsule type → SVG icon.
- Replace emojis everywhere (launcher/titlebar/dock/tabstrip).

### D6 — Tauri purge
- Remove `window.__TAURI__` checks and any tauri-only HTML snippets.
- Delete dead legacy browser UI if unused.

## Verification (must provide proof)
- Screenshots: snapped window, minimized-to-dock+restore, tabbed+restore, miniapp floating.
- Console: confirm `window.a2Browser` present; attach/bounds calls succeed with non-zero area.

