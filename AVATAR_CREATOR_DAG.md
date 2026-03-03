# Agent Avatar Creator - DAG Task Specification

## Overview
Build a video game-style character creator for AI agent avatars, similar to Gizzi Mascot but with deep customization. The avatar will be an SVG-based animated character that reflects the agent's personality, setup (coding/creative/research/operations), and temperament.

## Current System Analysis

### Existing Components
1. **GizziMascot** (`/components/ai-elements/GizziMascot.tsx`)
   - SVG-based animated character
   - 8 emotions with unique body animations
   - 9 eye presets (square, wide, curious, narrow, pleased, skeptical, mischief, proud, dizzy)
   - Beacon/glow effects
   - Locomotion animations (walk-in, walk-out, crawl)
   - ~700 lines of TypeScript with CSS-in-JS animations

2. **Character System** (`/lib/agents/character.types.ts`)
   - `AvatarConfig`: { type: "glb" | "image" | "color", uri?: string, fallbackColor: string }
   - `CharacterIdentity`: setup, className, specialtySkills, temperament
   - `AgentSetup`: "coding" | "creative" | "research" | "operations" | "generalist"
   - `CHARACTER_SETUPS`: Defines class names (Builder, Creator, Analyst, Operator, Generalist)

3. **Agent Creation Flow** (`/views/AgentView.tsx`)
   - 6-step wizard: Welcome → Identity → Personality → Character → Runtime → Review
   - Current step 3 (Personality) handles temperament
   - Current step 4 (Character) handles specialty skills, voice style

---

## DAG Task Structure

```
AVATAR_CREATOR_PROJECT
├── PHASE_1: FOUNDATION
│   ├── TASK_1.1: Avatar Type System Design
│   ├── TASK_1.2: Avatar Configuration Schema Extension
│   └── TASK_1.3: Avatar State Management Store
├── PHASE_2: BASE AVATAR COMPONENT
│   ├── TASK_2.1: Modular SVG Avatar Component Architecture
│   ├── TASK_2.2: Base Body Shapes (5 Setup Types)
│   ├── TASK_2.3: Eye System with 12+ Presets
│   ├── TASK_2.4: Antenna/Accessory System
│   └── TASK_2.5: Color Palette System
├── PHASE_3: ANIMATION SYSTEM
│   ├── TASK_3.1: Emotion Animation Engine
│   ├── TASK_3.2: Idle Animation States
│   ├── TASK_3.3: Reactive Animations (hover, click, typing)
│   └── TASK_3.4: Locomotion Animations
├── PHASE_4: CREATOR UI
│   ├── TASK_4.1: Avatar Creator Wizard Step
│   ├── TASK_4.2: Visual Customization Panel
│   ├── TASK_4.3: Personality-to-Visual Mapping
│   ├── TASK_4.4: Real-time Preview Component
│   └── TASK_4.5: Template Preset System
├── PHASE_5: INTEGRATION
│   ├── TASK_5.1: Avatar Persistence (DB + API)
│   ├── TASK_5.2: Avatar Display in Agent Cards
│   ├── TASK_5.3: Avatar Display in Agent Detail View
│   └── TASK_5.4: Avatar in Chat Interface
└── PHASE_6: POLISH
    ├── TASK_6.1: Performance Optimization
    ├── TASK_6.2: Accessibility (a11y)
    └── TASK_6.3: Documentation & Testing
```

---

## Detailed Task Specifications

### PHASE 1: FOUNDATION

#### TASK 1.1: Avatar Type System Design
**Scope:** Design the avatar customization domain model
**Dependencies:** None
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] Document avatar anatomy (body, eyes, antennas, colors, accessories)
- [ ] Define customization categories:
  - **Base Shape**: Body form factor per setup type
  - **Eyes**: Shape, size, pupil style, blink behavior
  - **Antennas/Accessories**: Shape, count, animation style
  - **Colors**: Primary, secondary, accent, glow
  - **Personality Visuals**: Posture, breathing rate, bounce
