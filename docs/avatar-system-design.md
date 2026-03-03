# Avatar System Design Document

## 1. Avatar Anatomy

An Agent Avatar is composed of the following anatomical elements:

```
┌─────────────────────────────────────────┐
│              ANTENNAS                   │  ← 0-3 count, customizable style
│                  │                      │
│            ┌─────┴─────┐                │
│            │   BODY    │                │  ← Shape per setup type
│            │           │                │
│            │  ┌───┐    │                │
│            │  │EYE│    │                │  ← 12+ presets, animated
│            │  └───┘    │                │
│            │           │                │
│            │  ACCESSORY│                │  ← Optional decorations
│            └───────────┘                │
│               GLOW                      │  ← Emission effect
└─────────────────────────────────────────┘
```

### 1.1 Body (Base Shape)
The foundation of the avatar. One of 5 shapes corresponding to agent setup:

| Setup | Shape | Characteristics |
|-------|-------|-----------------|
| Coding | Hex | Angular, tech-forward, circuit-ready |
| Creative | Cloud | Organic, flowing, gradient-friendly |
| Research | Diamond | Precise, geometric, crystalline |
| Operations | Shield | Robust, protective, grounded |
| Generalist | Round | Balanced, friendly, approachable |

**Body Properties:**
- `shape`: Enum of 5 base shapes
- `sizeScale`: 0.8x - 1.2x multiplier
- `texture`: Optional pattern overlay (grid, gradient, etc.)

### 1.2 Eyes
The primary expression conveyors. Highly customizable.

**Eye Properties:**
- `preset`: One of 12+ predefined eye shapes
- `size`: Scale factor (0.5x - 1.5x)
- `color`: Hex color for iris/sclera
- `pupilStyle`: dot | ring | slit | star | heart | plus
- `blinkRate`: slow | normal | fast | never
- `lookDirection`: Optional tracking target

### 1.3 Antennas
Sensory/communication appendages. Add personality and movement.

**Antenna Properties:**
- `count`: 0, 1, 2, or 3
- `style`: straight | curved | coiled | zigzag | leaf | bolt
- `animation`: static | wiggle | pulse | sway | bounce
- `tipDecoration`: none | ball | glow | star | diamond

### 1.4 Colors
Theme-aware color scheme with 4 roles:

**Color Roles:**
- `primary`: Main body fill (60% visual weight)
- `secondary`: Eye/accent color (30% visual weight)
- `glow`: Emission/beacon effect (animated)
- `outline`: Stroke/border color (10% visual weight)

### 1.5 Accessories
Unlockable decorations that add flair:

**Accessory Types:**
- Glasses: round, square, monocle, shades
- Headwear: cap, wizard hat, crown, headset
- Neck: bow tie, badge, scarf
- Other: wings, cape, tools

### 1.6 Glow/Beacon
Atmospheric lighting effect emanating from the avatar:

**Glow Properties:**
- `color`: Hex color with alpha
- `intensity`: 0-1 brightness
- `pulse`: Whether to animate intensity
- `size`: Spread radius

---

## 2. Customization Categories

### 2.1 Appearance Customization

| Category | Options | Impact |
|----------|---------|--------|
| Body Shape | 5 shapes | Core visual identity |
| Body Size | Slider 0.8-1.2x | Proportions |
| Eye Preset | 12+ types | Expression baseline |
| Eye Size | Slider 0.5-1.5x | Expressiveness |
| Eye Color | Color picker | Personality hint |
| Pupil Style | 6 options | Character depth |
| Antenna Count | 0-3 | Complexity level |
| Antenna Style | 6 styles | Personality |
| Antenna Animation | 5 modes | Energy level |

### 2.2 Color Customization

**Setup-Based Palettes:**
Each setup has a curated palette of 30+ colors:

```typescript
const SETUP_PALETTES = {
  coding: {
    primary: [/* 30 blues, cyans, silvers */],
    secondary: [/* 20 accent colors */],
    glow: [/* 15 emission colors */],
    outline: [/* 10 border colors */]
  },
  // ... creative, research, operations, generalist
};
```

