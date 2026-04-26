# Allternit Stability-First Emergency Plan

## Status: STOP ALL FEATURE WORK

Do not implement patterns, inspectors, or changesets until:
1. ✅ Left rail renders
2. ✅ Chat composer visible
3. ✅ Mode switch works
4. ✅ Browser view shows content
5. ✅ No console errors

---

## Immediate Diagnostic (Do This Now)

### Step 1: Check Console Errors

Open DevTools in Electron and paste any errors here:

```
[USER: PASTE CONSOLE ERRORS]
```

### Step 2: Check Elements Panel

In Elements tab, search for:
- Does `.chat-composer` or similar exist?
- Does `ShellRail` render with width > 0?
- Any overlays with `pointer-events: auto` covering canvas?

### Step 3: Test Overlay Hypothesis

Temporarily disable overlays in `ShellApp.tsx`:

```tsx
// COMMENT OUT THESE LINES:
// <ShellOverlayLayer />
// <LegacyWidgetsLayer />
// <SidebarToggleWidget />
// <ModeSwitcherWidget />
```

If UI appears → **overlays are the problem**.
If UI still broken → **routing/render issue**.

---

## Quick Fixes (By Symptom)

### Symptom A: Chat Composer Missing

**Most likely cause:** Absolute positioning broken

**Fix:** Change to flex layout

**File:** `views/chat/ChatView.tsx` or chat container

```tsx
// CURRENT (broken - absolute positioning):
<div className="chat-container">
  <MessageList />
  <Composer className="absolute bottom-0" />  {/* BROKEN */}
</div>

// FIXED (flex layout):
<div style={{ 
  display: 'flex', 
  flexDirection: 'column', 
  height: '100%' 
}}>
  <div style={{ flex: 1, overflow: 'auto' }}>
    <MessageList />
  </div>
  <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--border-subtle)' }}>
    <Composer />
  </div>
</div>
```

---

### Symptom B: Left Rail Missing/Collapsed

**Most likely cause:** Width 0 or behind overlay

**Fix 1:** Check ShellRail width

**File:** `shell/ShellRail.tsx`

```tsx
// Ensure width is set:
<div style={{ 
  width: isCollapsed ? 0 : 284,
  minWidth: isCollapsed ? 0 : 284,  // ADD THIS
  // ...
}}>
```

**Fix 2:** Check ShellFrame grid

**File:** `shell/ShellFrame.tsx`

```tsx
// Ensure grid columns are correct:
<div style={{
  display: 'grid',
  gridTemplateColumns: isRailCollapsed ? '0px 1fr' : '284px 1fr',
  // NOT: 'auto 1fr' - use fixed px for rail
}}>
```

---

### Symptom C: Mode Switcher Duplicated or Broken

**Most likely cause:** Floating widgets + header both rendering

**Fix:** Remove floating widgets

**File:** `shell/ShellApp.tsx`

```tsx
// FIND AND DELETE:
<SidebarToggleWidget ... />
<ModeSwitcherWidget ... />

// KEEP ONLY:
<ShellHeader 
  mode={activeMode} 
  onModeChange={handleModeChange}
  // ... 
/>
```

---

### Symptom D: Browser View Blank

**Most likely cause:** 
- CSS variables missing (glass-bg-elevated, etc.)
- Webview/iframe not sizing correctly
- Electron BrowserView not attached

**Fix 1:** Check CSS variables exist

**File:** `design/theme.css`

```css
[data-theme='light'] {
  --glass-bg: rgba(253, 248, 243, 0.75);
  --glass-bg-elevated: rgba(253, 248, 243, 0.85);  /* MUST EXIST */
  --glass-bg-hover: rgba(245, 237, 227, 0.9);      /* MUST EXIST */
  --border-hover: rgba(154, 118, 88, 0.35);        /* MUST EXIST */
}
```

**Fix 2:** Check BrowserCapsule layout

**File:** `capsules/browser/BrowserCapsule.tsx`

```tsx
// Ensure flex layout:
<div style={{ 
  height: '100%',
  display: 'flex',
  flexDirection: 'column'
}}>
  <TabBar />
  <NavigationBar />
  <div style={{ flex: 1, position: 'relative' }}>
    <WebContent />
  </div>
</div>
```

**Fix 3:** Add iframe fallback for webview

**File:** `capsules/browser/BrowserCapsule.tsx`

```tsx
// In WebContent component:
const isElectron = !!(window as any).electron;

return (
  <div style={{ position: 'absolute', inset: 0 }}>
    {isElectron ? (
      <webview src={url} style={{ width: '100%', height: '100%' }} />
    ) : (
      <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} />
    )}
  </div>
);
```

---

## Emergency Shell Cleanup (Do This First)

### File: `shell/ShellApp.tsx`

**Current (bloated):**
```tsx
<ShellFrame
  rail={<ShellRail ... />}
  canvas={<ShellCanvas><ViewHost ... /></ShellCanvas>}
  overlays={<>
    <ShellOverlayLayer />
    <LegacyWidgetsLayer />
  </>}
/>
<SidebarToggleWidget />      {/* REMOVE */}
<ModeSwitcherWidget />       {/* REMOVE */}
<ConversationMonitorOverlay />
<ControlCenter />
```

**Clean (minimal):**
```tsx
<ShellFrame
  rail={<ShellRail ... />}
  canvas={<ShellCanvas><ViewHost ... /></ShellCanvas>}
/>
{/* All overlays removed for testing */}
```

Test if UI works. If yes, add overlays back one by one until you find the breaker.

---

## Golden Path Test Script

Run this checklist after each fix:

```markdown
## Layer-0: Shell Integrity
- [ ] Left rail visible (284px width)
- [ ] Rail icons clickable
- [ ] Mode switcher in header works
- [ ] No overlay blocking clicks (test by clicking rail items)

## Layer-1: Chat View  
- [ ] Message list renders
- [ ] Composer visible at bottom
- [ ] Can type in composer
- [ ] Send button clickable
- [ ] Messages scroll independently

## Layer-1: Browser View
- [ ] Browser tab opens
- [ ] URL bar visible
- [ ] Content area shows website (try example.com)
- [ ] Can navigate to different URLs

## Layer-0: No Errors
- [ ] Console has no red errors
- [ ] No "undefined" or "null" errors
- [ ] No CSS variable warnings
```

---

## What NOT To Do Right Now

❌ DO NOT:
- Add inspector/sidecar
- Implement ChangeSet review
- Add approval policies
- Create schema renderer
- Modify ShellFrame to 3-pane
- Add new stores

✅ DO:
- Fix broken layout
- Remove duplicate controls
- Ensure CSS variables exist
- Make composer visible
- Make rail visible
- Make browser work

---

## Next Steps

1. **Paste your console errors** so I can pinpoint the exact issue
2. **Try the overlay test** (comment out overlays)
3. **Check if CSS variables exist** in theme.css
4. **Apply fixes by symptom** above

Once Layer-0/1 works, we resume the pattern clone work.

---

*Stability-First Emergency Plan*
