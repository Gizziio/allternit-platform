# Navigation Re-rendering Debug Guide - RESOLVED

## Problem (RESOLVED)
`ShellAppInner` was reported as not re-rendering when the `nav` state changes via `dispatch({ type: 'OPEN_VIEW', viewType: 'browser' })`.

## Resolution
**The navigation system is working correctly!** All components re-render as expected:

```
✅ ShellAppInner re-renders when dispatch is called
✅ navReducer updates state correctly  
✅ selectActiveView returns the correct browser view
✅ ViewHost renders with the correct active view
✅ BrowserCapsuleEnhanced IS rendering and found in DOM
✅ a2r-iframe-content iframe is present
```

## Test Evidence

Run the debug test to verify:
```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
pnpm --filter @a2rchitech/shell-ui dev  # Start dev server

cd 6-ui/a2r-platform
npx playwright test tests/debug-nav-rendering.spec.ts --project=chromium
```

Expected output shows complete re-rendering chain:
```
[log] ShellAppInner: open() called with viewType: browser
[log] navReducer: BEFORE {eventType: OPEN_VIEW, eventPayload: browser, ...}
[log] navReducer: AFTER OPEN_VIEW {newActiveViewId: browser, ...}
[log] selectActiveView: {activeViewId: browser, foundViewType: browser, ...}
[log] ShellAppInner: RENDER {activeViewId: browser, activeViewType: browser, ...}
[log] ViewHost: RENDER {activeViewId: browser, activeViewType: browser, ...}
[log] ViewHost: Creating view instance {viewType: browser, viewId: browser}
```

DOM verification:
```
BrowserCapsuleEnhanced root found: 1
a2r-iframe-content found: 1
ViewHost wrapper data-active-view: browser
```

## Original Debug Code Added (Still Useful for Future Debugging)

### 1. ShellAppInner Render Logging
**File:** `src/shell/ShellApp.tsx`
- Logs every render with current `activeViewId`, `activeViewType`, history length, and open views count
- Logs when `open()` callback is invoked

### 2. NavReducer State Transition Logging
**File:** `src/nav/nav.store.ts`
- Logs BEFORE each action with event type and current state
- Logs AFTER OPEN_VIEW and FOCUS_VIEW actions with new state
- Tracks if state object reference changed (immutability check)

### 3. Selector Logging
**File:** `src/nav/nav.selectors.ts`
- Logs which view is being selected from state
- Shows all open view keys for verification

### 4. ViewHost Render Logging
**File:** `src/views/ViewHost.tsx`
- Logs when ViewHost renders with active view props
- Logs when view instance is created

### 5. BrowserCapsuleEnhanced Render Logging
**File:** `src/capsules/browser/BrowserCapsuleEnhanced.tsx`
- Logs when BrowserCapsuleEnhanced component renders (may not appear in Playwright if inside iframe)
- Added `data-testid="browser-capsule-enhanced-root"` for DOM verification

### 6. Registry Creation Logging
**File:** `src/views/registry.ts`
- Logs when registry.create() is called with viewType and available keys

## Test Script

**File:** `tests/debug-nav-rendering.spec.ts`

Playwright test that:
- Captures console logs from all components
- Verifies DOM elements are present
- Takes screenshot for visual verification
- Writes full logs to `test-results/console-debug-logs.txt`

## Key Architecture Notes (Verified Working)

- `ShellAppInner` uses `useReducer` with `navReducer` ✅
- `dispatch` is wrapped in `open` callback with empty dependency array ✅
- `registry` is memoized with `[open]` dependency ✅
- `ViewHost` memoizes view instance with `[registry, active.viewId, active.viewType]` dependencies ✅
- No `React.memo` wrapping `ShellAppInner` or `ShellFrame` ✅
- Error boundaries only wrap individual views, not the shell ✅

## Conclusion

**The navigation re-rendering system is fully functional.** If you're experiencing issues with views not appearing:

1. Check if the view component has a `data-testid` for DOM verification
2. Verify the view is registered in the ShellApp.tsx registry
3. Check for component-specific errors in the browser console
4. Use Playwright test to capture full rendering chain logs
