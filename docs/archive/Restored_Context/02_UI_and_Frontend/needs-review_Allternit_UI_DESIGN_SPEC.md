# Allternit UI Design Specification

**Date:** 2026-01-31  
**Status:** Production Design Spec

---

## Design Direction

**Inspiration:**
- Claude Desktop (cowork modes)
- Apple Vision OS (glass morphism)
- Linear (animations, polish)
- Vercel (minimalism, typography)
- GitHub Copilot Chat (floating UI)

**Goal:** SOTA design that looks like a top-tier design agency built it.

---

## Top Navigation: Three Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ◉  Allternit                           [ 🗨 Chat │ 👥 Cowork │ ⌨ Code ]         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        MAIN CONTENT AREA                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mode Switcher Design

**Visual:**
```
┌─────────────────────────────────────────┐
│  ┌──────────┬──────────┬──────────┐    │
│  │  🗨 Chat  │ 👥 Cowork│ ⌨ Code  │    │
│  │   ────   │          │          │    │  <- Active indicator (Chat)
│  └──────────┴──────────┴──────────┘    │
└─────────────────────────────────────────┘

Style:
- Background: glass-elevated (rgba(30,30,40,0.8))
- Border: 1px solid rgba(255,255,255,0.1)
- Border-radius: 12px
- Padding: 4px
- Gap: 4px between buttons
- Active state: lighter glass + bottom border accent
- Inactive: transparent

Animation:
- Active indicator slides smoothly (300ms, cubic-bezier(0.4, 0, 0.2, 1))
- Hover: subtle background highlight
- Click: scale(0.98) then back
```

**Icons (Custom):**

| Mode | Icon | Source | Description |
|------|------|--------|-------------|
| Chat | 🗨 (Speech bubble dots) | Phosphor Icons / Custom | Two dots in bubble |
| Cowork | 👥 (People/working) | Phosphor Icons / Custom | Overlapping figures |
| Code | ⌨ (Terminal/command) | Phosphor Icons / Custom | Terminal prompt symbol |

