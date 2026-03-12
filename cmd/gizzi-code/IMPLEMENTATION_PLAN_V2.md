# Gizzi Code - Implementation Plan (Corrected)

## Overview
Two modes with mode switcher in top right corner:
1. **Code Mode** - Regular terminal coding
2. **Cowork Mode** - Collaborative workspace with viewport

---

## What to Build

### 1. Mode Switcher Component ✅ (Done)
**File:** `src/cli/ui/tui/component/mode-switcher.tsx`

**Features:**
- Pill-style buttons (Code | Cowork)
- Clickable (mouse support)
- Green accent for Code, Purple for Cowork
- Can be placed in top right corner

**Usage:**
```tsx
<ModeSwitcher
  activeMode={mode()}
  onModeChange={(newMode) => setMode(newMode)}
  size="medium"
  showLabels={true}
/>
```

---

### 2. Onboarding Wizard Integration
**File:** `src/cli/ui/tui/component/onboarding-mode-selection.tsx` ✅ (Done)

**Placement in Wizard Flow:**
1. Theme selection
2. **Mode selection** ← NEW STEP
3. Account setup
4. Provider configuration
5. Completion

**What it does:**
- Shows mode switcher preview
- Explains each mode
- User selects default mode
- Persists selection

---

### 3. Main Screen Layout (To Build)

#### Current Structure (to modify):
```tsx
// Top bar layout
<header>
  <left>GIZZI Logo</left>
  <right>[STATUS]</right>  ← Replace with Mode Switcher
</header>
```

#### New Structure:
```tsx
<header>
  <left>GIZZI Logo</left>
  <right>
    <ModeSwitcher activeMode={mode()} onModeChange={...} />
  </right>
</header>
```

**Files to modify:**
- `src/cli/ui/tui/routes/home.tsx` - Main screen
- `src/cli/ui/tui/routes/session.tsx` - Code mode (rename from current)
- `src/cli/ui/tui/routes/cowork.tsx` - Cowork mode (rebuild)

---

### 4. Mode Persistence
**File:** `src/cli/ui/tui/component/mode-switcher.tsx` (already included)

**Storage:**
- Use KV store (existing in gizzi-code)
- Key: `gizzi-mode`
- Default: `"code"`

**Implementation:**
```typescript
const { mode, setMode } = useModePersistence()
// Returns: { mode: "code" | "cowork", setMode: (m) => void }
```

---

### 5. Cowork Mode Viewport (To Build)

**Requirements:**
- Right side dynamic viewport
- Display: browser previews, artifacts, images
- Based on research: Use iTerm2/kitty protocol for images

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│  [Logo]                          [Mode Switcher] [🟢]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌───────────────────────┐  ┌──────────────────────┐   │
│  │                       │  │  VIEWPORT            │   │
│  │   Terminal/Code       │  │  (Dynamic Display)   │   │
│  │                       │  │                      │   │
│  │   (left side)         │  │  - Browser previews  │   │
│  │                       │  │  - Images            │   │
│  │                       │  │  - Artifacts         │   │
│  │                       │  │  - Media             │   │
│  └───────────────────────┘  └──────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Implementation Phases:**

#### Phase 1: Basic Layout (1-2 days)
- [ ] Split view (left terminal, right viewport container)
- [ ] Resizable panes
- [ ] Basic viewport placeholder

#### Phase 2: Image Display (2-3 days)
- [ ] Detect terminal (iTerm2 vs others)
- [ ] Implement iTerm2 inline image protocol
- [ ] Implement kitty graphics protocol
- [ ] Fallback to ASCII
- [ ] Test with sample images

#### Phase 3: Browser Previews (3-5 days)
- [ ] Integrate Puppeteer
- [ ] Screenshot capture
- [ ] Display in viewport
- [ ] Keyboard navigation (links, forms)

#### Phase 4: Artifacts (2-3 days)
- [ ] File preview component
- [ ] Markdown rendering (use `marked` library)
- [ ] Diff views (use `diff` library)
- [ ] Image gallery

#### Phase 5: Full Interactivity (5-7 days)
- [ ] Embedded WebView OR
- [ ] Browser window integration
- [ ] Mouse/keyboard passthrough
- [ ] State synchronization

---

### 6. Agent Toggle (Separate from Mode)

**Concept:**
- Independent toggle (ON/OFF)
- Works in both Code and Cowork modes
- When ON: Agent is mounted in current mode
- When OFF: Standard terminal without agent