- [ ] Create avatar style guide matching A2R brand
- [ ] Define emotion-to-visual mapping matrix

**Output:** `/docs/avatar-system-design.md`

---

#### TASK 1.2: Avatar Configuration Schema Extension
**Scope:** Extend character.types.ts with detailed avatar config
**Dependencies:** TASK_1.1
**Estimated Time:** 1 day
**Acceptance Criteria:**
- [ ] Extend `AvatarConfig` interface:
```typescript
interface AvatarConfig {
  version: "1.0";
  baseShape: "round" | "square" | "hex" | "diamond" | "cloud"; // per setup
  eyes: {
    preset: EyePreset;
    size: number; // 0.5 - 1.5
    color: string;
    pupilStyle: "dot" | "ring" | "slit" | "star";
    blinkRate: "slow" | "normal" | "fast" | "never";
  };
  antennas: {
    count: 0 | 1 | 2 | 3;
    style: "straight" | "curved" | "coiled" | "zigzag";
    animation: "static" | "wiggle" | "pulse" | "sway";
  };
  colors: {
    primary: string;    // Body color
    secondary: string;  // Eye/accent color
    glow: string;       // Beacon/emission color
    outline: string;    // Stroke color
  };
  personality: {
    bounce: number;     // 0-1 idle bounce intensity
    sway: number;       // 0-1 idle rotation sway
    breathing: boolean; // Scale pulsing
  };
  accessories: string[]; // IDs of unlocked accessories
}
```
- [ ] Create validation schema (zod)
- [ ] Migration path for existing agents (fallback color → full avatar)

**Output:** Updated `character.types.ts`, validation schema

---

#### TASK_1.3: Avatar State Management Store
**Scope:** Create Zustand store for avatar creator state
**Dependencies:** TASK_1.2
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] Create `avatarCreatorStore.ts`:
  - Current configuration state
  - History/undo stack (for wizard navigation)
  - Template presets
  - Validation errors
- [ ] Actions: `updateEyes()`, `setColor()`, `applyTemplate()`, `reset()`
- [ ] Selectors: `getAvatarPreview()`, `getValidationErrors()`
- [ ] Persist draft to localStorage

**Output:** `/stores/avatar-creator.store.ts`

---

### PHASE 2: BASE AVATAR COMPONENT

#### TASK_2.1: Modular SVG Avatar Component Architecture
**Scope:** Create reusable SVG component system
**Dependencies:** TASK_1.3
**Estimated Time:** 3 days
**Acceptance Criteria:**
- [ ] Create `AgentAvatar` component architecture:
```
AgentAvatar/
├── AgentAvatar.tsx       # Main container
├── parts/
│   ├── Body.tsx          # Base shape renderer
│   ├── Eyes.tsx          # Eye renderer with presets
│   ├── Antennas.tsx      # Antenna renderer
│   ├── Glow.tsx          # Beacon/glow effect
│   └── Accessories.tsx   # Decorations
├── hooks/
│   ├── useAvatarAnimation.ts  # Animation controller
│   └── useEmotionProfile.ts   # Emotion-to-style mapper
└── presets/
    ├── bodyShapes.ts     # 5 setup-type shapes
    ├── eyeShapes.ts      # 12+ eye presets
    └── colorPalettes.ts  # Theme-aware palettes
```
- [ ] Props interface: `size`, `avatarConfig`, `emotion`, `isAnimating`
- [ ] Support both static and animated modes
- [ ] CSS containment for performance

**Output:** `/components/avatar/` directory structure

---

#### TASK_2.2: Base Body Shapes (5 Setup Types)
**Scope:** Create SVG body shapes for each agent setup
**Dependencies:** TASK_2.1
**Estimated Time:** 3 days
**Acceptance Criteria:**
- [ ] **Coding (Builder)**: Angular, tech-inspired, circuit patterns
  - Hexagonal or rounded-square base
  - Subtle grid/circuit texture
  - Sharp but friendly edges