**Icon Resources:**
- **Primary:** [Phosphor Icons](https://phosphoricons.com/) - Weight: "Duotone" or "Fill"
- **Alternative:** [Heroicons](https://heroicons.com/) - 24px solid
- **Custom:** Modify in Figma for unique Allternit identity

**Mode Behaviors:**

| Mode | Content | Features |
|------|---------|----------|
| **Chat** | Traditional chat interface | Messages, input, suggestions |
| **Cowork** | Side-by-side workspace | Chat + Canvas/Stage split view |
| **Code** | Terminal UI launch | Full TUI with file tree, editor |

---

## Floating Orb: Enhanced

**KEEP THE ESSENCE:** Canvas-based animation, gradient shifts, pulse behavior

**ADD GLASS MORPHISM:**

```
Visual Spec:

       ╭─────────────────╮
      ╱   ╭───────────╮   ╲
     │   ╱             ╲   │     <- Outer glass ring (subtle)
     │  │   ╭───────╮   │  │
     │  │  │  ◉ ◉  │  │  │     <- Inner animated core (KEEP THIS)
     │  │   ╰───────╯   │  │
     │   ╲             ╱   │
      ╲   ╰───────────╯   ╱
       ╰─────────────────╯

Enhancements:
1. Outer glass shell (backdrop-filter blur)
2. Subtle drop shadow (elevated feel)
3. Inner glow ring (rim light)
4. KEEP inner animation (gradients, pulse)
5. Add: Micro-interactions on interaction
```

**Animation Specs:**

```typescript
interface OrbAnimations {
  // Idle state
  idle: {
    gradientSpeed: 'slow',      // 20s loop
    pulseIntensity: 0.05,       // Very subtle
    glowOpacity: 0.3,
  };
  
  // Hover state
  hover: {
    scale: 1.05,                // Slight grow
    glowIntensity: 1.2,         // Brighter glow
    gradientSpeed: 'fast',      // Speed up
    transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  };
  
  // Active/Click
  active: {
    scale: 0.95,                // Press down
    ripple: true,               // Radial ripple effect
    transition: '0.1s ease-out',
  };
  
  // Thinking state
  thinking: {
    pulseIntensity: 0.15,       // More noticeable
    pulseSpeed: 'fast',         // 1s cycle
    gradientShift: 'rapid',     // Color cycling
    glowColor: '#60a5fa',       // Blue tint
  };
  
  // Speaking state
  speaking: {
    waveform: true,             // Audio waveform visualization
    gradientColorway: ['#34d399', '#60a5fa', '#a78bfa'], // Green-blue-purple
    pulseSync: 'audio',         // Pulse to audio
  };
}
```

**CSS Implementation:**

```css
/* Outer glass container */
.orb-glass-shell {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(20, 20, 30, 0.4);
  backdrop-filter: blur(12px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s ease;
}

.orb-glass-shell:hover {
  transform: scale(1.05);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 0 20px rgba(96, 165, 250, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.orb-glass-shell:active {
  transform: scale(0.95);
}

/* Rim light effect */
.orb-glass-shell::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    transparent 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  pointer-events: none;
}

/* Inner canvas (KEEP EXISTING ANIMATION) */
.orb-canvas {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  /* Existing animation logic preserved */
}
```

**Interaction Model:**

```
Click: Activate voice/quick action
Long-press (>500ms): Open context menu
Drag: Move orb position (remember position)
Double-click: Toggle "always on top" mode
```

**Context Menu (Long Press):**

```
        ◉
        │
   ╭────┼────╮
   │🎤 Voice │  <- Start voice mode
   │💬 New   │  <- New chat
   │📋 WIHs  │  <- WIH list
   │⚙ Settings│
   ╰────┴────╯
```

---

## Mode: Chat

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ◉ Allternit              [🗨 Chat │ 👥 Cowork │ ⌨ Code]              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              MESSAGE LIST                               │   │
│  │                                                         │   │
│  │  ┌──────┐                                              │   │
│  │  │ 🤖   │  Glass message bubble                        │   │
│  │  │ Hello│  Subtle gradient bg                         │   │
│  │  └──────┘                                              │   │
│  │                                                         │   │
│  │              ┌──────┐                                  │   │
│  │              │   👤│  User message                     │   │
│  │              │ Hi! │  Right-aligned                    │   │
│  │              └──────┘                                  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [⚡ Quick actions]  Type a message...          [🎤]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                     ◉  (Floating Orb)                          │
└─────────────────────────────────────────────────────────────────┘
```

**Chat Bubbles:**
```css
.message-bubble {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 12px 16px;
  max-width: 70%;
  animation: message-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.message-bubble.assistant {
  border-top-left-radius: 4px;
  background: linear-gradient(
    135deg,
    rgba(96, 165, 250, 0.1),
    rgba(167, 139, 250, 0.05)
  );
}

.message-bubble.user {
  border-top-right-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}

@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

---

## Mode: Cowork

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ◉ Allternit              [🗨 Chat │ 👥 Cowork │ ⌨ Code]              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┬────────────────────────────────┐  │
│  │                         │                                │  │
│  │      CHAT PANEL         │        WORKSPACE PANEL         │  │
│  │       (narrow)          │          (wide)                │  │
│  │                         │                                │  │
│  │  ┌──────────────────┐   │   ┌────────────────────────┐   │  │
│  │  │ 🤖 What would   │   │   │                        │   │  │
│  │  │ you like to...  │   │   │     [Canvas / Stage]   │   │  │
│  │  └──────────────────┘   │   │                        │   │  │
│  │                         │   │    Visual workspace    │   │  │
│  │  ┌──────────────────┐   │   │    for artifacts       │   │  │
│  │  │ 👤 Let's work   │   │   │                        │   │  │
│  │  │ on the design   │   │   │                        │   │  │
│  │  └──────────────────┘   │   └────────────────────────┘   │  │
│  │                         │                                │  │
│  │ [Type message...]       │                                │  │
│  └─────────────────────────┴────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Resizable split (drag divider)
- Chat always visible
- Workspace switches: Canvas / Stage / Browser
- Artifacts appear in workspace panel

---

## Mode: Code

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ◉ Allternit              [🗨 Chat │ 👥 Cowork │ ⌨ Code]              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ allternit> _                                                      ││
│  │                                                             ││
│  │ Allternit Terminal v1.0.0                                         ││
│  │ Active WIH: P5-T0500 (Implement feature X)                  ││
│  │                                                             ││
│  │ allternit> kernel wih list                                        ││
│  │ P5-T0500  in_progress  Implement feature X                  ││
│  │ P5-T0501  ready        Fix bug Y                           ││
│  │                                                             ││
│  │ allternit> _                                                      ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Launch TUI in container
- Full terminal experience
- All `allternit` CLI commands available
- Persist terminal state across mode switches

---

## Icon System

### Icon Libraries (Download/Use)

**Primary: Phosphor Icons**
```bash
npm install @phosphor-icons/react
```

**Key icons to use:**
```typescript
import {
  ChatTeardropText,    // Chat mode
  UsersThree,          // Cowork mode
  TerminalWindow,      // Code mode
  Microphone,          // Voice
  Gear,                // Settings
  Plus,                // New/Add
  List,                // Menu/List
  Kanban,              // WIH board
  Brain,               // Brain/AI
  Globe,               // Stage/Web
  PaintBrush,          // Canvas
  X,                   // Close
} from '@phosphor-icons/react';
```

**Weight:** Use "Duotone" for active states, "Regular" for inactive

**Alternative: Custom Icons**

Create in Figma:
1. 24x24px frame
2. 2px stroke weight
3. Rounded caps and joins
4. Consistent visual weight
5. Export as SVG components

**Animation on Icons:**
```css
.icon {
  transition: transform 0.2s ease, color 0.2s ease;
}

.icon:hover {
  transform: scale(1.1);
}

.icon.active {
  color: var(--accent-color);
  transform: scale(1);
}
```

---

## Animation Specifications

### Easing Functions

```css
:root {
  /* Standard */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Entrance */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Spring (bouncy) */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  
  /* Smooth decelerate */
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
  
  /* Sharp */
  --ease-sharp: cubic-bezier(0.4, 0, 0.6, 1);
}
```

### Durations

```css
:root {
  --duration-instant: 0ms;
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;
}
```

### Animation Patterns

**1. Mode Switch:**
```css
@keyframes mode-indicator-slide {
  from {
    transform: translateX(var(--from-x));
    opacity: 0.7;
  }
  to {
    transform: translateX(var(--to-x));
    opacity: 1;
  }
}

.mode-indicator {
  transition: transform 300ms var(--ease-spring),
              width 300ms var(--ease-out);
}
```

**2. Message Entrance:**
```css
@keyframes message-enter {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  70% {
    transform: translateY(-2px) scale(1.01);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

**3. Glass Panel Entrance:**
```css
@keyframes glass-enter {
  from {
    opacity: 0;
    transform: scale(0.96);
    backdrop-filter: blur(0px);
  }
  to {
    opacity: 1;
    transform: scale(1);
    backdrop-filter: blur(20px);
  }
}
```

**4. Orb Pulse:**
```css
@keyframes orb-pulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(96, 165, 250, 0.3);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 40px rgba(96, 165, 250, 0.5);
    transform: scale(1.02);
  }
}
```

---

## Color System

### Semantic Colors

```css
:root {
  /* Backgrounds */
  --bg-primary: rgba(10, 10, 15, 1);
  --bg-secondary: rgba(20, 20, 30, 0.8);
  --bg-tertiary: rgba(30, 30, 45, 0.6);
  
  /* Glass surfaces */
  --glass-light: rgba(255, 255, 255, 0.05);
  --glass-medium: rgba(255, 255, 255, 0.08);
  --glass-heavy: rgba(255, 255, 255, 0.12);
  
  /* Text */
  --text-primary: rgba(255, 255, 255, 0.95);
  --text-secondary: rgba(255, 255, 255, 0.7);
  --text-tertiary: rgba(255, 255, 255, 0.5);
  
  /* Accent (adapts to mode) */
  --accent-chat: #60a5fa;      /* Blue */
  --accent-cowork: #a78bfa;    /* Purple */
  --accent-code: #34d399;      /* Green */
  
  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.15);
}
```

### Gradient Accents

```css
/* Orb gradient */
--orb-gradient-idle: linear-gradient(
  135deg,
  #a78bfa 0%,
  #60a5fa 50%,
  #34d399 100%
);