**Color Selection UI:**
- Swatch grid organized by setup
- Custom color picker for advanced users
- Randomize button with smart palette selection
- Contrast checker for accessibility

### 2.3 Personality Visuals

Animation parameters driven by agent temperament:

| Temperament | Bounce | Sway | Breathing | Idle Style |
|-------------|--------|------|-----------|------------|
| Precision | 0.1 | 0.05 | true | Minimal, exact |
| Exploratory | 0.4 | 0.3 | true | Curious, looking |
| Systemic | 0.2 | 0.1 | true | Rhythmic, predictable |
| Balanced | 0.3 | 0.15 | true | Natural mix |

### 2.4 Emotion Expressions

8 core emotions with unique visual signatures:

| Emotion | Body Animation | Eye Change | Glow Change |
|---------|---------------|------------|-------------|
| Alert | Quick hop | Widen | Bright pulse |
| Curious | Head tilt | Asymmetric | Gentle pulse |
| Focused | Still, steady | Narrow | Dim steady |
| Steady | Gentle breathe | Normal | Soft pulse |
| Pleased | Happy bounce | Pleased shape | Warm glow |
| Skeptical | Lean back | Raise eyebrow | Cool tone |
| Mischief | Playful sway | Mischief shape | Flicker |
| Proud | Lift posture | Confident | Strong glow |

---

## 3. Emotion-to-Visual Mapping Matrix

```
                    Body Position     Eye Shape      Glow Effect
                    ─────────────────────────────────────────────
Alert:              Jump up           Wide open      Bright flash
Curious:            Tilt 15°          Asymmetric     Gentle pulse
Focused:            Center, still     Narrow         Dim steady
Steady:             Gentle bob        Normal         Soft pulse
Pleased:            Bounce high       Happy squint   Warm expand
Skeptical:          Lean back 10°     Raised brow    Cool flicker
Mischief:           Sway side         Playful        Quick flicker
Proud:              Lift 5°           Confident      Strong steady
```

---

## 4. Template System

### 4.1 Starter Templates

| Template | Setup | Personality | Use Case |
|----------|-------|-------------|----------|
| The Hacker | Coding | Precision | Development agents |
| The Architect | Coding | Systemic | Design agents |
| The Artist | Creative | Exploratory | Content creation |
| The Dreamer | Creative | Balanced | Brainstorming |
| The Scholar | Research | Precision | Analysis agents |
| The Explorer | Research | Exploratory | Discovery agents |
| The Guardian | Operations | Precision | Security agents |
| The Commander | Operations | Systemic | Management agents |
| The Helper | Generalist | Balanced | Support agents |
| The Robot | Generalist | Precision | Automation agents |

### 4.2 Template Structure

```typescript
interface AvatarTemplate {
  id: string;
  name: string;
  description: string;
  setup: AgentSetup;
  temperament: Temperament;
  config: AvatarConfig;
  preview: string; // Base64 or URL
}
```

---

## 5. Animation System Design

### 5.1 Animation Layers

```
┌─────────────────────────────────────────┐
│  Layer 4: Reactive (Interaction)        │  ← Hover, click responses
│  Layer 3: Emotion (State-driven)        │  ← Current emotion
│  Layer 2: Idle (Personality-driven)     │  ← Temperament baseline
│  Layer 1: Base (Transform)              │  ← Position, scale, rotate
└─────────────────────────────────────────┘
```

### 5.2 Animation Priority

1. Reactive animations (highest priority, immediate)
2. Emotion transitions (medium priority, 200-600ms)
3. Idle animations (lowest priority, continuous)

### 5.3 Timing Constants

```typescript
const ANIMATION_TIMINGS = {
  reactive: { duration: 150, easing: 'ease-out' },
  emotion: { duration: 400, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  idle: { duration: 4000, easing: 'ease-in-out' },
  blink: { duration: 150, easing: 'ease-in-out' }
};
```

