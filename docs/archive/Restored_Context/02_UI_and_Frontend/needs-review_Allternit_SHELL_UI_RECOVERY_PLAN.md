# Allternit Shell UI Recovery + Upgrade Plan (post-salvage)

This plan is written against the **real repo** (REPO_ROOT = `/Users/macbook/Desktop/allternit-workspace/allternit/`) and the code you uploaded (`src.zip`). It focuses on (1) restoring correctness and (2) applying the glass design system without losing the existing primitives.

---

## 0) What’s actually broken (root causes observed in code)

### 0.1 Browser capsules spawning “extra browsers”
**Root cause:** `ViewHost.tsx` keys the primary view by `view.viewInstanceId`, and `NavigationState.tsx` currently generates a **new random `viewInstanceId`** for `SET_PRIMARY_VIEW` unless one is provided.  
That causes **remounts** even when focusing the same capsuleId → `WindowedBrowserView.tsx` sees no `browserState.tabId` and creates a **new Electron tab** on mount.

**Evidence in code (your src.zip):**
- `ViewHost.tsx`: `key={mountedView.viewInstanceId}`
- `NavigationState.tsx` reducer: `SET_PRIMARY_VIEW` → `const newViewId = action.view.viewInstanceId || crypto.randomUUID();`
- `WindowedBrowserView.tsx`: init `useEffect` creates a new tab if `browserState.tabId` is empty.

**Result:** clicking the Browser rail item repeatedly (or navigating to browser repeatedly) can create fresh tabs/windows, even when the capsule should be singleton.

---

### 0.2 “Views overlay / can’t get back / inconsistent switching”
There are **two overlapping issues**:
1) **Navigation substrate** is half-correct:
   - You have back/forward scaffolding (`GO_BACK`, `GO_FORWARD`), but:
     - `FOCUS_VIEW` searches `viewStack.find(...)` and may pick the wrong entry (oldest matching type, not latest).
     - focus vs open pathways sometimes still push stack or generate new IDs, which breaks “one primary view” intuition.
2) **Windowed content** stays alive after switching:
   - `WindowedBrowserView.tsx` detaches stage on unmount, but does **not** close the Electron tab or close the window in `WindowManager`.
   - If the view remounts and creates a new window/tab, old windows may remain “alive” behind/overlaid depending on z-order and stage attachment.

---

### 0.3 “Dead doors” and obsolete left-rail items
You already identified:
- Brain left-rail tab + bottom items are obsolete / can be removed or reimplemented
- Some left-rail tabs don’t switch cleanly
- Some views remain visible after switching tabs
- No consistent back/forward in UI

---

## 1) Phase 1 — Correctness Substrate (must be done first)

### 1.1 Make `viewInstanceId` stable (critical fix)
**Goal:** avoid remounting primary views when focusing the same capsule.

**Rule:**
- If `ViewConfig.capsuleId` exists, set `viewInstanceId = capsuleId` unless explicitly provided.
- If no `capsuleId`, set `viewInstanceId = view.type` (or a deterministic key), not a random UUID.

**Patch site:** `src/runtime/NavigationState.tsx`
- In reducer case `SET_PRIMARY_VIEW`:
  - Replace:
    - `const newViewId = action.view.viewInstanceId || crypto.randomUUID();`
  - With:
    - `const stableId = action.view.viewInstanceId ?? action.view.capsuleId ?? action.view.type;`
    - `const newViewId = stableId;`

- In `OPEN_VIEW`:
  - Today it does:
    - `const newViewId = crypto.randomUUID();`
    - `capsuleId: action.viewId || crypto.randomUUID()`
  - Replace with:
    - `const capsuleId = action.viewId || crypto.randomUUID();`
    - `const newViewId = capsuleId;`

**Impact:**  
- `ViewHost` will keep the same React key for a capsule, so `WindowedBrowserView` stops re-initializing and stops creating new Electron tabs on focus.

---

### 1.2 Fix “focus vs open” semantics everywhere
**Rule:**
- **OPEN** means “new instance” (if policy allows).
- **FOCUS** means “activate existing” (no stack push; no new IDs; no re-init).

**Patch sites:**
- `src/runtime/NavigationState.tsx`:
  - Ensure `FOCUS_VIEW` never generates a new capsuleId unless truly no instance exists.
  - When focusing an existing view, ensure `currentViewId` becomes the stable viewInstanceId (which is now capsuleId/type).

- `spawnOrFocus()` in `NavigationState.tsx`:
  - When policy returns `FOCUS_EXISTING`, call `navigateTo(..., { pushToStack: false })` (today it uses `{ pushToStack: true }`).

- `src/services/capsule-factory/spawnIntegration.ts`:
  - When focusing existing, navigate with `pushToStack: false`.
  - Ensure `navigateTo({ type, capsuleId, viewInstanceId: capsuleId })` for all focus paths.

---

### 1.3 Fix view stack selection (choose most recent, not oldest)
Current code in `FOCUS_VIEW`:
- `state.viewStack.find((entry) => entry.view.type === action.viewType)?.view;`

This selects the **oldest** match, not the most recent. Fix:
- iterate from end:
  - `for (let i = state.viewStack.length - 1; i >= 0; i--) ...`

Also, stack should store `ViewConfig` objects with stable IDs (after 1.1).

---

### 1.4 Drawer lifecycle rules (global vs view-scoped) and ghost overlays
You already have global vs view-scoped drawer infrastructure + cache.