--orb-gradient-thinking: linear-gradient(
  135deg,
  #60a5fa 0%,
  #818cf8 50%,
  #c084fc 100%
);

--orb-gradient-speaking: linear-gradient(
  135deg,
  #34d399 0%,
  #22d3ee 50%,
  #60a5fa 100%
);
```

---

## Typography

```css
:root {
  /* Font stack */
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
  
  /* Sizes */
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 24px;
  
  /* Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
}
```

---

## Responsive Behavior

```
Desktop (>1024px):
├─ Full three-column cowork mode
├─ Large chat bubbles
└─ Full feature visibility

Tablet (768-1024px):
├─ Collapsible sidebar
├─ Two-column cowork (chat/workspace)
└─ Medium chat bubbles

Mobile (<768px):
├─ Single column
├─ Bottom sheet for tools
├─ Full-screen mode switch
└─ Floating orb (smaller)
```

---

## Implementation Order

### Phase 1: Foundation (Days 1-3)
1. Set up CSS variables and design tokens
2. Create `GlassCard` component
3. Install Phosphor Icons
4. Create mode switcher shell

### Phase 2: Navigation (Days 4-5)
1. Build top navigation with mode switcher
2. Implement mode state management
3. Create mode transition animations
4. Add WIH badge

### Phase 3: Orb Enhancement (Days 6-7)
1. Wrap existing Orb in glass shell
2. Add hover/active animations
3. Implement context menu
4. Add drag-to-position

### Phase 4: Mode Content (Days 8-12)
1. Chat mode with glass bubbles
2. Cowork mode with split view
3. Code mode with TUI integration
4. Mode-specific features

### Phase 5: Polish (Days 13-14)
1. Animation refinement
2. Performance optimization
3. Bug fixes
4. Dark/light mode support

---

## Success Metrics

- ✅ 60fps animations throughout
- ✅ Sub-100ms mode switching
- ✅ Glass effects work on all modern browsers
- ✅ Orb animations preserved but enhanced
- ✅ Professional feel (design agency quality)
- ✅ Accessible (keyboard navigation, screen readers)

---

## Summary

**Keep:**
- Orb essence and canvas animations
- Core animation logic
- A2UI renderer concept

**Enhance:**
- Glass morphism shell around orb
- Top navigation with 3 modes
- Mode-specific layouts
- Professional polish (SOTA animations)

**Add:**
- Phosphor Icons (Duotone)
- Mode transition animations
- Glass card system
- WIH integration

**Remove:**
- Cluttered always-visible UI
- Dead code paths
- Buggy windowing (simplify)
