# Gizzi Code - Correct Understanding & Plan

## What We're Actually Building

### Just 2 Modes (Not 3+):

1. **Gizzi Code** (regular terminal coding experience)
   - Like any other coder terminal
   - Standard terminal interface
   - No special agent features by default

2. **Gizzi Cowork** (collaborative agent workspace)
   - Has a "computer/viewport" on the right
   - Can display: artifacts, web previews, browser traces, anything
   - Full collaborative workspace

### Agent Mode is a TOGGLE (not a separate view)
- Like a2r-platform's agent on/off button
- You can mount an agent inside ANY mode
- It enhances the current mode, doesn't replace it

---

## Visual Layout Understanding

### Gizzi Code (Regular Mode)
```
┌─────────────────────────────────────────────┐
│  Gizzi Code                          [🟢]  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │                                       │ │
│  │   Terminal / Code Editor              │ │
│  │   (standard coding interface)         │ │
│  │                                       │ │
│  │   $ npm run build                     │ │
│  │   Building...                         │ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

### Gizzi Cowork (Collaborative Mode)
```
┌─────────────────────────────────────────────────────────────────┐
│  Gizzi Cowork                        [🟢]  [Agent: ON/OFF]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────┐  ┌──────────────────────────┐   │
│  │                           │  │  COMPUTER / VIEWPORT     │   │
│  │   Terminal / Code         │  │  (Dynamic display)       │   │
│  │                           │  │                          │   │
│  │   [User]: Build app       │  │  Can show:               │   │
│  │                           │  │  - Web previews          │   │
│  │   [Gizzi]: Building...    │  │  - Artifacts             │   │
│  │                           │  │  - Browser traces        │   │
│  │   ┌─────────────────┐     │  │  - File previews         │   │
│  │   │ ⚡ COMMAND      │     │  │  - Images/Video          │   │
│  │   │ $ npm build     │     │  │  - Any renderable content│   │
│  │   └─────────────────┘     │  │                          │   │
│  │                           │  │  [Interactive area]      │   │
│  │   ╭─ Type command...      │  │  - Click/interact        │   │
│  └───────────────────────────┘  │  - Scroll                │   │
│                                  │  - Navigate              │   │
│  [MODE SWITCHER]                │                          │   │
│  [Code] [Cowork]                │  ┌────────────────────┐  │   │
│  (left side)                    │  │ Web Preview        │  │   │
│                                  │  │ example.com        │  │   │
│                                  │  └────────────────────┘  │   │
│                                  │                          │   │
│                                  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mode Switcher (from a2r-platform)

Based on the a2r-platform ModeSwitcher.tsx:

