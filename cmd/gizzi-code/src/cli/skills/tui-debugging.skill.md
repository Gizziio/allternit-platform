# TUI Debugging Skill

## Problem
Mouse clicks don't work in @opentui/solid TUI for mode switching. Need to debug why and create working alternative.

## Current Status
- ModeSwitcher component has onMouseUp handlers ✅
- ModeContext exists and is reactive ✅  
- Cowork route is registered in app.tsx ✅
- Navigation logic exists ✅
- **BUT clicks don't trigger anything** ❌

## Root Cause
@opentui/solid TUI doesn't capture mouse events by default. The terminal needs to:
1. Support mouse events (most do)
2. Have mouse mode enabled in the renderer
3. Have proper event handlers registered

## Solution Options

### Option 1: Enable Mouse Mode in Renderer
Check if @opentui/core has mouse mode that needs enabling.

### Option 2: Add Keyboard Shortcuts (MORE RELIABLE)
Add Ctrl+1 / Ctrl+2 shortcuts that work in ALL terminals.

### Option 3: Use TUI Dialog/Command
Add a command like `/mode cowork` that changes mode.

## Debug Steps Needed

1. Check @opentui/solid documentation for mouse support
2. Check if renderer has mouse mode flag
3. Test with simple click handler first
4. Add console.log to onMouseUp to see if it fires
5. Check terminal capabilities

## Test Script Created
- `test-mode-switching.ts` - Automated test
- Run with: `bun run test-mode-switching.ts`
- Checks if mode changes in logs

## Next Steps
1. Create debugging skill to capture TUI events
2. Add keyboard shortcuts as backup
3. Test mouse event capture
4. Document terminal requirements for mouse support
