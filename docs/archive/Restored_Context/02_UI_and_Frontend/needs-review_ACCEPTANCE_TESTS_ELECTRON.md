# Electron Migration Acceptance Tests

**Created**: 2024-01-16
**Status**: Phase 4 - Pending
**Based on Ledger**: `TAURI_TO_ELECTRON_LEDGER.md`

---

## Test Environment

```bash
# Terminal 1: Start Electron
cd apps/shell-electron
npm run dev

# Terminal 2: (optional) Playwright service
cd services/browser-runtime
pnpm dev
```

---

## Test Suite 1: Shell Launch

### 1.1 Electron App Launches

**Steps**:
1. Run `npm run dev` in `apps/shell-electron`
2. Observe app launch

**Expected**:
- [ ] Window appears with title "Allternit Shell"
- [ ] Window size is 1200x800 (or persisted size)
- [ ] No console errors on startup

**Status**: `pending`

### 1.2 React UI Loads

**Steps**:
1. Check window content after launch

**Expected**:
- [ ] React UI renders (canvas, tabs, navigation visible)
- [ ] DevTools open (in dev mode)

**Status**: `pending`

---

## Test Suite 2: HUMAN Browser Renderer (BrowserView)

### 2.1 Create Tab in HUMAN Mode

**Steps**:
1. Open browser capsule
2. Create new tab with HUMAN renderer

**Expected**:
- [ ] Tab appears in tab bar
- [ ] Tab can be navigated to URL
- [ ] BrowserView creates and attaches to Stage

**Status**: `pending`

### 2.2 Navigation

**Steps**:
1. In a HUMAN tab, navigate to `https://example.com`

**Expected**:
- [ ] URL loads in BrowserView
- [ ] `didNavigate` event received
- [ ] Title updates correctly
- [ ] Page content renders

**Status**: `pending`

### 2.3 Back/Forward Navigation

**Steps**:
1. Navigate to page A
2. Navigate to page B
3. Click back button
4. Click forward button

**Expected**:
- [ ] Back returns to page A
- [ ] Forward returns to page B
- [ ] History state maintained

**Status**: `pending`

### 2.4 Reload

**Steps**:
1. In any tab, click reload

**Expected**:
- [ ] Page reloads
- [ ] `didFinishLoad` event received

**Status**: `pending`

### 2.5 Stage Resize (50/70/100)

**Steps**:
1. Open HUMAN tab in Stage
2. Click 50% preset
3. Click 70% preset
4. Click 100% preset

**Expected**:
- [ ] Stage resizes smoothly
- [ ] BrowserView bounds update correctly
- [ ] No black screen artifacts

**Status**: `pending`

### 2.6 Close Tab

**Steps**:
1. Create multiple tabs
2. Close one tab (not the last)
3. Close last tab (should show empty state)

**Expected**:
- [ ] Tab removed from UI
- [ ] BrowserView destroyed
- [ ] No memory leaks

**Status**: `pending`

---

## Test Suite 3: Tab Model Integrity

### 3.1 New Tab from Link

**Steps**:
1. Open HUMAN tab to a page with links
2. Click a `target=_blank` link

**Expected**:
- [ ] New tab opens in same capsule
- [ ] No OS browser window opens
- [ ] Toast notification shows "New tab opened"

**Status**: `pending`

### 3.2 Tab Switching

**Steps**:
1. Create multiple tabs with different URLs
2. Click between tabs

**Expected**:
- [ ] Correct tab becomes active
- [ ] Previous tab is hidden
- [ ] No visual flicker

**Status**: `pending`

---

## Test Suite 4: AGENT Renderer (Playwright)

### 4.1 INSPECT Mode

**Steps**:
1. Open browser capsule
2. Switch to AGENT renderer

**Expected**:
- [ ] Stream connects
- [ ] Screenshot appears in viewport
- [ ] FPS indicator shows

**Status**: `pending`

### 4.2 Live Input

**Steps**:
1. In AGENT mode, click on page
2. Type in page

**Expected**:
- [ ] Click registered at correct coordinates
- [ ] Typing appears in input fields
- [ ] Cursor updates

**Status**: `pending`

---

## Test Suite 5: Capsule SDK Integration

### 5.1 Lifecycle Events

**Steps**:
1. Open browser capsule
2. Monitor SDK events

**Expected**:
- [ ] `capsule.lifecycle.changing` events fire
- [ ] Phase transitions work (connecting → ready)
- [ ] Status text updates

**Status**: `pending`

### 5.2 Registered Actions

**Steps**:
1. Check browser capsule actions