**UI Placement:**
```
[Logo]  [Mode: Code|Cowork]  [Agent: ON/OFF]  [Status]
```

**Implementation:**
```tsx
// Agent toggle component
<AgentToggle
  enabled={agentEnabled()}
  onToggle={() => setAgentEnabled(!agentEnabled())}
/>
```

---

## File Structure

```
src/cli/ui/tui/
├── component/
│   ├── mode-switcher.tsx ✅
│   ├── onboarding-mode-selection.tsx ✅
│   ├── agent-toggle.tsx (to build)
│   └── cowork/
│       ├── viewport.tsx (to build)
│       ├── browser-preview.tsx (to build)
│       ├── artifact-display.tsx (to build)
│       └── image-viewer.tsx (to build)
│
├── routes/
│   ├── home.tsx (modify - add mode switcher)
│   ├── session.tsx (Code mode - keep mostly as-is)
│   └── cowork.tsx (rebuild - viewport layout)
│
└── context/
    └── mode.tsx (to build - mode state management)
```

---

## Terminal Graphics Implementation

### For Apple Terminal.app (your current terminal):
- ❌ No kitty protocol support
- ❌ No sixel support
- ❌ No inline images
- ✅ **ASCII fallback works**
- ✅ **External browser window works**

### Recommendation for You:
1. **Development**: Use ASCII fallback + external browser
2. **Production**: Support iTerm2/kitty for users who have them
3. **Best UX**: Hybrid approach (TUI + browser window)

### Implementation:
```typescript
// Auto-detect terminal capabilities
function detectTerminal() {
  const term = process.env.TERM_PROGRAM
  if (term === 'iTerm2') return 'iterm2'
  if (term === 'kitty') return 'kitty'
  return 'ascii' // fallback
}

// Display image based on terminal
function displayImage(buffer: ArrayBuffer) {
  const terminal = detectTerminal()
  
  if (terminal === 'iterm2') {
    // Use iTerm2 protocol
    displayITerm2Image(buffer)
  } else if (terminal === 'kitty') {
    // Use kitty protocol
    displayKittyImage(buffer)
  } else {
    // ASCII fallback
    displayASCIIImage(buffer)
  }
}
```

---

## Priority Order

### Week 1: Foundation
1. ✅ Mode switcher component
2. ✅ Onboarding integration
3. ⏳ Add mode switcher to main screen (top right)
4. ⏳ Mode persistence (KV store)
5. ⏳ Basic Cowork layout (split view)

### Week 2: Viewport Basics
1. ⏳ Image display (iTerm2/kitty/ASCII)
2. ⏳ Terminal detection
3. ⏳ Basic artifact display
4. ⏳ Markdown rendering

### Week 3: Browser Integration
1. ⏳ Puppeteer integration
2. ⏳ Screenshot capture
3. ⏳ Keyboard navigation
4. ⏳ State sync

### Week 4: Polish & Agent Toggle
1. ⏳ Agent toggle component
2. ⏳ Full interactivity (WebView or browser window)
3. ⏳ Testing and bug fixes
4. ⏳ Documentation

---

## Next Steps (Immediate)

### 1. Add Mode Switcher to Main Screen
**File:** `src/cli/ui/tui/routes/home.tsx`

```tsx
// In header, top right corner
<ModeSwitcher
  activeMode={currentMode()}
  onModeChange={(mode) => navigateToMode(mode)}
  size="medium"
  showLabels={true}
/>
```

### 2. Create Mode Context
**File:** `src/cli/ui/tui/context/mode.tsx`

```typescript
// Mode state management
export const ModeProvider = /* ... */
export const useMode = () => /* ... */
```

### 3. Update Cowork Route
**File:** `src/cli/ui/tui/routes/cowork.tsx`

- Currently a placeholder
- Rebuild with split-view layout
- Add viewport container

### 4. Test Mode Switching
- Switch between Code/Cowork
- Verify persistence
- Test in onboarding

---

## Questions to Confirm

1. **Terminal**: You're using Apple Terminal.app - should I implement ASCII fallback first?
2. **Viewport Priority**: Browser previews or artifacts first?
3. **Interactivity**: Do you want hybrid (browser window) or pure TUI approach?
4. **Agent Toggle**: Should this be built before or after viewport?

---

## Status

✅ **Completed:**
- Mode switcher component
- Onboarding mode selection
- Terminal graphics research

⏳ **In Progress:**
- Nothing yet (waiting for approval)

⏸️ **On Hold:**
- Everything else (pending your direction)
