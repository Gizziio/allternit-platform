# Avatar System Architecture

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT AVATAR SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    AgentAvatar (Container)                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │  Props:                                                       │ │   │
│  │  │  - avatarConfig: AvatarConfig                                │ │   │
│  │  │  - emotion: AvatarEmotion                                    │ │   │
│  │  │  - size: number (px)                                         │ │   │
│  │  │  - isAnimating: boolean                                      │ │   │
│  │  │  - interactionState: 'idle' | 'hover' | 'active'             │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  │                              │                                    │   │
│  │         ┌────────────────────┼────────────────────┐              │   │
│  │         ▼                    ▼                    ▼              │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │   │
│  │  │ useEmotion   │    │ useAnimation │    │ useReactive  │       │   │
│  │  │ Animation    │    │ Controller   │    │ Animation    │       │   │
│  │  └──────────────┘    └──────────────┘    └──────────────┘       │   │
│  │         │                    │                    │              │   │
│  │         └────────────────────┼────────────────────┘              │   │
│  │                              ▼                                   │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │                  AvatarSVG (Render)                        │  │   │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │  │   │
│  │  │  │  Body   │ │  Eyes   │ │Antennas │ │  Glow   │         │  │   │
│  │  │  │ (Shape) │ │(Presets)│ │(Styles) │ │(Effect) │         │  │   │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                 AvatarCreatorWizard (UI)                         │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │  Step 1: Template Selection                                  │ │   │
│  │  │  Step 2: Body Customization                                  │ │   │
│  │  │  Step 3: Eye Configuration                                   │ │   │
│  │  │  Step 4: Color Palette                                       │ │   │
│  │  │  Step 5: Accessories                                         │ │   │
│  │  │  Step 6: Personality Mapping                                 │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  │                              │                                    │   │
│  │                              ▼                                    │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │                AvatarPreview (Live Preview)                │  │   │
│  │  │  - Large centered avatar                                    │  │   │
│  │  │  - Emotion test buttons                                     │  │   │
│  │  │  - Animation controls                                       │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  │                              │                                    │   │
│  │                              ▼                                    │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │              avatarCreatorStore (Zustand)                  │  │   │
│  │  │  - currentConfig: AvatarConfig                             │  │   │
│  │  │  - history: ConfigHistory[]                                │  │   │
│  │  │  - selectedTemplate: string                                │  │   │
│  │  │  - validationErrors: ValidationError[]                     │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │────▶│   Wizard     │────▶│   Store      │────▶│   Preview    │
│   Action     │     │   Component  │     │   Update     │     │   Re-render  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                        │
                                                                        ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Agent      │◀────│   API        │◀────│   Review     │◀────│   Config     │
│   Created    │     │   Persist    │     │   Submit     │     │   Validate   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

## Avatar Configuration Schema

```typescript
interface AvatarConfig {
  version: "1.0";
  
  // Base Appearance
  baseShape: "round" | "square" | "hex" | "diamond" | "cloud";
  
  // Eye System
  eyes: {
    preset: EyePreset;           // 12+ presets
    size: number;                // 0.5 - 1.5
    color: string;               // Hex color
    pupilStyle: PupilStyle;      // dot, ring, slit, star
    blinkRate: BlinkRate;        // slow, normal, fast, never
  };
  
  // Antennas/Accessories
  antennas: {
    count: 0 | 1 | 2 | 3;
    style: AntennaStyle;         // straight, curved, coiled, zigzag
    animation: AntennaAnimation; // static, wiggle, pulse, sway
  };
  
  // Color Palette
  colors: {
    primary: string;             // Body fill
    secondary: string;           // Eye/accent
    glow: string;                // Beacon emission
    outline: string;             // Stroke color
  };
  
  // Personality-Driven Animation
  personality: {
    bounce: number;              // 0-1 idle bounce
    sway: number;                // 0-1 rotation sway
    breathing: boolean;          // Scale pulsing
  };
  
  // Unlockables
  accessories: string[];         // IDs of unlocked accessories
}
```

## Emotion State Machine

