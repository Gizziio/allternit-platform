# Terminal Patterns → UI Platform Mapping

This document tracks the extraction of patterns from the `7-apps/shell/terminal` (opencode fork) into the `6-ui/a2r-platform` React components.

## Pattern Extraction Status

| Terminal Pattern | UI Platform Location | Status | Notes |
|------------------|---------------------|--------|-------|
| `theme.ts` (A2R colors/states) | `design/theme/a2r-theme.ts` | ✅ Complete | Full theme system with runtime states |
| `status-bar.tsx` (Solid/Ink) | `design/components/StatusBar.tsx` | ✅ Complete | React port with same visual design |
| `useInterrupt()` hook | `design/useInterrupt.ts` | ✅ Complete | Double-esc pattern preserved |
| `useKeyboard()` hook | `design/useKeyboard.ts` | ✅ Complete | Keyboard shortcuts framework |
| Session streaming | `agent-workspace/useA2RStream.ts` | ✅ Complete | Integrated with workspace API |
| Session view | `components/workspace/SessionView.tsx` | ✅ Complete | Full session UI component |
| `agent-workspace` types | `agent-workspace/types.ts` | ✅ Updated | Added SessionStatus type |

## Architecture Mapping

### Terminal (TUI/Solid.js) → UI Platform (React/Electron)

```
┌─────────────────────────────────────────────────────────────────┐
│ Terminal App (7-apps/shell/terminal)                            │
├─────────────────────────────────────────────────────────────────┤
│ • Solid.js + Ink (terminal UI)                                  │
│ • @opencode-ai/sdk (HTTP client)                                │
│ • @opencode-ai/sdk/v2 (streaming types)                         │
│ • TUI server (axum HTTP server)                                 │
│ • Sidecar integration (Electron ↔ TUI)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Pattern Extraction
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI Platform (6-ui/a2r-platform)                                 │
├─────────────────────────────────────────────────────────────────┤
│ • React + Electron (desktop UI)                                 │
│ • agent-workspace (HTTP + WASM backends)                        │
│ • design/ (extracted terminal patterns)                         │
│   - theme/a2r-theme.ts (status colors, glyphs)                  │
│   - components/StatusBar.tsx (visual component)                 │
│   - useInterrupt.ts (double-esc cancel)                         │
│ • components/workspace/SessionView.tsx (integrated UI)          │
└─────────────────────────────────────────────────────────────────┘
```

## Key Patterns Ported

### 1. Runtime State System

**Terminal (Solid.js):**
```typescript
// ui/a2r/theme.ts
type A2RRuntimeState = 
  | "idle" | "connecting" | "hydrating" 
  | "planning" | "web" | "executing" 
  | "responding" | "compacting"
```

**UI Platform (React):**
```typescript
// design/theme/a2r-theme.ts
export type A2RRuntimeState = 
  | "idle" | "connecting" | "hydrating"
  | "planning" | "web" | "executing"
  | "responding" | "compacting"
```

### 2. Status Bar Component

**Terminal (Solid.js + Ink):**
```typescript
// ui/a2r/status-bar.tsx
interface StatusBarProps {
  status: SessionStatus
  parts: Part[]
  interrupt: () => void
  queuedSince?: number
  runId?: string
}
```

**UI Platform (React):**
```typescript
// design/components/StatusBar.tsx
export interface StatusBarProps {
  state: A2RRuntimeState
  isConnecting?: boolean
  pendingTools?: string[]
  retryAttempt?: number
  retryDelay?: number
  startedAt?: number
  compact?: boolean
  onInterrupt?: () => void
  interruptPending?: boolean
}
```

### 3. Interrupt Pattern (Double-Esc)

**Terminal:**
```typescript
// Hooks into terminal input stream
// First Esc: sets pending state, shows "Press again to interrupt"
// Second Esc: triggers actual cancel
```

**UI Platform:**
```typescript
// design/useInterrupt.ts
export function useInterrupt(): {
  pending: boolean
  trigger: () => void
  reset: () => void
}

// usageA2RStream.ts integrates this with workspace.cancel()
```

### 4. Session Streaming Hook