**Expected**:
- [ ] All actions are registered
- [ ] No dead buttons in UI
- [ ] Actions execute correctly

**Actions to verify**:
- `browser.nav.back`
- `browser.nav.forward`
- `browser.nav.reload`
- `browser.stage.enter`
- `browser.stage.exit`
- `browser.tab.new`
- `browser.tab.close`

**Status**: `pending`

---

## Test Suite 6: A2UI Adapters

### 6.1 Chrome Rendering

**Steps**:
1. Observe browser capsule chrome

**Expected**:
- [ ] Tab bar renders
- [ ] URL bar renders
- [ ] Action buttons render
- [ ] Status indicators render

**Status**: `pending`

### 6.2 Stage Chrome

**Steps**:
1. Open HUMAN tab in Stage
2. Observe Stage controls

**Expected**:
- [ ] Size preset buttons render
- [ ] Close button renders
- [ ] URL display renders

**Status**: `pending`

---

## Test Suite 7: Error Handling

### 7.1 Invalid Tab ID

**Steps**:
1. Attempt to navigate with invalid tab ID

**Expected**:
- [ ] Graceful error handling
- [ ] No crash
- [ ] Error logged

**Status**: `pending`

### 7.2 Load Failure

**Steps**:
1. Navigate to invalid URL

**Expected**:
- [ ] `didFailLoad` event fires
- [ ] Error displayed in UI
- [ ] Can recover by navigating elsewhere

**Status**: `pending`

### 7.3 Network Offline

**Steps**:
1. Disconnect network
2. Attempt navigation

**Expected**:
- [ ] Appropriate error shown
- [ ] No crash

**Status**: `pending`

---

## Test Suite 8: Performance

### 8.1 Memory Usage

**Steps**:
1. Open 5 HUMAN tabs
2. Monitor memory

**Expected**:
- [ ] No memory leaks over time
- [ ] Reasonable memory per tab (~50-100MB)

**Status**: `pending`

### 8.2 Startup Time

**Steps**:
1. Measure time from app launch to UI ready

**Expected**:
- [ ] Startup < 5 seconds

**Status**: `pending`

### 8.3 Stage Resize Performance

**Steps**:
1. Rapidly resize Stage

**Expected**:
- [ ] No dropped frames
- [ ] Smooth resize

**Status**: `pending`

---

## Test Suite 9: Platform-Specific

### 9.1 macOS

**Steps**:
1. Run on macOS

**Expected**:
- [ ] App menu bar present
- [ ] Standard macOS window controls
- [ ] No issues with BrowserView

**Status**: `pending`

### 9.2 Windows

**Steps**:
1. Run on Windows

**Expected**:
- [ ] Standard Windows window controls
- [ ] WebView2 present

**Status**: `pending` (future)

### 9.3 Linux

**Steps**:
1. Run on Linux

**Expected**:
- [ ] BrowserView works with X11/Wayland
- [ ] No crashes

**Status**: `pending` (future)

---

## Test Results Summary

| Suite | Tests | Passed | Failed | Blocked |
|---|---|---|---|---|
| 1. Shell Launch | 2 | 0 | 0 | 2 |
| 2. HUMAN Renderer | 6 | 0 | 0 | 6 |
| 3. Tab Model | 2 | 0 | 0 | 2 |
| 4. AGENT Renderer | 2 | 0 | 0 | 2 |
| 5. SDK Integration | 2 | 0 | 0 | 2 |
| 6. A2UI Adapters | 2 | 0 | 0 | 2 |
| 7. Error Handling | 3 | 0 | 0 | 3 |
| 8. Performance | 3 | 0 | 0 | 3 |
| 9. Platform-Specific | 3 | 0 | 0 | 3 |
| **Total** | **25** | **0** | **0** | **25** |

---

## Blocker Log

| Blocker | Suite | Description | Resolution |
|---|---|---|---|
| Electron scaffold not created | All | Need `apps/shell-electron/` | Phase 1 |
| BrowserView implementation | 2-3 | Need main process BrowserView code | Phase 2 |
| IPC handlers not wired | 5-7 | Need preload/main IPC setup | Phase 2 |

---

## Acceptance Criteria (Gating for Cleanup)

To proceed to Phase 5 (Cleanup):

- [ ] All tests in Suite 1 pass
- [ ] All tests in Suite 2 pass (critical: HUMAN renderer works)
- [ ] All tests in Suite 3 pass (tab model integrity)
- [ ] All tests in Suite 5 pass (SDK integration)
- [ ] No Tauri references in built Electron app
- [ ] Build produces working artifact

---

*Document maintained as part of Tauri → Electron migration*
