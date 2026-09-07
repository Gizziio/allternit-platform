# Ink TUI Quick Start for New Agent

## 30-Second Context
We need to port **free-code's Ink TUI** (`/Users/macbook/free-code/`) to **gizzi-code** (`src/cli/ui/ink-app/`). 

free-code = Full Claude Code implementation in Ink (React)
gizzi-code = Has minimal Ink app, needs full features

## Key Commands
```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code

# Build and test
bun run build && ./dist/gizzi-code-darwin-arm64 ink

# Watch mode
bun run ink
```

## Critical Files to Copy First

### 1. Core Ink Components
Source: `/Users/macbook/free-code/src/ink/components/`
Dest: `src/cli/ui/ink-app/core/`
Files:
- `Box.tsx`, `Text.tsx`, `ScrollBox.tsx`
- `App.tsx`, `Button.tsx`
- All context files (`*Context.ts`)

### 2. Main Screen
Source: `/Users/macbook/free-code/src/screens/REPL.tsx`
Dest: `src/cli/ui/ink-app/screens/MainScreen.tsx`

### 3. Message Components
Source: `/Users/macbook/free-code/src/components/Messages.tsx`
Dest: `src/cli/ui/ink-app/components/Messages.tsx`

Also copy:
- `Message.tsx`
- `MessageRow.tsx`
- `VirtualMessageList.tsx`

### 4. Input Component
Source: `/Users/macbook/free-code/src/components/PromptInput/`
Dest: `src/cli/ui/ink-app/components/PromptInput/`

## Import Mapping

| free-code | gizzi-code |
|-----------|------------|
| `from '../ink.js'` | `from './core/ink.js'` |
| `from '../utils/'` | `from '@/shared/util/'` |
| `from '../hooks/'` | `from './hooks/'` |
| `from '../components/'` | `from './components/'` |

## Integration with Gizzi

### Hook up Harness
File: `src/cli/ui/ink-app/services/harness.ts`
- Already created
- Connects to @allternit/sdk
- Use this for AI backend calls

### App Entry Point
File: `src/cli/ui/ink-app/app.tsx`
- Currently has 3-phase flow (boot, discretion, main)
- Replace MainScreen with ported REPL.tsx

## Testing Checklist

- [ ] Build compiles without errors
- [ ] Binary runs: `./dist/gizzi-code-darwin-arm64 ink`
- [ ] Boot screen shows
- [ ] Discretion screen shows
- [ ] Main screen loads with messages
- [ ] Input accepts text
- [ ] Commands work (type /)

## Don't Do These

❌ Import from OpenTUI (SolidJS)
❌ Create new component patterns
❌ Rebuild from scratch
❌ Change the Ink architecture

## Do These

✅ Copy entire files from free-code
✅ Adapt import paths only
✅ Keep component structure identical
✅ Test after each major copy

## Getting Help

Read the source:
- `/Users/macbook/free-code/src/screens/REPL.tsx` - Main reference
- `/Users/macbook/free-code/src/ink.tsx` - Core exports

Check what's working:
- Run `./dist/gizzi-code-darwin-arm64 ink`
- Use the TUI, see what's missing

## Current State

Working:
- Build pipeline ✓
- Basic 3-phase flow ✓
- Simple command palette ✓

Not Working (Need to Port):
- Full message list
- Model picker
- Tool visualization
- Session management
- All slash commands
- Status bar

## Next Agent Action

1. Read `INK_TUI_HANDOFF.md`
2. Copy `/free-code/src/ink/components/*` to `src/cli/ui/ink-app/core/`
3. Copy `/free-code/src/screens/REPL.tsx` to `src/cli/ui/ink-app/screens/`
4. Fix imports, test build
5. Copy message components
6. Copy PromptInput components
7. Integrate with harness service