---

## 6. Integration Points

### 6.1 Agent Creation Flow

```
Welcome → Identity → Personality → Character → [AVATAR] → Review → Created
                                               ↑
                                    New wizard step with:
                                    - Template selection
                                    - Visual customization
                                    - Live preview
                                    - Emotion testing
```

### 6.2 Display Locations

| Location | Size | Interaction | Emotion |
|----------|------|-------------|---------|
| Agent Cards | 44px | Hover scale | Steady |
| Agent Detail | 80px | Click cycle | User choice |
| Chat Messages | 32px | None | Contextual |
| Creator Preview | 200px | Emotion buttons | User test |

### 6.3 Data Flow

```
User Customization
       ↓
avatarCreatorStore (Zustand)
       ↓
AvatarConfig JSON
       ↓
API POST /agents (embedded in config)
       ↓
Database (agents.config.avatar)
       ↓
AgentDisplay components (read & render)
```

---

## 7. Technical Specifications

### 7.1 SVG Structure

```svg
<svg viewBox="0 0 100 100" class="agent-avatar">
  <!-- Glow filter definition -->
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Glow layer -->
  <g class="avatar-glow" filter="url(#glow)">
    <circle cx="50" cy="50" r="40" fill="var(--glow-color)" opacity="0.3"/>
  </g>
  
  <!-- Body layer -->
  <g class="avatar-body">
    <path d="/* shape path */" fill="var(--primary-color)" stroke="var(--outline-color)"/>
  </g>
  
  <!-- Eyes layer -->
  <g class="avatar-eyes">
    <path d="/* left eye */" fill="var(--eye-color)"/>
    <path d="/* right eye */" fill="var(--eye-color)"/>
  </g>
  
  <!-- Antennas layer -->
  <g class="avatar-antennas">
    <path d="/* antenna 1 */" stroke="var(--secondary-color)"/>
  </g>
  
  <!-- Accessories layer -->
  <g class="avatar-accessories">
    <!-- Optional decorations -->
  </g>
</svg>
```

### 7.2 CSS Animation Classes

```css
/* Base animation classes */
.avatar--idle-precision { animation: idle-precision 4s ease-in-out infinite; }
.avatar--idle-exploratory { animation: idle-exploratory 6s ease-in-out infinite; }
.avatar--idle-systemic { animation: idle-systemic 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.avatar--idle-balanced { animation: idle-balanced 4s ease-in-out infinite; }

/* Emotion transitions */
.avatar--emotion-alert { animation: emotion-alert 300ms ease-out forwards; }
.avatar--emotion-pleased { animation: emotion-pleased 400ms spring(1, 100, 10, 0) forwards; }
/* ... etc */

/* Reactive states */
.avatar--hover { transform: scale(1.05); transition: transform 150ms ease-out; }
.avatar--active { transform: scale(0.95); transition: transform 100ms ease-out; }
```

### 7.3 Performance Considerations

- Use CSS transforms only (no layout properties)
- Apply `will-change: transform` during animations
- Use `contain: layout style paint` on avatar containers
- Implement reduced motion media query
- Lazy load accessory SVGs
- Cache compiled avatar configurations

---

## 8. Accessibility Requirements

### 8.1 Visual
- Color contrast ratios: 4.5:1 minimum
- Don't rely on color alone for information
- Support high contrast mode

### 8.2 Motion
- Respect `prefers-reduced-motion`
- Provide static alternatives
- No flashing/strobing effects

### 8.3 Screen Readers
- Meaningful aria-labels: "Agent avatar showing pleased emotion"
- Live regions for emotion changes
- Keyboard navigation support

---

## 9. Future Enhancements

- [ ] Custom SVG upload for advanced users
- [ ] Procedural generation from agent name
- [ ] Animated GIF export
- [ ] 3D model integration (GLB support)
- [ ] Seasonal/holiday themes
- [ ] Achievement unlocks for accessories
- [ ] Community template sharing
