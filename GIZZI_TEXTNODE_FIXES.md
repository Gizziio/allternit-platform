# Gizzi TextNodeRenderable Error Fixes

## Problem
The TUI was crashing with:
```
Error: TextNodeRenderable only accepts strings, TextNodeRenderable instances, or StyledText instances
```

## Root Causes Fixed

### 1. Nested `<text>` elements (session-mount.tsx)
**File:** `cmd/gizzi-code/src/cli/ui/tui/component/session-mount.tsx`

**Problem:** `<text>` elements cannot contain other `<text>` elements in @opentui/core.

**Before:**
```tsx
<text fg={theme.textMuted}>
  Tokens: <text fg={theme.text}>{String(tokenCount())}</text>
</text>
```

**After:**
```tsx
<text fg={theme.textMuted}>
  Tokens: <span style={{ fg: theme.text }}>{String(tokenCount())}</span>
</text>
```

### 2. Undefined values from array split (mascot.tsx)
**File:** `cmd/gizzi-code/src/cli/ui/components/gizzi/mascot.tsx`

**Problem:** When splitting strings by tokens, array elements could be `undefined` if the token wasn't found, causing errors when passed to `<span>` elements.

**Before:**
```tsx
const parts = line.split("▄▄")
return (
  <text fg={coral}>
    <span>{parts[0]}</span>
    <span>{parts[1]}</span>
  </text>
)
```

**After:**
```tsx
const parts = line.split("▄▄")
return (
  <text fg={coral}>
    <span>{parts[0] ?? ""}</span>
    <span>{parts[1] ?? ""}</span>
  </text>
)
```

**Fixed 6 locations:**
- Line 58, 60: Beacon detection (parts[0], parts[1])
- Line 70, 72, 74: Antenna blocks (parts[0], parts[1], parts[2])
- Line 85, 87: Eye panel full (parts[0], parts[1])
- Line 98, 100: Mouth panel full (parts[0], parts[1])
- Line 133, 135: Eye panel compact (parts[0], parts[1])
- Line 146, 148: Mouth panel compact (parts[0], parts[1])

### 3. Potential undefined from .at() (sidebar.tsx)
**File:** `cmd/gizzi-code/src/cli/ui/tui/routes/session/sidebar.tsx`

**Problem:** `array.at(-1)` can return undefined for empty arrays.

**Before:**
```tsx
<span style={{ fg: theme.text }}>{directory().split("/").at(-1)}</span>
```

**After:**
```tsx
<span style={{ fg: theme.text }}>{directory().split("/").at(-1) ?? ""}</span>
```

## Verification

Run the CLI to verify fixes:
```bash
cd cmd/gizzi-code
bun run --conditions=browser ./src/cli/main.ts --help
```

The TUI should start without the TextNodeRenderable error.

## Files Modified
1. `cmd/gizzi-code/src/cli/ui/tui/component/session-mount.tsx`
2. `cmd/gizzi-code/src/cli/ui/components/gizzi/mascot.tsx`
3. `cmd/gizzi-code/src/cli/ui/tui/routes/session/sidebar.tsx`