**Terminal:**
```typescript
// Integrated with @opencode-ai/sdk
// Real-time Part streaming from server
```

**UI Platform:**
```typescript
// agent-workspace/useA2RStream.ts
export function useA2RStream({
  workspace,
  autoConnect = true
}: UseA2RStreamOptions): UseA2RStreamReturn {
  // Maps workspace API to terminal-style streaming
  // Provides: state, isActive, interrupt, startSession, sendMessage
}
```

## Design Tokens Migration

| Token | Terminal Value | UI Platform Value |
|-------|---------------|-------------------|
| Status: idle | `#666666` | `#666666` |
| Status: connecting | `#f59e0b` | `#f59e0b` |
| Status: hydrating | `#3b82f6` | `#3b82f6` |
| Status: planning | `#8b5cf6` | `#8b5cf6` |
| Status: web | `#10b981` | `#10b981` |
| Status: executing | `#f59e0b` | `#f59e0b` |
| Status: responding | `#3b82f6` | `#3b82f6` |
| Status: compacting | `#8b5cf6` | `#8b5cf6` |
| Glyph: status | `◉` | `◉` |
| Glyph: tool | `⚡` | `⚡` |
| Glyph: separator | `•` | `•` |

## Integration Example

```typescript
import { SessionView } from "@a2r/platform/components/workspace"
import { A2RThemeProvider, defaultTheme } from "@a2r/platform/design"

function App() {
  return (
    <A2RThemeProvider theme={defaultTheme}>
      <SessionView 
        workspacePath="/path/to/workspace"
        compact={false}
      />
    </A2RThemeProvider>
  )
}
```

The SessionView component automatically:
1. Connects to workspace (HTTP or WASM)
2. Displays terminal-style status bar
3. Handles double-esc interrupt
4. Shows real-time streaming state
5. Provides message history

## Remaining Terminal → UI Migrations

Future patterns to extract:

1. **Command Palette** - Terminal's `:` command system → React command palette
2. **File Tree** - Terminal's file browser → React file explorer
3. **Diff View** - Terminal's code diff → React diff viewer
4. **Tool Output** - Terminal's tool rendering → React tool cards
5. **Chat Thread** - Terminal's message flow → React chat UI

## Package Renaming Status

As part of this extraction, the terminal app is being renamed from `opencode` to `a2r`:

| Old Name | New Name | Status |
|----------|----------|--------|
| `@opencode-ai/sdk` | `@a2r/sdk` | 🔄 In Progress |
| `@opencode-ai/plugin` | `@a2r/plugin` | 🔄 In Progress |
| `@opencode-ai/util` | `@a2r/util` | 🔄 In Progress |
| `opencode` CLI | `a2r-shell` CLI | ✅ Done |
| `OPENCODE=1` env | `A2R=1` env | 🔄 Pending |
| `opencode.db` marker | `a2r.db` marker | 🔄 Pending |

## Files Created/Modified

### New Files
- `design/theme/a2r-theme.ts` - Theme system
- `design/theme/index.ts` - Theme exports
- `design/components/StatusBar.tsx` - Status bar component
- `design/components/index.ts` - Component exports
- `agent-workspace/useA2RStream.ts` - Streaming hook
- `components/workspace/SessionView.tsx` - Integrated session UI

### Modified Files
- `design/index.ts` - Added theme/component exports
- `agent-workspace/types.ts` - Added SessionStatus type
- `agent-workspace/index.ts` - Added useA2RStream export
- `components/workspace/index.ts` - Added SessionView export

## Testing

To test the ported patterns:

1. **StatusBar:**
   ```bash
   cd 6-ui/a2r-platform
   npm run storybook  # View StatusBar in isolation
   ```

2. **SessionView:**
   ```bash
   cd 7-apps/shell/electron
   npm run dev  # Test full integration
   ```

3. **Streaming:**
   ```bash
   cd 7-apps/shell/terminal
   cargo run -- serve  # Start TUI server
   # Then open Electron app - it will auto-discover
   ```

---

*Document Version: 1.0*
*Last Updated: 2026-02-23*
*Status: Patterns Extracted, Integration Complete*
