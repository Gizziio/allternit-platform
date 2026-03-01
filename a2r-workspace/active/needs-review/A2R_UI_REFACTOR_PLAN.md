# A2R UI Refactor Plan

**Date:** 2026-01-31  
**Status:** Complete UI Rebuild with Professional Polish

---

## Problem Statement

**Current State:**
- ❌ Code issues and dead doors in UI
- ❌ Bugs with certain elements
- ❌ Lacks professional "Apple glass" feel
- ❌ Too much surface area visible at once
- ❌ Not everything implemented will survive

**Goal:**
- ✅ Collapse into smaller, focused surface area
- ✅ Toggle-based progressive disclosure
- ✅ Professional, polished aesthetic
- ✅ Only essential features visible by default
- ✅ Advanced features hidden behind toggles/drawers

---

## Design Philosophy

### "Apple Glass" Principles

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLEAN MINIMAL INTERFACE                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │          Main Focus Area (Chat/Canvas/Stage)            │   │
│  │                                                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ ◉ Assist │ │ □ Tools  │ │ ⬡ Stage  │ │ ⚙ Config │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│  [Floating Orb - Minimal, subtle, always accessible]            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

ADVANCED (toggled hidden):
┌─────────────────────────────────────────────────────────────────┐
│  [Studio] [Marketplace] [Operator Console] [Kanban] [Registry]  │
│  [Model Picker] [Onboarding] [Policy Dashboard]                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. **Minimal chrome** - No visible window borders, thin dividers
2. **Glass morphism** - Translucent backgrounds, subtle blur
3. **Progressive disclosure** - Advanced features behind toggles
4. **Contextual UI** - Only show relevant controls
5. **Smooth animations** - 60fps transitions, spring physics
6. **Typography-first** - System fonts, generous whitespace

---

## UI Layers (Collapsed Architecture)

### Layer 1: Core (Always Visible)
```
┌─────────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓                                                             ▓ │
│ ▓                    MAIN CONTENT AREA                        ▓ │
│ ▓                                                             ▓ │
│ ▓         (Chat / Canvas / Stage / Workspace)                 ▓ │
│ ▓                                                             ▓ │
│ ▓                                                             ▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ 💬 Chat │ │ 🎨 Art  │ │ 🌐 Web  │ │ 🧠 Brain│ │ ☰ More  │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                                 │
│              ◉  (Floating Orb - Voice/Quick Action)            │
└─────────────────────────────────────────────────────────────────┘
```

**Components:**
- Main content area (switches based on mode)
- Mode switcher (Chat/Canvas/Stage/Brain)
- "More" menu for advanced features
- Floating orb (voice, quick actions, status)

### Layer 2: Contextual Tools (Visible on Demand)
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║                                                           ║  │
│  ║              TOOL DRAWER (Slide from bottom)              ║  │
│  ║                                                           ║  │
│  ║  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  ║  │
│  ║  │ Models │ │ Skills │ │ Agents │ │ Tools  │ │ Console│  ║  │
│  ║  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  ║  │
│  ║                                                           ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Tool Categories:**
- Models - Model picker/selection
- Skills - Skill registry
- Agents - Agent management
- Tools - Tool registry
- Console - Operator/system logs

### Layer 3: Advanced (Modal/Overlay)
```
┌─────────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░┌────────────────────────────────┐░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░│                                │░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░│     MODAL OVERLAY               │░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░│     (Studio / Onboarding)       │░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░│                                │░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░│     [Full-featured workspace]   │░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░│                                │░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░└────────────────────────────────┘░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────────────────────────────────────┘
```

**Modal Workspaces:**
- Studio - Full builder interface
- Onboarding - Setup wizard
- Marketplace - Asset browser
- Settings - Configuration

---

## Component Refactor Plan

### 1. Floating Orb (Redesigned)

**Current:** Basic canvas animation
**New:** Professional glass morphism