- [ ] **Creative (Creator)**: Organic, flowing, artistic
  - Cloud-like or blob shape
  - Gradient-ready surface
  - Expressive curves
- [ ] **Research (Analyst)**: Precise, geometric, measured
  - Diamond or triangular base
  - Clean lines
  - Symmetrical design
- [ ] **Operations (Operator)**: Robust, shield-like, reliable
  - Shield or rounded-rectangle
  - Armor-like plating details
  - Stable, grounded appearance
- [ ] **Generalist**: Balanced, adaptable, neutral
  - Classic rounded form (Gizzi-like)
  - Neutral proportions
  - Versatile design
- [ ] Each shape must have:
  - Primary fill area
  - Secondary accent area
  - Outline stroke
  - Shadow/depth layer

**Output:** `/components/avatar/parts/bodyShapes.ts` with 5 SVG path definitions

---

#### TASK_2.3: Eye System with 12+ Presets
**Scope:** Create comprehensive eye system
**Dependencies:** TASK_2.1
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] **Base Eye Types**:
  1. Round (friendly, approachable)
  2. Wide (alert, attentive)
  3. Narrow (focused, intense)
  4. Curious (asymmetrical, questioning)
  5. Pleased (happy, content)
  6. Skeptical (raised eyebrow, questioning)
  7. Mischief (playful, scheming)
  8. Proud (confident, assured)
  9. Dizzy (confused, overwhelmed)
  10. Sleepy (relaxed, calm)
  11. Starry (excited, amazed)
  12. Pixel (digital, retro)
- [ ] **Pupil Styles**: dot, ring, slit, star, heart, plus
- [ ] **Blink Animation**: Configurable blink rate with CSS keyframes
- [ ] **Look Direction**: Eyes track mouse/target (optional)
- [ ] Each eye preset as SVG path with parameterized sizing

**Output:** `/components/avatar/parts/eyePresets.ts`

---

#### TASK_2.4: Antenna/Accessory System
**Scope:** Create customizable accessories
**Dependencies:** TASK_2.1
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] **Antenna Styles** (0-3 count):
  - Straight: Classic stick antenna
  - Curved: Elegant arc
  - Coiled: Spring-like
  - Zigzag: Electric/energetic
  - Leaf: Organic
  - Bolt: Lightning-shaped
- [ ] **Animation Modes**:
  - Static: No movement
  - Wiggle: Random twitching
  - Pulse: Glow intensity change
  - Sway: Gentle rotation
  - Bounce: Vertical bobbing
- [ ] **Accessories** (unlockable decorations):
  - Glasses (round, square, monocle)
  - Headphones/headset
  - Hat (cap, wizard, crown)
  - Bow tie
  - Badge/medal
- [ ] Positioning system relative to body

**Output:** `/components/avatar/parts/accessories/`

---

#### TASK_2.5: Color Palette System
**Scope:** Create theme-aware color system
**Dependencies:** TASK_2.2, TASK_2.3
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] **Setup-Based Palettes**:
  - Coding: Blues, cyans, silvers
  - Creative: Warm gradients, purples, pinks
  - Research: Ambers, golds, deep blues
  - Operations: Reds, oranges, safety yellows
  - Generalist: Teals, greens, neutrals
- [ ] **Color Roles**:
  - Primary: Body fill (30 options per setup)
  - Secondary: Accent/details (20 options)
  - Glow: Emission/beacon (15 options)
  - Outline: Stroke color (10 options)
- [ ] **Accessibility**: Ensure WCAG contrast ratios
- [ ] **Dark/Light Mode**: Adaptive palettes

**Output:** `/components/avatar/presets/colorPalettes.ts`

---

### PHASE 3: ANIMATION SYSTEM