### Features:
- **Side-by-side clickable buttons** (not tab-through)
- **Left side**: Mode switcher ([Code] [Cowork])
- **Right side**: Terminal prompt/input area
- **Visual styles**: pill, tabs, or segmented variants
- **Accent colors**: 
  - Code = Green (#6B9A7B)
  - Cowork = Purple (#9A7BAA)
- **Animations**: Smooth transitions between modes
- **Persistence**: Remembers last used mode

### Implementation Options:
```tsx
// Pill variant (floating widget style)
<ModeSwitcher 
  activeMode="cowork"
  onModeChange={(mode) => setMode(mode)}
  variant="pill"
  showLabels={true}
/>

// Tabs variant (full width)
<ModeSwitcher 
  activeMode="cowork"
  onModeChange={(mode) => setMode(mode)}
  variant="tabs"
/>

// Segmented variant (minimal)
<ModeSwitcher 
  activeMode="cowork"
  onModeChange={(mode) => setMode(mode)}
  variant="segmented"
/>
```

---

## Cowork's Right Rail - "The Computer"

This is NOT a static progress panel. It's a **dynamic viewport** that can display anything.

### What It Should Display:

1. **Web Browser Previews**
   - Render webpages inline
   - Show browser traces
   - Interactive browsing

2. **Artifacts**
   - Generated files
   - Build outputs
   - Documents

3. **Media**
   - Images (via sixel/kitty protocol)
   - Video (terminal video support)
   - ASCII/SVG renders

4. **Application UIs**
   - TUI apps
   - Dashboard views
   - Data visualizations

5. **Code/Files**
   - File previews
   - Diff views
   - Directory trees

---

## Terminal Graphics Capabilities (Research Needed)

### Modern Terminal Image/Content Display:

1. **Sixel Graphics**
   - DEC terminal standard
   - Supported by: xterm, mlterm, yaft
   - Format: Binary image encoding
   - Libraries: `libsixel`, `sixel-rs`

2. **Kitty Graphics Protocol**
   - Modern, feature-rich
   - Supported by: kitty, WezTerm, foot
   - Features: Images, animations, layers
   - Libraries: `kitty-graphics-protocol`

3. **iTerm2 Inline Images**
   - macOS iTerm2 only
   - Base64-encoded images
   - Simple API

4. **DOM Rendering (Web-based TUI)**
   - Use webview/iframe
   - Render HTML/CSS
   - Capture to terminal

5. **ASCII/SVG Conversion**
   - Convert images to ASCII
   - SVG to terminal characters
   - Libraries: `jp2a`, `svg-term`

### For Gizzi Cowork:

We need to research:
- What does `@opentui/core` support?
- Can we embed webviews in the TUI?
- Should we use kitty protocol for images?
- How to render interactive content?

---

## What Needs to Be Built

### Phase 1: Mode Switcher in TUI
- [ ] Create ModeSwitcher component for TUI (based on a2r-platform)
- [ ] Add to header/layout
- [ ] Make it clickable (mouse support in TUI)
- [ ] Add keyboard shortcuts (optional)

### Phase 2: Cowork Right Rail - Viewport
- [ ] Research terminal graphics capabilities
- [ ] Build viewport container component
- [ ] Add support for:
  - [ ] Image display (sixel/kitty)
  - [ ] Web preview (screenshot or render)
  - [ ] File/artifact preview
  - [ ] Interactive content

### Phase 3: Agent Toggle
- [ ] Add agent on/off toggle (separate from mode)
- [ ] Agent can be mounted in Code mode
- [ ] Agent can be mounted in Cowork mode
- [ ] Agent state persists across mode switches

### Phase 4: Integration
- [ ] Connect to existing cowork backend
- [ ] Event streaming to viewport
- [ ] Sync between left (terminal) and right (computer)

---

## Key Questions to Answer

1. **Terminal Graphics**: What graphics protocols can we use in gizzi-code's TUI?
   - Check `@opentui/core` capabilities
   - Test kitty/sixel support
   - Fallback to ASCII if needed

2. **Web Preview**: How to show web content?
   - Screenshot approach (capture webpage → display image)
   - Render approach (HTML → terminal)
   - Embed approach (webview in TUI)

3. **Interactivity**: Can users interact with the viewport?
   - Mouse clicks?
   - Keyboard input?
   - Navigation?

4. **Mode Switch Location**:
   - You said: "seeing as though we have the text /terminal on the left we can have the mode switcher on the right side"
   - Should confirm exact placement

---

## Next Steps (Before Building)

1. **Research terminal graphics** - What's possible in our TUI?
2. **Review a2r-platform viewport** - How does it display artifacts/web?
3. **Confirm layout** - Exact placement of mode switcher
4. **Define MVP** - What's the minimum for Cowork viewport?

---

## What I Built Before (Wrong Direction)

❌ Created 3 separate modes (Chat/Code/Cowork)
❌ Made Cowork a static progress rail
❌ Built work blocks inline (wrong approach)
❌ Didn't include agent toggle

## What We Actually Need

✅ Just 2 modes: Code + Cowork
✅ Cowork has dynamic viewport (computer) on right
✅ Agent is a toggle within any mode
✅ Mode switcher like a2r-platform (clickable, side-by-side)
✅ Viewport can display ANYTHING (web, images, artifacts)

---

## Let's Discuss Before Building More

1. **Do you want me to research terminal graphics first?**
2. **Should the viewport be interactive or just display?**
3. **What's the #1 thing the viewport must display?**
4. **Where exactly should the mode switcher go?**
