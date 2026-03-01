# Browser Capsule Test Checklist

## Manual Testing Steps

Perform these tests in order. Mark ✅ when complete, ❌ when failed.

---

## P0: Critical Path Tests

### P0.1: Basic Connectivity
```
Steps:
1. Start browser-runtime service: cd services/browser-runtime && pnpm dev
2. Start shell app: cd apps/shell && pnpm dev
3. Open browser to http://localhost:5173
4. Click Browser capsule button (🌐) in left rail
5. Observe: Browser capsule appears with google.com

Expected: Screenshot of google.com loads within 5 seconds
Result: ✅ / ❌
Notes:
```

### P0.2: No External Browser Windows (CRITICAL)
```
Steps:
1. With browser capsule open
2. Ensure you're in LIVE mode (toggle button shows LIVE)
3. Type a URL that will open a popup (e.g., example.com that has popup links)
   OR
   Open browser console and run:
   window.open('https://example.com', '_blank')

Expected:
- No system browser window opens
- New tab appears in browser capsule with slide-in animation
- Toast notification shows "Opened new tab: example.com"

Result: ✅ / ❌
Notes:
```

### P0.3: Internal Tab Creation
```
Steps:
1. In browser capsule, click "+" New Tab button
2. Type a URL (e.g., github.com) and press Enter

Expected:
- New tab chip appears with slide-in animation
- Tab count updates in status bar
- URL bar shows github.com
- Screenshot loads for new page

Result: ✅ / ❌
Notes:
```

### P0.4: Tab Switching
```
Steps:
1. Create 2+ tabs with different URLs
2. Click between tabs

Expected:
- Previous tab deselects (gray background)
- New tab selects (purple background, border)
- Screenshot updates to new tab's content
- URL bar updates to new tab's URL

Result: ✅ / ❌
Notes:
```

### P0.5: Tab Closing
```
Steps:
1. With 2+ tabs open
2. Click "×" on a tab

Expected:
- Tab chip disappears with fade animation
- Switches to remaining tab
- Tab count updates
- Cannot close last tab (button disabled)

Result: ✅ / ❌
Notes:
```

---

## P1: Interaction Mode Tests

### P1.1: INSPECT Mode (Default)
```
Steps:
1. Observe browser capsule header
2. Toggle should show "INSPECT" selected

Expected:
- Cursor is default arrow (not crosshair)
- Clicking on page does NOT register clicks
- FPS shows 2 fps in status bar
- Status pill shows "INSPECT"

Result: ✅ / ❌
Notes:
```

### P1.2: LIVE Mode Toggle
```
Steps:
1. Click "LIVE" button in header
2. Move mouse over page

Expected:
- Cursor changes to crosshair
- LIVE button highlighted purple
- Status shows "LIVE • X fps • Y ms"
- Animation: quick zoom-in effect on toggle

Result: ✅ / ❌
Notes:
```

### P1.3: LIVE Mode Input
```
Steps:
1. Ensure LIVE mode is active
2. Click somewhere on the page
3. Type some text
4. Scroll with mouse wheel

Expected:
- Click feedback animation appears at click point
- Typed text appears in page (if focusable element)
- Page scrolls with wheel
- Screenshot updates after each interaction

Result: ✅ / ❌
Notes:
```

### P1.4: Coordinate Accuracy
```
Steps:
1. In LIVE mode
2. Click on a specific element (button, link)
3. Observe if the click registers (page should respond)

Expected:
- Click lands on intended element
- Visual feedback at click location
- Element responds to click

Result: ✅ / ❌
Notes:
```

---

## P2: Viewport Controls

### P2.1: Fit Mode (Contain)
```
Steps:
1. Click "⊞" Fit button
2. Resize browser capsule

Expected:
- Entire page visible within viewport
- Letterboxing appears if aspect ratios differ
- Scale badge shows "Contain"

Result: ✅ / ❌
Notes:
```

### P2.2: Fill Mode (Cover)
```
Steps:
1. Click "⊟" Fill button
2. Resize browser capsule

Expected:
- Viewport completely filled
- Page edges may be cropped
- Scale badge shows "Cover"

Result: ✅ / ❌
Notes:
```

### P2.3: 100% Zoom Mode
```
Steps:
1. Click "⊡" 100% button
2. Click "+" zoom in button 2-3 times
3. Click "-" zoom out button

Expected:
- Image scales to 100% (no contain/cover)
- Zoom in increases size
- Zoom out decreases size
- Scale badge shows "Scale 1.25x" (or similar)

Result: ✅ / ❌
Notes:
```

---

## P3: Navigation Tests

### P3.1: URL Navigation
```
Steps:
1. Click URL bar
2. Type "wikipedia.org" and press Enter

Expected:
- URL normalizes to https://
- Loading state appears
- Wikipedia homepage loads
- Status returns to Ready

Result: ✅ / ❌
Notes:
```

### P3.2: Back/Forward
```
Steps:
1. Navigate to page A
2. Navigate to page B
3. Click Back button (←)
4. Click Forward button (→)

Expected:
- Back navigates to page A
- Forward navigates back to page B
- URL bar updates
- Screenshot updates

Result: ✅ / ❌
Notes:
```