#### TASK_3.1: Emotion Animation Engine
**Scope:** Map emotions to visual states
**Dependencies:** TASK_2.1, TASK_2.2
**Estimated Time:** 4 days
**Acceptance Criteria:**
- [ ] **8 Core Emotions** (extending Gizzi):
  1. **Alert**: Quick hop, bright glow, wide eyes
  2. **Curious**: Head tilt, slow sway, questioning blink
  3. **Focused**: Steady hold, narrow eyes, minimal movement
  4. **Steady**: Gentle breathe, soft glow, calm blink
  5. **Pleased**: Happy bob, pleased eyes, warm glow pulse
  6. **Skeptical**: Lean back, raised eyebrow, slow sway
  7. **Mischief**: Playful sway, mischief eyes, quick twitches
  8. **Proud**: Lifted posture, proud eyes, strong glow
- [ ] **Animation Parameters**:
  - Body transform (translateY, rotate)
  - Glow intensity/scale
  - Eye shape morphing
  - Antenna animation speed
- [ ] CSS Keyframe generation based on config
- [ ] Transition system between emotions

**Output:** `/components/avatar/hooks/useEmotionAnimation.ts`

---

#### TASK_3.2: Idle Animation States
**Scope:** Create personality-driven idle animations
**Dependencies:** TASK_3.1
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] **Temperament-Based Idles**:
  - Precision: Minimal movement, steady breathing
  - Exploratory: More sway, curious looks around
  - Systemic: Rhythmic patterns, predictable
  - Balanced: Mix of calm and slight movement
- [ ] **Configurable Parameters**:
  - Bounce intensity (0-1)
  - Sway amplitude (degrees)
  - Breathing rate (seconds per cycle)
  - Blink frequency
- [ ] Random micro-movements for lifelike feel

**Output:** Extended animation engine with idle state machine

---

#### TASK_3.3: Reactive Animations
**Scope:** Add interaction responses
**Dependencies:** TASK_3.1
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] **Hover**: Subtle scale up (1.05x), glow intensify
- [ ] **Click**: Quick squash/stretch bounce
- [ ] **Typing**: Subtle jitter/vibration
- [ ] **Processing**: Thinking animation (hand to chin, antenna wiggle)
- [ ] **Success**: Celebration hop + sparkles
- [ ] **Error**: Shake + confused eyes
- [ ] **Listening**: Ear perk (antenna straighten)

**Output:** `/components/avatar/hooks/useReactiveAnimation.ts`

---

#### TASK_3.4: Locomotion Animations
**Scope:** Entry/exit animations
**Dependencies:** TASK_2.1
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] **Walk-In**: March from off-screen with leg/arm swing
- [ ] **Walk-Out**: March off-screen
- [ ] **Crawl/Skim**: Low profile movement for subtle entry
- [ ] **Pop-In**: Spring bounce from center
- [ ] **Fade-In**: Gentle opacity + scale reveal
- [ ] Direction control (left/right)

**Output:** Locomotion animation variants

---

### PHASE 4: CREATOR UI

#### TASK_4.1: Avatar Creator Wizard Step
**Scope:** Add Avatar step to agent creation wizard
**Dependencies:** TASK_2.5, TASK_3.4
**Estimated Time:** 3 days
**Acceptance Criteria:**
- [ ] Insert new step "Avatar" between "Character" and "Review"
- [ ] Step indicator shows avatar icon
- [ ] Route: `/studio/create/avatar`
- [ ] Integration with existing wizard state
- [ ] Skip option with default avatar

**Output:** Updated wizard flow with Avatar step

---

#### TASK_4.2: Visual Customization Panel
**Scope:** Build the character creator UI
**Dependencies:** TASK_4.1
**Estimated Time:** 5 days
**Acceptance Criteria:**
- [ ] **Layout**: 3-column design
  - Left: Category tabs (Body, Eyes, Colors, Accessories)
  - Center: Large preview area
  - Right: Detail controls
