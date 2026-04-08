# ShellRail Debugging Guide

**Date:** 2026-02-24  
**Status:** Debug logging added - CHECK BROWSER CONSOLE

---

## How to Debug

1. **Open the app** in your browser at `http://127.0.0.1:5177`
2. **Open Browser DevTools** (F12 or Cmd+Option+I)
3. **Go to Console tab**
4. **Refresh the page** (Cmd+R)
5. **Look for these console logs:**

---

## Console Logs to Check

### 1. ShellFrame Logs (Check if rail is being passed)

```
[ShellFrame] Props received: { hasRail: true/false, hasCanvas: true, isRailCollapsed: false }
[ShellFrame] About to render, rail type: object/undefined
```

**What to look for:**
- `hasRail: true` means ShellRail is being passed to ShellFrame ✅
- `hasRail: false` means ShellRail is NOT being passed ❌
- `rail type: object` means it's a valid ReactNode ✅
- `rail type: undefined` means something is wrong ❌

---

### 2. ShellRail Config Logs (Check which config is loaded)

```
[ShellRail] activeConfig: {
  mode: 'chat'/'cowork'/'code'/'global',
  configName: 'RAIL'/'COWORK'/'CODE',
  sections: 12,
  coreSection: { id: 'core', title: 'Core', items: [...] }
}
```

**What to look for:**
- `mode` should be one of: 'chat', 'cowork', 'code', 'global'
- `sections` should be > 0 (probably around 12)
- `coreSection` should exist and have items array with 4 items

---

### 3. ShellRail Rendering Logs (Check if items are rendering)

```
[ShellRail] Rendering category: core isCore: true isFolded: false items: 4
[ShellRail] Mapping item for category core : home Home
[ShellRail] Mapping item for category core : new-chat New Chat
[ShellRail] Mapping item for category core : browser Browser
[ShellRail] Mapping item for category core : elements Elements Lab
```

**What to look for:**
- First log should show `items: 4` for core
- Should see 4 "Mapping item" logs for Home, New Chat, Browser, Elements Lab
- If you DON'T see these logs, the items aren't being mapped

---

## What to Report Back

After checking the console, tell me:

1. **What does `[ShellFrame] Props received` show?**
   - Is `hasRail` true or false?
   - What is `rail type`?

2. **What does `[ShellRail] activeConfig` show?**
   - What is the `mode`?
   - How many `sections`?
   - Does `coreSection` exist?

3. **What does `[ShellRail] Rendering category` show for core?**
   - Does it say `items: 4` or `items: 0`?
   - Do you see the 4 "Mapping item" logs?

4. **Can you SEE the ShellRail visually?**
   - Yes/No
   - If yes, what sections can you see?
   - If no, is there just empty space?

5. **Take a screenshot** of:
   - The full app window
   - The console logs

---

## Files Modified (with debug logging)

1. **ShellFrame.tsx** - Logs props received
2. **ShellRail.tsx** - Logs activeConfig and item rendering
3. **All changes have console.log for debugging**

---

## Expected Behavior

When working correctly, you should see:

**Visually:**
```
┌─────────────────────────────────────────┐
│ ShellHeader (64px)                      │
├─────────────┬───────────────────────────┤
│ ShellRail   │ Canvas                    │
│ (284px)     │                           │
│             │                           │
│ CORE        │                           │
│ ├─ Home     │                           │
│ ├─ New Chat │                           │
│ ├─ Browser  │                           │
│ └─ Elements │                           │
│             │                           │
│ ▼ CONVERSATIONS                         │
│ ├─ Projects                             │
│ └─ Threads                              │
│             │                           │
│ [other sections collapsed]              │
│             │                           │
│ [User Footer]                           │
└─────────────┴───────────────────────────┘
```

**In Console:**
```
[ShellFrame] Props received: { hasRail: true, hasCanvas: true, isRailCollapsed: false }
[ShellFrame] About to render, rail type: object
[ShellRail] activeConfig: { mode: 'chat', configName: 'RAIL', sections: 12, ... }
[ShellRail] Rendering category: core isCore: true isFolded: false items: 4
[ShellRail] Mapping item for category core : home Home
[ShellRail] Mapping item for category core : new-chat New Chat
[ShellRail] Mapping item for category core : browser Browser
[ShellRail] Mapping item for category core : elements Elements Lab
```

---

## Next Steps

Once you provide the console output and screenshots, I can:
1. Identify exactly where the rendering is breaking
2. Fix the specific issue
3. Remove debug logs
4. Verify the fix works

**Please run the app and share the console output!**