### P3.3: Reload
```
Steps:
1. Click Reload button (↻)

Expected:
- Loading state appears
- Page refreshes
- Screenshot updates

Result: ✅ / ❌
Notes:
```

---

## P4: Status Indicators

### P4.1: Connecting State
```
Steps:
1. Stop browser-runtime service
2. Open new browser capsule
3. Observe status

Expected:
- Status pill shows "○ Connecting..."
- Background yellow
- No screenshot displayed
- Placeholder content visible

Result: ✅ / ❌
Notes:
```

### P4.2: Loading State
```
Steps:
1. With service running
2. Navigate to a slow-loading page

Expected:
- Status pill shows "◐ Loading..."
- Background blue
- May show loading message

Result: ✅ / ❌
Notes:
```

### P4.3: Ready State
```
Steps:
1. After page fully loads

Expected:
- Status pill shows "● Ready"
- Background green
- Screenshot displayed

Result: ✅ / ❌
Notes:
```

### P4.4: Error State
```
Steps:
1. Type invalid URL (e.g., "not-a-real-domain.xyz")
2. Press Enter

Expected:
- Status pill shows "✕ Error"
- Background red
- Error message displayed

Result: ✅ / ❌
Notes:
```

---

## P5: Visual Polish Tests

### P5.1: Tab Switch Animation
```
Steps:
1. Create 2+ tabs
2. Switch between tabs quickly

Expected:
- Tab chip has slide-in animation when created
- Smooth transition between tabs
- No jarring cuts

Result: ✅ / ❌
Notes:
```

### P5.2: Mode Switch Animation
```
Steps:
1. Toggle between INSPECT and LIVE

Expected:
- Quick zoom-in + status glow animation (150-250ms)
- Smooth visual transition
- No abrupt switching

Result: ✅ / ❌
Notes:
```

### P5.3: Click Feedback
```
Steps:
1. In LIVE mode
2. Click on page

Expected:
- Pulse ring animation at click point
- 300ms animation duration
- Fades out smoothly

Result: ✅ / ❌
Notes:
```

### P5.4: Typing Echo
```
Steps:
1. In LIVE mode
2. Click on page (to focus)
3. Type some characters

Expected:
- Small keystroke indicator appears briefly
- Shows typed character
- Fades out after 500ms

Result: ✅ / ❌
Notes:
```

### P5.5: Toast Notifications
```
Steps:
1. Trigger a popup (window.open or target=_blank)

Expected:
- Toast appears at bottom center
- Shows "Opened new tab: [domain]"
- Stays for 2.5 seconds
- Fades out smoothly

Result: ✅ / ❌
Notes:
```

---

## P6: Edge Cases

### P6.1: Service Restart During Use
```
Steps:
1. With browser capsule open
2. Stop browser-runtime service
3. Restart service
4. Observe capsule behavior

Expected:
- Shows "Connecting..." state
- Reconnects automatically when service returns
- Restores previous state or shows error

Result: ✅ / ❌
Notes:
```

### P6.2: Invalid URL
```
Steps:
1. Type "asdfjkhl" (random string)
2. Press Enter

Expected:
- Graceful error handling
- Error state displayed
- No console errors

Result: ✅ / ❌
Notes:
```

### P6.3: Empty URL
```
Steps:
1. Click URL bar
2. Press Enter without typing

Expected:
- No crash
- Stays on current page or shows error

Result: ✅ / ❌
Notes:
```

### P6.4: Close Last Tab
```
Steps:
1. Open browser capsule (1 tab)
2. Click "×" on tab

Expected:
- Cannot close (button disabled or no effect)
- At least 1 tab always remains

Result: ✅ / ❌
Notes:
```

---

## Test Summary

| Category | Tests | Passed | Failed |
|----------|-------|--------|--------|
| P0: Critical Path | 5 | | |
| P1: Interaction Modes | 4 | | |
| P2: Viewport Controls | 3 | | |
| P3: Navigation | 3 | | |
| P4: Status Indicators | 4 | | |
| P5: Visual Polish | 5 | | |
| P6: Edge Cases | 4 | | |
| **Total** | **28** | | |

---

## Environment

- **OS**: macOS 25.2.0
- **Browser Runtime**: localhost:8001
- **Shell App**: localhost:5173
- **Tauri**: (optional) cargo tauri dev

## Browser Console Logs to Watch

```
[BrowserView] createView - Tauri context: { ... }
[BrowserView] Session created: session_...
[BrowserView] Intercepted popup: https://...
[BrowserView] Opened new tab: example.com
[BrowserView] INSPECT → LIVE mode switch
```

## Known Issues to Watch

1. **Coordinate mismatch** - Clicks may land on wrong element if viewport scaled
2. **FPS drops** - May see low FPS on complex pages
3. **Memory growth** - Screenshot blobs may accumulate if not cleaned up
4. **Popup detection** - Some popups may still escape

## Reporting Bugs

For each failed test, document:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser console output
5. Screenshot if visual issue