- [ ] **Body Tab**:
  - Shape selector (5 options with preview icons)
  - Size slider (0.8x - 1.2x)
- [ ] **Eyes Tab**:
  - Eye preset grid (12+ thumbnails)
  - Size slider
  - Pupil style dropdown
  - Blink rate selector
- [ ] **Colors Tab**:
  - Color picker with setup-appropriate palette
  - Primary/Secondary/Glow/Outline sections
  - Randomize button
- [ ] **Accessories Tab**:
  - Antenna count + style
  - Accessory picker with unlock state
- [ ] **Controls**:
  - Undo/Redo buttons
  - Reset to default
  - Randomize all

**Output:** `/views/agent-creation/AvatarCreatorStep.tsx`

---

#### TASK_4.3: Personality-to-Visual Mapping
**Scope:** Auto-suggest visuals based on agent personality
**Dependencies:** TASK_4.2
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] Smart defaults based on:
  - Setup type → Body shape
  - Temperament → Idle animation style
  - Specialty skills → Color palette suggestions
- [ ] "Suggest Avatar" button that analyzes:
  - Agent name (vibe check)
  - Selected capabilities
  - Voice style
- [ ] Show personality summary with visual preview

**Output:** `/lib/agents/avatar-suggestions.ts`

---

#### TASK_4.4: Real-time Preview Component
**Scope:** Live preview with emotion testing
**Dependencies:** TASK_4.2
**Estimated Time:** 3 days
**Acceptance Criteria:**
- [ ] Large centered avatar preview (200px+ size)
- [ ] Emotion test buttons (8 emotions)
- [ ] Animation speed control
- [ ] Size scale slider
- [ ] Background color toggle (light/dark)
- [ ] Export/Import JSON config (for sharing)
- [ ] Screenshot capture button

**Output:** `/components/avatar/AvatarPreview.tsx`

---

#### TASK_4.5: Template Preset System
**Scope:** Pre-made avatar templates
**Dependencies:** TASK_4.2
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] **10 Starter Templates**:
  - The Hacker (coding: circuit pattern, narrow eyes)
  - The Artist (creative: flowing, gradient, wide eyes)
  - The Scholar (research: geometric, monocle)
  - The Guardian (operations: shield, alert antenna)
  - The Helper (generalist: friendly, round)
  - The Explorer (creative: leaf antenna, curious)
  - The Architect (coding: precise, diamond)
  - The Medic (operations: red cross, caring)
  - The Sage (research: wise, slow blink)
  - The Robot (coding: pixel eyes, metallic)
- [ ] Template grid with preview
- [ ] "Use as base" functionality

**Output:** `/components/avatar/presets/templates.ts`

---

### PHASE 5: INTEGRATION

#### TASK_5.1: Avatar Persistence (DB + API)
**Scope:** Save avatar config with agent
**Dependencies:** TASK_1.2, TASK_4.5
**Estimated Time:** 3 days
**Acceptance Criteria:**
- [ ] Extend API `CreateAgentInput` with avatar config
- [ ] Database migration for avatar JSON column
- [ ] Update `agent.service.ts` create/update methods
- [ ] API endpoint: `GET /api/v1/agents/:id/avatar`
- [ ] Fallback for agents without avatars (migrate from fallbackColor)
- [ ] Avatar caching strategy

**Output:** Updated backend API and database schema

---

#### TASK_5.2: Avatar Display in Agent Cards
**Scope:** Show avatar in agent list
**Dependencies:** TASK_2.1, TASK_5.1
**Estimated Time:** 1 day
**Acceptance Criteria:**
- [ ] Replace Bot icon with AgentAvatar in AgentCard
- [ ] Size: 44px in cards
- [ ] Emotion: "steady" by default
- [ ] Fallback to generated avatar if missing
- [ ] Performance: Lazy load avatars