Once IDs become stable, drawer cache becomes stable too.

**Additionally:**
- Add a hard rule: on view switch, view-scoped drawers either:
  - restore for that view key, or
  - close if not cached.
- Ensure “console drawer” is global and never blocks navigation state.

---

### 1.5 Window cleanup rules for windowed capsules (browser, inspector, agent steps)
**Goal:** no lingering windows/tabs that feel like “overlays.”

**Patch site:** `src/components/windowing/WindowedBrowserView.tsx`
- In cleanup `useEffect(() => () => {...}, [])`:
  - After `detachStage(tabId)` also call:
    - `await getElectronBrowserHost().closeTab(tabId)` (best-effort; ignore errors)
  - If the capsule window is ephemeral:
    - call `closeWindow(windowId)` from `useWindowManager()` (already available in `WindowManager.tsx`)
- Decide policy:
  - Browser singleton should **reuse** window/tab when focusing.
  - Closing happens only when capsule is explicitly closed/unregistered, not on simple focus switch.
  - That means: **don’t unmount Browser view** just because you navigated away—OR, if you do unmount, you must persist tabId externally and reattach rather than create new tab.

**Minimal path (fast):**
- Keep unmount behavior but ensure stable key prevents remount when focusing same capsule.
- Add closeTab/closeWindow only when capsule is explicitly disposed (tie to `unregisterCapsule` event).

---

## 2) Phase 2 — “Dead Doors” audit + navigation correctness

### 2.1 Use DOOR_MAP.md and make it executable
You already generated `DOOR_MAP.md`. Convert it into:
- a typed list of routes/views and their expected components
- a simple smoke-test harness that clicks each rail item and verifies:
  - activePrimaryView changes
  - previous view unmounts (L1 invariant)
  - no new browser tabs created on repeat clicks

### 2.2 Left Rail cleanup (remove obsolete, re-slot later)
Immediate:
- remove/disable obsolete brain tab and bottom items
- keep only stable, working “mode set”:
  - Workspace (Canvas)
  - Chats
  - Browser (singleton)
  - Studio
  - Registry
  - Marketplace
  - Ops (OpenWork)

Later re-add:
- Brain/Memory/Admin as drawers or as a “Settings” surface

---

## 3) Phase 3 — UX + visual upgrade (use your salvaged glass design system)

You already have:
- `src/design/tokens.ts`
- `GlassCard.tsx`
- `GlassSurface.tsx`
- `ModeSwitcher.tsx`
- `styles/glass/design-tokens.css`

### 3.1 Apply glass at “choke points” first
Choke points in the real shell:
- LeftRail container
- Header / top bar
- ConsoleDrawer / InspectorDrawer
- “Right corner widget” (your 3-mode chat widget)

Do *not* rewrite view implementations yet. Wrap existing primitives with `GlassSurface` and `GlassCard`.

### 3.2 Rebuild the right-corner widget into a professional “Dock”
What you described:
- a widget in the right corner with 3 modes + chat interface + beads/ticket animations
What to build:
- A **Dock / Task Capsule**:
  - Mode: Chat | Tasks | Logs (or Chat | Beads | Tools)
  - Always accessible (global)
  - Dock opens as drawer or floating panel
  - Uses the new glass tokens
  - Uses deterministic WIH/Beads rendering

---

## 4) Execution order (what to do next, in exact sequence)

1) **Implement stable viewInstanceId** (NavigationState reducer changes)  
2) **Fix focus semantics** (pushToStack false, no new IDs on focus)  
3) **Fix viewStack selection** (most recent match)  
4) **Verify Browser no longer spawns extra tabs** (repeat click 20x)  
5) **Fix ghost overlays**:
   - confirm only 1 primary view mounted
   - confirm window manager isn’t leaving stale windows
6) **Run DOOR_MAP audit** and fix dead rail items
7) **Apply glass styling choke points**
8) **Rebuild the right-corner widget into Dock**

---

## 5) Acceptance tests (non-negotiable)

### Navigation
- Clicking the same rail item repeatedly does **not** create new instances (unless explicitly “New”).
- Back/forward works for view switches.
- Switching views results in **exactly one** mounted primary view.

### Browser capsule
- Browser is singleton by policy: repeat clicks focus the same capsule.
- No new Electron tab is created on focus.
- Switching away and back does not create a new tab (tabId is preserved or view doesn’t remount).

### Drawers
- Console drawer persists globally.
- Inspector drawer is view-scoped and closes/restores correctly.
- No “stuck overlays” after switching views.

---

## 6) Minimal code-change checklist (files to touch)

- `src/runtime/NavigationState.tsx`
  - SET_PRIMARY_VIEW stable IDs
  - OPEN_VIEW stable IDs
  - FOCUS_VIEW: choose most recent; no new IDs; no stack push
  - spawnOrFocus: focus uses pushToStack false
- `src/services/capsule-factory/spawnIntegration.ts`
  - focus navigateTo uses pushToStack false
  - pass viewInstanceId = capsuleId on focus
- `src/components/LeftRail.tsx`
  - await spawnBrowserIntegrated; lock until promise resolves
- `src/components/windowing/WindowedBrowserView.tsx`
  - prevent re-init on focus (mostly fixed by stable key)
  - optional: closeTab/closeWindow on true dispose, not on simple unmount