```
                    ┌─────────────┐
                    │    IDLE     │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌───────────┐
   │ ALERT   │      │ FOCUSED  │      │  PLEASED  │
   │  (hop)  │      │ (steady) │      │  (bounce) │
   └────┬────┘      └────┬─────┘      └─────┬─────┘
        │                │                  │
        └────────────────┼──────────────────┘
                         │
        ┌────────────────┼──────────────────┐
        │                │                  │
        ▼                ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌───────────┐
   │ CURIOUS │      │SKEPTICAL │      │  MISCHIEF │
   │  (tilt) │      │ (lean)   │      │  (sway)   │
   └─────────┘      └──────────┘      └───────────┘
                         │
                         ▼
                    ┌──────────┐
                    │  PROUD   │
                    │ (lifted) │
                    └──────────┘
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTEGRATION POINTS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. AGENT CREATION WIZARD                                                    │
│     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌────────────┐ │
│     │   Welcome   │───▶│  Identity   │───▶│ Personality │───▶│  Character │ │
│     └─────────────┘    └─────────────┘    └─────────────┘    └────────────┘ │
│                                                                             │ │
│     ┌─────────────┐    ┌─────────────┐                                      │ │
│     │   Review    │◀───│   AVATAR    │◀─────────────────────────────────────┘ │
│     └─────────────┘    └─────────────┘    ← NEW STEP                         │
│           │                                                                  │
│           ▼                                                                  │
│     ┌─────────────┐                                                          │
│     │   Created   │                                                          │
│     └─────────────┘                                                          │
│                                                                              │
│  2. AGENT DISPLAY LOCATIONS                                                  │
│     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│     │ Agent Cards  │  │Agent Detail  │  │   Chat UI    │  │ Agent Hub    │   │
│     │  (44px)      │  │   (80px)     │  │   (32px)     │  │  (list view) │   │
│     └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│  3. DATABASE SCHEMA                                                          │
│     ┌─────────────────────────────────────────────────────────────────────┐  │
│     │  agents table                                                       │  │
│     │  ├── id: uuid                                                       │  │
│     │  ├── name: string                                                   │  │
│     │  ├── config: jsonb                                                  │  │
│     │  │   └── characterBlueprint: {...}                                  │  │
│     │  │       └── avatar: AvatarConfig  ← EXTENDS                        │  │
│     │  └── ...                                                          │  │
│     └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
6-ui/a2r-platform/
├── src/
│   ├── components/
│   │   ├── avatar/
│   │   │   ├── AgentAvatar.tsx              # Main container
│   │   │   ├── AgentAvatar.types.ts         # Type definitions
│   │   │   ├── parts/
│   │   │   │   ├── Body.tsx                 # Body shape renderer
│   │   │   │   ├── Eyes.tsx                 # Eye system
│   │   │   │   ├── Antennas.tsx             # Antenna renderer
│   │   │   │   ├── Glow.tsx                 # Beacon effect
│   │   │   │   └── Accessories.tsx          # Decorations
│   │   │   ├── presets/
│   │   │   │   ├── bodyShapes.ts            # 5 setup shapes
│   │   │   │   ├── eyePresets.ts            # 12+ eye types
│   │   │   │   ├── colorPalettes.ts         # Theme colors
│   │   │   │   └── templates.ts             # 10 starter templates
│   │   │   └── hooks/
│   │   │       ├── useEmotionAnimation.ts   # Emotion state machine
│   │   │       ├── useReactiveAnimation.ts  # Interaction responses
│   │   │       └── useAvatarAnimation.ts    # Animation controller
│   │   └── ai-elements/
│   │       └── GizziMascot.tsx              # Reference implementation
│   │
│   ├── views/
│   │   └── agent-creation/
│   │       ├── AvatarCreatorStep.tsx        # Wizard step
│   │       ├── AvatarPreview.tsx            # Live preview
│   │       ├── BodyCustomization.tsx        # Body tab
│   │       ├── EyeCustomization.tsx         # Eyes tab
│   │       ├── ColorCustomization.tsx       # Colors tab
│   │       └── AccessoryCustomization.tsx   # Accessories tab
│   │
│   ├── stores/
│   │   └── avatar-creator.store.ts          # Zustand store
│   │
│   ├── lib/
│   │   └── agents/
│   │       ├── character.types.ts           # Extended AvatarConfig
│   │       ├── avatar-suggestions.ts        # Smart defaults
│   │       └── avatar-validation.ts         # Zod schema
│   │
│   └── hooks/
│       └── useAvatar.ts                     # Convenience hook
│
├── docs/
│   ├── avatar-system-design.md              # Design document
│   └── avatar-system.md                     # User documentation
│
└── tests/
    ├── components/
    │   └── avatar/
    │       ├── AgentAvatar.test.tsx
    │       └── AvatarCreator.test.tsx
    └── integration/
        └── avatar-creation.test.ts
```

## Performance Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERFORMANCE OPTIMIZATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. RENDERING                                                                │
│     • CSS containment: contain: layout style paint                         │
│     • will-change: transform, opacity (only during animation)              │
│     • GPU-accelerated transforms: translate3d, scale3d                     │
│     • Avoid layout thrashing: read layout props before writes              │
│                                                                              │
│  2. ANIMATION                                                                │
│     • CSS keyframe animations (not JS-driven)                              │
│     • requestAnimationFrame for state updates only                         │
│     • Throttle mouse tracking to 60fps                                     │
│     • Cancel animations when off-screen                                    │
│                                                                              │
│  3. LOADING                                                                  │
│     • Lazy load accessory SVGs on demand                                   │
│     • Preload critical assets (base shapes, common eyes)                   │
│     • Cache compiled avatar configs                                        │
│     • Web Worker for avatar config validation                              │
│                                                                              │
│  4. MEMORY                                                                   │
│     • Object pooling for animation objects                                 │
│     • Limit undo history (max 50 steps)                                    │
│     • Debounced config serialization                                       │
│     • Cleanup event listeners on unmount                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## MVP vs Full Feature Set

| Feature | MVP | Full |
|---------|-----|------|
| Body Shapes | 3 (round, square, cloud) | 5 (all setups) |
| Eye Presets | 6 basic | 12+ advanced |
| Color Options | 20 presets | Full color picker |
| Antennas | 0-2 count, 2 styles | 0-3 count, 6 styles |
| Emotions | 4 (steady, alert, pleased, focused) | 8 all emotions |
| Accessories | None | 10 unlockables |
| Templates | 5 | 10+ |
| Animation | Idle only | Full emotion + reactive |
| Export | JSON only | PNG + JSON |
