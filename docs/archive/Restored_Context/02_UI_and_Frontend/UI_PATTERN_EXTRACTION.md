# UI Pattern Extraction - Terminal to Desktop Mapping

## Terminal App UI Components (`src/ui/allternit/`)

### 1. Status Bar (`status-bar.tsx`)
**Purpose**: Real-time session status display with animations

**Features**:
- Session state visualization (idle, connecting, planning, executing, etc.)
- Tool execution display
- Retry status with countdown
- Elapsed time tracking
- Interrupt handling (Esc key)
- Responsive layout (compact, narrow, micro modes)
- Animation system integration

**Desktop Mapping**: 
- **Component**: `shell/StatusBar.tsx` or `design/StatusBar.tsx`
- **Framework**: React (instead of Solid.js)
- **Notes**: Use React state instead of Solid signals

### 2. Spinner (`spinner.tsx`)
**Purpose**: Loading animation component

**Desktop Mapping**: 
- **Component**: Already exists in `design/` or create `Spinner.tsx`

### 3. Theme System (`theme.ts`)
**Purpose**: Centralized theming with colors, glyphs, tones

**Features**:
- Status colors (idle, connecting, executing, etc.)
- Glyphs/symbols for different states
- Accent colors and muted tones
- Brand integration

**Desktop Mapping**:
- **Component**: Extend existing `design/GlassSurface.tsx` or `design/theme.ts`
- **Notes**: Merge with existing Tailwind/glass morphism system

### 4. Runtime State Management (`status-runtime.ts`, `runtime-mode.ts`, `runtime-lane.ts`)
**Purpose**: Track and resolve runtime states

**Features**:
- State resolution logic
- Runtime mode detection
- Lane management for parallel execution

**Desktop Mapping**:
- **Component**: React hooks in `hooks/useRuntime.ts`
- **Notes**: Adapt Solid stores to React context/Zustand

### 5. Inline Block Display (`inline-block.tsx`, `inline-coerce.ts`)
**Purpose**: Content rendering with type coercion

**Features**:
- Message part rendering
- Type coercion for different content types
- Text wrapping and formatting

**Desktop Mapping**:
- **Component**: `components/MessageBlock.tsx`
- **Notes**: Adapt to React with proper types

### 6. Banner (`banner.tsx`)
**Purpose**: Application banner/branding display

**Desktop Mapping**:
- **Component**: `shell/ShellHeader.tsx` or existing header

### 7. Frame (`frame.tsx`)
**Purpose**: Container/wrapper component

**Desktop Mapping**:
- **Component**: `design/GlassCard.tsx` or `GlassSurface.tsx`

### 8. Header (`header.tsx`)
**Purpose**: Application header with branding

**Desktop Mapping**:
- **Component**: `shell/ShellApp.tsx` header section

### 9. Message List (`message-list.tsx`)
**Purpose**: List of messages/chat history

**Desktop Mapping**:
- **Component**: `views/chat/` or existing chat components

### 10. Provider (`provider.tsx`)
**Purpose**: Context providers for theme/state

**Desktop Mapping**:
- **Component**: React Context in `contexts/` or existing providers

---

## Animation System (`src/ui/animation/`)

### Components:
1. **Driver** (`driver.ts`) - Animation driver loop
2. **Registry** (`registry.ts`) - Animation registration
3. **Types** (`types.ts`) - Type definitions

**Desktop Mapping**:
- Replace with Framer Motion or CSS animations
- React Spring as alternative
- Or keep and adapt the animation system

---

## TUI-Specific Components (`src/cli/cmd/tui/`)

These are terminal-specific and need rethinking for desktop:

| Terminal Component | Desktop Equivalent | Approach |
|-------------------|-------------------|----------|
| `prompt/index.tsx` | Chat input | Use existing `AgentRunnerPanel.tsx` |
| `routes/session/` | Chat view | Use existing `ChatView.tsx` |
| `component/dialog-*.tsx` | Modals/Dialogs | Use existing modal system |
| `hooks/useSearch.ts` | Search hook | Port to React |
| `context/sync.tsx` | Sync context | Port to React Context |
| `context/sdk.tsx` | SDK context | Port to React Context |

---

## Pattern Mapping Strategy

### 1. State Management

**Terminal (Solid.js)**:
```typescript
const [state, setState] = createSignal("idle")
const computed = createMemo(() => state() === "idle")
createEffect(() => { /* side effect */ })
```

**Desktop (React)**:
```typescript
const [state, setState] = useState("idle")
const computed = useMemo(() => state === "idle", [state])
useEffect(() => { /* side effect */ }, [state])
```

### 2. Context/Providers

**Terminal (Solid)**:
```typescript
const ThemeContext = createContext<Theme>()
<ThemeContext.Provider value={theme}>
  {children}
</ThemeContext.Provider>
const theme = useContext(ThemeContext)
```

**Desktop (React)**:
```typescript
const ThemeContext = createContext<Theme>(defaultTheme)
<ThemeContext.Provider value={theme}>
  {children}
</ThemeContext.Provider>
const theme = useContext(ThemeContext)
```

### 3. Component Structure

**Terminal (Ink/Solid)**:
```typescript
<box flexDirection="row">
  <text>{content}</text>
</box>
```

**Desktop (React/HTML)**:
```typescript
<div className="flex flex-row">
  <span>{content}</span>
</div>
```

---

## Components to Port (Priority Order)

### High Priority
1. **Status Bar** - Critical for session feedback
2. **Theme System** - Consistent branding
3. **Spinner/Loading States** - User feedback
4. **Message Rendering** - Core chat functionality

### Medium Priority
5. **Banner/Header** - Branding
6. **Frame Components** - Layout
7. **Animation System** - Polish

### Low Priority
8. **TUI-specific Components** - Re-evaluate need

---

## Implementation Plan

### Phase 1: Theme & Status (This Session)
1. Extract theme configuration from `theme.ts`
2. Create React version of status bar
3. Integrate with existing design system

### Phase 2: Message Components (Next)
1. Port message rendering logic
2. Adapt inline-block system
3. Integrate with chat view

### Phase 3: Animation (Future)
1. Evaluate animation needs
2. Port or replace animation system
3. Integrate Framer Motion if needed

### Phase 4: Full Integration (Future)
1. Port remaining TUI components
2. Unify state management
3. Test full workflow