**Output:** Updated `AgentCard` component

---

#### TASK_5.3: Avatar Display in Agent Detail View
**Scope:** Large avatar in detail sidebar
**Dependencies:** TASK_5.1
**Estimated Time:** 1 day
**Acceptance Criteria:**
- [ ] Large avatar (80px) in sidebar header
- [ ] Interactive: Click to cycle emotions
- [ ] Status indicator sync with agent status
- [ ] Edit avatar button → opens creator

**Output:** Updated `AgentDetailView` sidebar

---

#### TASK_5.4: Avatar in Chat Interface
**Scope:** Avatar appears during agent conversations
**Dependencies:** TASK_5.1
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] Show avatar in message bubbles (small, 32px)
- [ ] Avatar reacts to agent state:
  - Typing → "focused" emotion
  - Processing → thinking animation
  - Complete → "pleased" emotion
  - Error → "skeptical" emotion
- [ ] Option to hide/show avatars per user preference

**Output:** `/components/chat/AgentMessageAvatar.tsx`

---

### PHASE 6: POLISH

#### TASK_6.1: Performance Optimization
**Scope:** Ensure 60fps animations
**Dependencies:** All previous
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] CSS containment on avatar containers
- [ ] will-change hints for animated elements
- [ ] Reduce motion media query support
- [ ] Lazy load accessory SVGs
- [ ] Virtual rendering for template grid
- [ ] FPS monitoring in dev mode

**Output:** Performance audit report

---

#### TASK_6.2: Accessibility (a11y)
**Scope:** WCAG 2.1 AA compliance
**Dependencies:** All previous
**Estimated Time:** 2 days
**Acceptance Criteria:**
- [ ] Alt text: "Agent avatar showing [emotion] emotion"
- [ ] Reduced motion support (static fallback)
- [ ] High contrast mode support
- [ ] Keyboard navigation in creator
- [ ] Screen reader announcements for emotion changes
- [ ] Focus visible states

**Output:** Accessibility audit report

---

#### TASK_6.3: Documentation & Testing
**Scope:** Complete project docs
**Dependencies:** All previous
**Estimated Time:** 3 days
**Acceptance Criteria:**
- [ ] Storybook stories for all avatar variants
- [ ] Unit tests: 80% coverage
  - Component rendering
  - Animation state machine
  - Store actions
- [ ] Integration tests:
  - Wizard flow
  - Persistence
- [ ] Visual regression tests (Chromatic)
- [ ] User documentation with examples

**Output:** `/docs/avatar-system.md`, test suite

---

## Implementation Timeline

| Phase | Tasks | Est. Duration | Cumulative |
|-------|-------|---------------|------------|
| 1. Foundation | 1.1 - 1.3 | 5 days | Week 1 |
| 2. Base Component | 2.1 - 2.5 | 12 days | Week 3 |
| 3. Animation | 3.1 - 3.4 | 10 days | Week 5 |
| 4. Creator UI | 4.1 - 4.5 | 15 days | Week 7 |
| 5. Integration | 5.1 - 5.4 | 7 days | Week 9 |
| 6. Polish | 6.1 - 6.3 | 7 days | Week 10 |

**Total Estimated Time: 10 weeks (2.5 months)**

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| SVG complexity | High | Start with simple shapes, iterate |
| Performance issues | Medium | Profile early, use CSS containment |
| Backend API changes | Medium | Version API, backward compatibility |
| Accessibility oversight | Medium | A11y review at end of each phase |
| Scope creep | High | Strict phase gates, MVP first |

---

## Success Metrics

1. **User Engagement**: 80% of new agents use custom avatars
2. **Performance**: 60fps animations on mid-tier devices
3. **Accessibility**: WCAG 2.1 AA compliant
4. **Code Quality**: 80% test coverage
5. **User Satisfaction**: Avatar creator rated 4.5+ / 5 in feedback