```typescript
interface OrbProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  onClick: () => void;
  onLongPress: () => void; // Open quick menu
}

// Design:
// - Subtle glow when idle
// - Pulsing gradient when active
// - Ripple effect on click
// - Context menu on long-press
// - Drag to move position
```

**Visual:**
```
    ╭─────────╮
   ╱   ◉       ╲      <- Glass sphere with inner glow
  │  ╭───╮      │
  │ │ ◉◉◉ │     │     <- Animated waveform when listening
  │  ╰───╮      │
   ╲   ◉       ╱
    ╰─────────╯
```

### 2. Mode Switcher (New Component)

**Purpose:** Switch between main contexts

```typescript
type AppMode = 'chat' | 'canvas' | 'stage' | 'brain';

interface ModeSwitcherProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   [💬]    [🎨]    [🌐]    [🧠]    [☰]                │
│   Chat   Canvas  Stage   Brain   More                  │
│                                                         │
└─────────────────────────────────────────────────────────┘

Active state: Glass pill background
Inactive: Transparent
Hover: Subtle highlight
```

### 3. Collapsed Tool Drawer (New Component)

**Purpose:** Access tools without cluttering main UI

```typescript
interface ToolDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  tools: ToolCategory[];
}
```

**Visual:**
```
Closed:
┌─────────────────────────────────────────────────────────┐
│                                                [Tools ▲] │
└─────────────────────────────────────────────────────────┘

Open:
┌─────────────────────────────────────────────────────────┐
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│ │Models│ │Skills│ │Agents│ │Tools │ │Kanban│ │Console│ │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
│                                                [Tools ▼] │
└─────────────────────────────────────────────────────────┘
```

### 4. Glass Card (Base Component)

**Foundation for all UI panels:**

```typescript
interface GlassCardProps {
  children: React.ReactNode;
  blur?: 'light' | 'medium' | 'heavy';
  opacity?: number;
  border?: boolean;
  shadow?: 'none' | 'small' | 'medium' | 'large';
}
```

**CSS:**
```css
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}
```

### 5. Quick Action Menu (Orb Context Menu)

**Long-press or right-click on orb:**

```
        ╭──────╮
       ╱   ◉    ╲
      │  ╭──╮    │
      │ │ ◉◉ │   │
      │  ╰──╯    │
       ╲   ◉    ╱
        ╰──────╯
           │
    ╭──────┼──────╮
    │ New  │ Voice│
    │ Chat │ Mode │
    ├──────┼──────┤
    │ WIH  │ Help │
    │ List │      │
    ╰──────┴──────╯
```

---

## Feature Consolidation

### What's Visible (Default)

| Feature | Visibility | Access |
|---------|-----------|--------|
| Chat | ✅ Primary | Default mode |
| Canvas | ✅ Mode toggle | Click mode button |
| Stage | ✅ Mode toggle | Click mode button |
| Brain | ✅ Mode toggle | Click mode button |
| Orb | ✅ Always | Bottom corner |
| Mode Switcher | ✅ Always | Bottom bar |

### What's in Tool Drawer

| Feature | Visibility | Access |
|---------|-----------|--------|
| Model Picker | 🔲 Drawer | Open drawer → Models |
| Skills | 🔲 Drawer | Open drawer → Skills |
| Agents | 🔲 Drawer | Open drawer → Agents |
| Tools | 🔲 Drawer | Open drawer → Tools |
| Kanban/WIH | 🔲 Drawer | Open drawer → Kanban |
| Console | 🔲 Drawer | Open drawer → Console |

### What's Modal/Advanced

| Feature | Visibility | Access |
|---------|-----------|--------|
| Studio | ⬜ Modal | "More" → Studio |
| Marketplace | ⬜ Modal | "More" → Marketplace |
| Onboarding | ⬜ First launch | Auto-show or Settings |
| Settings | ⬜ Modal | "More" → Settings |
| Policy Dashboard | ⬜ Modal | "More" → Policies |

