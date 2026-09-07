# Gizzi Ink TUI - Agent Handoff Document

## Mission
Port the **complete Ink-based TUI implementation** from `free-code` to `gizzi-code`, replacing the current minimal Ink app with full Claude Code feature parity.

## Source of Truth
**free-code repository** (`/Users/macbook/free-code/`)
- This is the leaked Claude Code codebase ported to Ink (React)
- 1,909 TypeScript files, 33MB of source
- Fully functional Ink-based TUI with all features

## Destination
**gizzi-code** (`/Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code/src/cli/ui/ink-app/`)
- Currently has minimal Ink implementation (boot, discretion, basic main screen)
- Build compiles to 80MB binary ✓
- Needs full feature port from free-code

## Key Directories Mapping

### Source (free-code)
```
/Users/macbook/free-code/src/
├── ink/                          # Core Ink components
│   ├── components/               # Box, Text, ScrollBox, etc.
│   ├── hooks/                    # Terminal hooks
│   └── layout/                   # Layout engine
├── components/                   # 349 React components
│   ├── PromptInput/              # Input with history, autocomplete
│   ├── messages/                 # Message rendering
│   ├── diff/                     # Diff visualization
│   └── permissions/              # Permission dialogs
├── screens/
│   └── REPL.tsx                  # Main session screen (3000+ lines)
├── hooks/                        # 87 custom hooks
├── commands/                     # 207 slash commands
├── tools/                        # 184 tool implementations
└── context/                      # React contexts
```

### Destination (gizzi-code ink-app)
```
src/cli/ui/ink-app/
├── app.tsx                       # Entry point
├── components/
│   ├── screens/                  # Boot, Discretion, Main
│   ├── CommandPalette.tsx        # NEW: Basic command palette started
│   └── messages/                 # Basic message components
├── hooks/
│   └── useCommandRegistry.ts     # NEW: Command registration
├── services/
│   └── harness.ts                # NEW: Harness integration
├── types.ts                      # Extended with CommandOption
└── vendor/                       # Copied from free-code (partial)
    ├── Messages.tsx
    ├── Message.tsx
    └── PromptInput/
```

## What's Already Done

### Working ✓
1. Build pipeline (80MB binary)
2. 3-phase flow: Boot → Discretion → Main
3. Basic command palette with:
   - Slash command detection (/)
   - Ctrl+P to open
   - Category grouping
   - Keyboard navigation (↑↓)
4. Harness service integration stub
5. React symlinks fix for monorepo

### Started but Incomplete
- Command registry system (hooks/useCommandRegistry.ts)
- Theme context (basic, not integrated)

## What Needs to Be Ported (Priority Order)

### P0: Core Infrastructure
1. **Copy `/free-code/src/ink/` → `/gizzi-code/src/cli/ui/ink-app/core/`**
   - Box.tsx, Text.tsx, ScrollBox.tsx
   - All hooks (useTerminalSize, useInput, etc.)
   - Layout engine

2. **Copy `/free-code/src/screens/REPL.tsx`**
   - This IS the main screen implementation
   - 3000+ lines, fully featured
   - Handles: messages, input, permissions, tools, status

3. **Message System**
   - `/free-code/src/components/Messages.tsx`
   - `/free-code/src/components/Message.tsx`
   - `/free-code/src/components/MessageRow.tsx`
   - `/free-code/src/components/VirtualMessageList.tsx`

### P1: Input System
4. **PromptInput** (already partially copied to vendor/)
   - Full path: `/free-code/src/components/PromptInput/`
   - Has: autocomplete, history, vim mode, paste handling
   - 15+ files in subdirectory

### P2: Dialogs
5. **All 45 dialogs from `/free-code/src/components/`**
   - Command palette (different from current basic one)
   - Model picker
   - Session list
   - Settings
   - Help
   - etc.

### P3: Tools & Permissions
6. **Tool visualization**
   - `/free-code/src/components/FileEditToolDiff.tsx`
   - Tool execution status
   - Permission request dialogs

### P4: Context & State
7. **Contexts**
   - `/free-code/src/context/` (notifications, etc.)
   - `/free-code/src/state/AppState.ts`

## Integration Points

### Harness Integration
Current: `src/cli/ui/ink-app/services/harness.ts`
- Uses `@allternit/sdk` AllternitHarness
- Needs to match free-code's API call patterns

### Command Registration
Current: `src/cli/ui/ink-app/hooks/useCommandRegistry.ts`
- Needs to match free-code's command system in `/free-code/src/commands.ts`

### Theme System
Current: `src/cli/ui/ink-app/context/ThemeContext.tsx`
- Needs to integrate with free-code's theme tokens

## Build & Test

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code

# Build
bun run build

# Test binary
./dist/gizzi-code-darwin-arm64 ink

# Run in dev mode
bun run ink
```

## Critical Files to Read First

1. `/Users/macbook/free-code/src/screens/REPL.tsx` - Main entry point
2. `/Users/macbook/free-code/src/ink.tsx` - Ink exports
3. `/Users/macbook/free-code/src/components/Messages.tsx` - Message rendering
4. `/Users/macbook/free-code/src/commands.ts` - Command definitions
5. `/Users/macbook/free-code/src/hooks/` - Custom hooks

## Architecture Decision

**USE FREE-CODE'S PATTERNS EXACTLY**
- Copy components 1:1
- Adapt import paths
- Keep component structure identical
- Don't reinvent - free-code already solved these problems

## Known Issues to Watch

1. **Import paths** - free-code uses `../` relative imports
   - Map to `@/cli/ui/ink-app/` for gizzi-code

2. **Feature flags** - free-code uses `feature('FLAG_NAME')`
   - May need to strip or mock these

3. **Dependencies** - free-code has many internal dependencies
   - Port only what's needed for TUI
   - Mock/stub service-layer dependencies

4. **Monorepo React** - Already fixed with symlinks
   - node_modules/react → .bun/react@19.2.4
   - Don't break this

## Success Criteria

- [ ] Main screen looks and functions like Claude Code
- [ ] All 207 slash commands work
- [ ] Model picker dialog functional
- [ ] Tool execution visualization
- [ ] Message search (/)
- [ ] Message jumping (:)
- [ ] Bookmarks (m key)
- [ ] Code block copy (y key)
- [ ] Full status bar
- [ ] Session management

## Previous Agent Mistakes to Avoid

1. ❌ Don't reference OpenTUI (SolidJS) - use free-code (Ink/React)
2. ❌ Don't rebuild from scratch - copy and adapt
3. ❌ Don't create new patterns - follow free-code exactly
4. ✅ Copy entire components, then strip what doesn't compile
5. ✅ Test incrementally - get basic layout working first

## Context Summary

**Why we're doing this:**
- gizzi-code has OpenTUI (SolidJS) implementation
- Want to move to Ink (React) like free-code
- OpenTUI has limitations, Ink is more standard
- free-code has the full implementation we want

**Current blocker:**
- Need systematic port of free-code's Ink components
- Started with CommandPalette but need full REPL.tsx

**Next step:**
Copy `/free-code/src/screens/REPL.tsx` and all its dependencies into gizzi-code's ink-app, adapting imports as needed.
