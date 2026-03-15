# Gizzi UI Fixes Summary

## Issues Fixed

### 1. SessionMount Box Redesign
**File:** `cmd/gizzi-code/src/cli/ui/tui/component/session-mount.tsx`

**Changes:**
- Removed duplicate mascot display above SessionMount
- Integrated mascot into SessionMount box with status hint
- Added proper spacing between elements
- Fixed text layout (Tokens and Agent on separate lines with proper spacing)
- Changed padding/gap values from strings to numbers

**Before:**
- Broken mascot in SessionMount box
- Separate mascot above showing "Gizzi is steady"
- "Tokens: 0Agent: OFF" (missing space)

**After:**
- Full mascot inside SessionMount with hint text
- Organized 3 rows: Mascot+Hint | Session Info | Stats
- "Tokens: 0" and "Agent: OFF" properly separated

### 2. Sidebar/Right Rail Font Fixes
**File:** `cmd/gizzi-code/src/cli/ui/tui/routes/session/sidebar.tsx`

**Changes:**
- Converted all string padding/gap values to numbers
- `paddingTop="1"` → `paddingTop={1}`
- `gap="1"` → `gap={1}`
- Fixed layout consistency

### 3. LayerExplorer Tree View Fixes
**File:** `cmd/gizzi-code/src/cli/ui/tui/component/layer-explorer.tsx`

**Changes:**
- Replaced emoji icons with ASCII characters:
  - 📂/📁 → v/>
  - 📝 → ●
  - 📄 → ○
- Converted string gap/padding values to numbers
- Fixed indentation calculation

### 4. Session Index Layout Fixes
**File:** `cmd/gizzi-code/src/cli/ui/tui/routes/session/index.tsx`

**Changes:**
- Converted all string margin/padding/gap values to numbers
- `marginTop="1"` → `marginTop={1}`
- `paddingTop="1"` → `paddingTop={1}`
- `gap="1"` → `gap={1}`

## Files Modified

1. `cmd/gizzi-code/src/cli/ui/tui/component/session-mount.tsx` - Redesigned with integrated mascot
2. `cmd/gizzi-code/src/cli/ui/tui/routes/session/index.tsx` - Removed duplicate mascot, updated SessionMount usage
3. `cmd/gizzi-code/src/cli/ui/tui/routes/session/sidebar.tsx` - Fixed string values
4. `cmd/gizzi-code/src/cli/ui/tui/component/layer-explorer.tsx` - Fixed icons and string values

## Testing

Run to verify:
```bash
cd cmd/gizzi-code
bun run --conditions=browser ./src/cli/main.ts
```

The TUI should now display:
- Proper mascot in SessionMount box
- Organized text layout
- Clean sidebar with ASCII icons
- Proper spacing throughout