---

## A2R Kernel Integration (Minimal)

### WIH Badge (Subtle)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  💬 Chat                                       [P5-T0500│▼]│   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Clicking badge:**
- Dropdown: List of active WIHs
- "Create new WIH"
- "View Kanban board"

### Status Indicator (In Orb)

```
Orb states:
- 🟢 Idle: Subtle glow
- 🔵 Thinking: Pulsing blue
- 🟡 Working: Active gradient
- 🔴 Blocked: Error state
- ⚪ No WIH: Dimmed
```

---

## Technical Implementation

### 1. Glass Effect CSS

```css
/* Base glass effect */
.glass {
  background: rgba(20, 20, 30, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}

/* Elevated glass (for modals) */
.glass-elevated {
  background: rgba(25, 25, 40, 0.8);
  backdrop-filter: blur(40px) saturate(200%);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

/* Thin border highlight */
.glass-border {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}
```

### 2. Animation Standards

```css
/* Smooth transitions */
.transition-smooth {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Spring animations */
@keyframes spring-in {
  0% { transform: scale(0.9); opacity: 0; }
  70% { transform: scale(1.02); }
  100% { transform: scale(1); opacity: 1; }
}

/* Gradient animations */
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

### 3. Component Hierarchy (Refactored)

```
App.tsx
├── Layout.tsx (glass background, mode state)
│   ├── Header.tsx (minimal, WIH badge)
│   ├── MainContent.tsx (switches by mode)
│   │   ├── ChatMode.tsx
│   │   ├── CanvasMode.tsx
│   │   ├── StageMode.tsx
│   │   └── BrainMode.tsx
│   ├── ModeSwitcher.tsx (bottom bar)
│   ├── ToolDrawer.tsx (collapsible)
│   └── FloatingOrb.tsx (bottom corner)
│
├── Modals/
│   ├── StudioModal.tsx
│   ├── MarketplaceModal.tsx
│   ├── SettingsModal.tsx
│   └── OnboardingModal.tsx
│
└── Overlays/
    ├── ModelPickerOverlay.tsx
    └── QuickActionsMenu.tsx
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1)
1. Create `GlassCard` component with proper CSS
2. Build `FloatingOrb` v2 with glass design
3. Create `ModeSwitcher` component
4. Set up animation utilities

### Phase 2: Core UI (Week 2)
1. Rebuild `Layout.tsx` with new structure
2. Refactor `ChatInterface` to use glass cards
3. Build `ToolDrawer` component
4. Integrate mode switching

### Phase 3: Features (Week 3)
1. Port Model Picker to glass design
2. Port Onboarding to modal
3. Build collapsed Kanban view
4. Integrate WIH badge

### Phase 4: Polish (Week 4)
1. Animation refinement
2. Performance optimization
3. Bug fixes
4. Remove dead code

---

## Open Questions

1. **UI Framework:** Keep raw React or adopt Radix/Shadcn for accessibility?
2. **Animations:** Use Framer Motion or keep CSS transitions?
3. **Icons:** Use Lucide or custom icon set?
4. **Color System:** Define semantic color tokens?
5. **Accessibility:** Ensure keyboard navigation works?

---

## Summary

**Refactor Goals:**
- ✅ Collapse to minimal surface area
- ✅ Toggle-based progressive disclosure
- ✅ Professional glass morphism aesthetic
- ✅ Only essential features visible
- ✅ Smooth 60fps animations

**What Survives:**
- Chat interface (refactored)
- Canvas (as mode)
- Embodiment Orb (redesigned)
- Mode switching
- Tool drawer pattern

**What's New:**
- Glass card system
- Collapsed architecture
- Modal-based advanced features
- Professional polish

**What's Removed:**
- Always-visible complex UI
- Dead code paths
- Buggy components
- Cluttered interface
