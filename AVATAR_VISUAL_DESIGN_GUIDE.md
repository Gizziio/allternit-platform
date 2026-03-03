# Avatar Visual Design Guide

## Setup-to-Visual Mapping

### 1. Coding (Builder)

| Element | Design |
|---------|--------|
| **Body Shape** | Hexagonal or rounded-square base |
| **Inspiration** | Circuit boards, processors, tech gadgets |
| **Angles** | Sharp but friendly, 45° edges |
| **Textures** | Subtle grid patterns, circuit traces |
| **Eyes** | Narrow, focused; pixel pupils |
| **Antennas** | Straight or bolt-shaped |
| **Colors** | Cool blues (#3B82F6), cyans (#06B6D4), silvers (#94A3B8) |
| **Glow** | Cyan/blue tech glow |
| **Idle** | Minimal movement, precise |
| **Emotion Alert** | Quick data-packet hop |

```
    ╭──────╮
   ╱   ◆◆   ╲    ◆ = Circuit pattern detail
  │  [■■]   │   [■■] = Focused eyes
  │ ═══════ │    ═══ = Tech accent line
   ╲   ⩗⩗   ╱    ⩗⩗ = Antennas
    ╰──────╯
```

### 2. Creative (Creator)

| Element | Design |
|---------|--------|
| **Body Shape** | Organic, blob/cloud-like |
| **Inspiration** | Paint splashes, clouds, watercolors |
| **Angles** | Soft curves, flowing edges |
| **Textures** | Gradient fills, soft shadows |
| **Eyes** | Wide, expressive; star pupils |
| **Antennas** | Curved, leaf-like |
| **Colors** | Warm gradients, purples (#8B5CF6), pinks (#EC4899) |
| **Glow** | Soft rainbow/multicolor |
| **Idle** | Gentle floating, swaying |
| **Emotion Alert** | Excited bounce with sparkles |

```
       .─-─.
    ／         ＼
   (    ✦  ✦    )   ✦ = Sparkle eyes
   │  ╭────╮    │   ～ = Wavy/organic edge
   ～  ╰────╯    ～   ╱╲ = Leaf antennas
    ＼  ╱╲  ／
       '─-─'
```

### 3. Research (Analyst)

| Element | Design |
|---------|--------|
| **Body Shape** | Diamond or triangular |
| **Inspiration** | Crystals, precision instruments, glasses |
| **Angles** | Geometric, symmetrical |
| **Textures** | Clean surfaces, subtle facets |
| **Eyes** | Magnified, curious; ring pupils |
| **Antennas** | Coiled, spring-like |
| **Colors** | Ambers (#F59E0B), golds (#EAB308), deep blues (#1E40AF) |
| **Glow** | Warm amber intelligence glow |
| **Idle** | Rhythmic breathing, measured |
| **Emotion Alert** | Knowledge discovery sparkle |

```
        ◆
       ╱ ╲          ◆ = Crystal tip
      ╱ ✦ ╲         ✦ = Magnified curious eyes
     │▓▓▓▓▓│        ▓▓▓ = Faceted surface
      ╲   ╱         @ = Coiled antenna
       ╲@╱
        ▼
```

### 4. Operations (Operator)

| Element | Design |
|---------|--------|
| **Body Shape** | Shield or rounded-rectangle |
| **Inspiration** | Armor, shields, badges, tools |
| **Angles** | Strong, stable edges |
| **Textures** | Plate segments, rivets |
| **Eyes** | Alert, watchful; dot pupils |
| **Antennas** | Zigzag, lightning-shaped |
| **Colors** | Reds (#EF4444), oranges (#F97316), safety yellow (#EAB308) |
| **Glow** | Warning/alert red glow |
| **Idle** | Strong, grounded stance |
| **Emotion Alert** | Shield-up protective pose |

```
    ╔═══════╗
    ║ ◉  ◉  ║        ◉ = Watchful eyes
    ║  ▓▓▓  ║        ▓▓▓ = Plate armor detail
    ╠═══════╣        ⚡⚡ = Zigzag antennas
    ║ ⚡  ⚡ ║
    ╚═══════╝
```

### 5. Generalist

| Element | Design |
|---------|--------|
| **Body Shape** | Classic rounded form (Gizzi-like) |
| **Inspiration** | Friendly robot, helpful assistant |
| **Angles** | Balanced, approachable |
| **Textures** | Smooth, clean |
| **Eyes** | Round, friendly; dot pupils |
| **Antennas** | Single curved or double straight |
| **Colors** | Teals (#14B8A6), greens (#22C55E), neutrals (#6B7280) |
| **Glow** | Soft teal friendly glow |
| **Idle** | Gentle bob, welcoming |
| **Emotion Alert** | Happy alert wave |

```
      ╭─────╮
     ╱ •   • ╲       • • = Friendly round eyes
    │    ◡    │      ◡ = Gentle smile line
    │ ═══════ │     ╱╲ = Standard antennas
     ╲  ╱╲   ╱
      ╰─────╯
```

---

## Eye Preset Catalog

### Basic Shapes

| Name | Shape | Personality |
|------|-------|-------------|
| **Round** | ● ● | Friendly, approachable |
| **Wide** | ◯ ◯ | Alert, attentive |
| **Narrow** | ▬ ▬ | Focused, intense |
| **Curious** | ◐ ◑ | Questioning, asymmetrical |

### Expression Eyes

| Name | Shape | Personality |
|------|-------|-------------|
| **Pleased** | ᵔ ᵔ | Happy, content |
| **Skeptical** | ◔ ◔ | Raised eyebrow, questioning |
| **Mischief** | ◕ ◕ | Playful, scheming |
| **Proud** | ‾◡‾ | Confident, assured |
| **Dizzy** | ◎ ◎ | Confused, overwhelmed |
| **Sleepy** | ◡ ◡ | Relaxed, half-closed |

### Special Eyes

| Name | Shape | Personality |
|------|-------|-------------|
| **Starry** | ✦ ✦ | Excited, amazed |
| **Pixel** | ⬛ ⬛ | Digital, retro |
| **Heart** | ♥ ♥ | Loving, caring |
| **Plus** | ✚ ✚ | Medical, helpful |

### Eye Anatomy Variables

```typescript
interface EyeVariables {
  // Sizing (0.5 - 1.5)
  scale: number;
  
  // Pupil styles
  pupil: "dot" | "ring" | "slit" | "star" | "heart" | "plus";
  
  // Eyelid/expression
  lidPosition: "open" | "squint" | "wide" | "wink";
  
  // Direction
  lookAt: { x: number; y: number } | "center";
  
  // Blink behavior
  blinkRate: "never" | "slow" (4s) | "normal" (2s) | "fast" (1s);
}
```

---

## Antenna Styles

| Style | Shape | Personality | Animation |
|-------|-------|-------------|-----------|
| **Straight** | │ │ | Classic, reliable | Wiggle |
| **Curved** | ⎛ ⎞ | Elegant, refined | Sway |
| **Coiled** | @ @ | Springy, energetic | Bounce |
| **Zigzag** | ⚡ ⚡ | Electric, intense | Pulse |
| **Leaf** | 🌿 🌿 | Natural, organic | Gentle sway |
| **Bolt** | ⌁ ⌁ | Powerful, striking | Quick twitch |

### Antenna Configuration

```typescript
interface AntennaConfig {
  // Count affects spacing
  count: 0 | 1 | 2 | 3;
  
  // Style defines SVG path
  style: AntennaStyle;
  
  // Position relative to body
  placement: "center" | "wide" | "asymmetric";
  
  // Animation behavior
  animation: {
    type: "static" | "wiggle" | "pulse" | "sway" | "bounce";
    speed: "slow" | "normal" | "fast";
    intensity: number; // 0-1
  };
  
  // Tip decoration
  tip: "none" | "ball" | "glow" | "star" | "diamond";
}
```

---

## Color Palette System

### Primary Colors (Body Fill)

#### Coding - Cool Tech
```
Blue-500:    #3B82F6  (Primary)
Cyan-400:    #22D3EE  (Accent)
Slate-400:   #94A3B8  (Neutral)
Indigo-600:  #4F46E5  (Deep)
Sky-500:     #0EA5E9  (Bright)
```

#### Creative - Warm Artsy
```
Purple-500:  #8B5CF6  (Primary)
Pink-500:    #EC4899  (Accent)
Fuchsia-400: #E879F9  (Highlight)
Rose-400:    #FB7185  (Warm)
Violet-500:  #6366F1  (Deep)
```

#### Research - Scholarly
```
Amber-500:   #F59E0B  (Primary)
Yellow-400:  #EAB308  (Accent)
Blue-800:    #1E40AF  (Deep)
Stone-500:   #78716C  (Neutral)
Orange-400:  #FB923C  (Warm)
```

#### Operations - Bold Action
```
Red-500:     #EF4444  (Primary)
Orange-500:  #F97316  (Accent)
Yellow-500:  #EAB308  (Alert)
Rose-600:    #E11D48  (Bold)
Amber-600:   #D97706  (Warm)
```

#### Generalist - Balanced
```
Teal-500:    #14B8A6  (Primary)
Green-500:   #22C55E  (Accent)
Emerald-400: #34D399  (Bright)
Slate-500:   #64748B  (Neutral)
Cyan-600:    #0891B2  (Deep)
```

### Color Application

```typescript
interface ColorScheme {
  // Main body fill
  primary: string;    // 60% of visual weight
  
  // Eye/accent color
  secondary: string;  // 30% of visual weight
  
  // Emission/glow effect
  glow: string;       // RGBA with opacity
  
  // Outline stroke
  outline: string;    // 10% of visual weight
  
  // Shadow/depth
  shadow: string;     // RGBA dark overlay
}
```

---

## Animation Specifications

### Idle Animations by Temperament

```css
/* Precision - Minimal, exact */
@keyframes precision-idle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1px); }  /* Subtle */
}
animation: precision-idle 4s ease-in-out infinite;

/* Exploratory - Curious, looking around */
@keyframes exploratory-idle {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  25% { transform: translateX(-3px) rotate(-2deg); }
  75% { transform: translateX(3px) rotate(2deg); }
}
animation: exploratory-idle 6s ease-in-out infinite;

/* Systemic - Rhythmic, predictable */
@keyframes systemic-idle {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
animation: systemic-idle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;

/* Balanced - Natural mix */
@keyframes balanced-idle {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-2px) rotate(-1deg); }
  75% { transform: translateY(-2px) rotate(1deg); }
}
animation: balanced-idle 4s ease-in-out infinite;
```

### Emotion Animation Timing

| Emotion | Duration | Easing | Keyframes |
|---------|----------|--------|-----------|
| Alert | 300ms | ease-out | hop up → settle |
| Curious | 500ms | ease-in-out | tilt → hold → return |
| Focused | 200ms | linear | eyes narrow instantly |
| Pleased | 400ms | spring(1, 100, 10, 0) | bounce settle |
| Skeptical | 600ms | ease-in-out | lean back → hold |
| Mischief | 300ms | ease-out | quick sway |
| Proud | 500ms | ease-out | lift posture |
| Steady | 4000ms | ease-in-out | gentle breathe |

---

## Size Guidelines

### Display Sizes

| Context | Size | Use Case |
|---------|------|----------|
| **xs** | 24px | Inline mentions, badges |
| **sm** | 32px | Chat messages, compact lists |
| **md** | 44px | Agent cards, grid items |
| **lg** | 64px | Detailed lists, headers |
| **xl** | 80px | Detail view sidebar |
| **2xl** | 120px | Creator preview |
| **3xl** | 200px | Full-page showcase |

### Responsive Scaling

```typescript
const AVATAR_SIZES = {
  xs: { size: 24, strokeWidth: 1, eyeScale: 0.6 },
  sm: { size: 32, strokeWidth: 1.5, eyeScale: 0.7 },
  md: { size: 44, strokeWidth: 2, eyeScale: 0.8 },
  lg: { size: 64, strokeWidth: 2.5, eyeScale: 0.9 },
  xl: { size: 80, strokeWidth: 3, eyeScale: 1.0 },
  '2xl': { size: 120, strokeWidth: 4, eyeScale: 1.2 },
  '3xl': { size: 200, strokeWidth: 6, eyeScale: 1.5 },
} as const;
```

---

## Template Gallery

### The Hacker
```typescript
{
  setup: "coding",
  baseShape: "hex",
  eyes: { preset: "narrow", size: 0.8, pupil: "pixel" },
  antennas: { count: 2, style: "straight", animation: "pulse" },
  colors: { primary: "#1E293B", secondary: "#22D3EE", glow: "#06B6D4" },
  personality: { bounce: 0.1, sway: 0.05, breathing: true }
}
```

### The Artist
```typescript
{
  setup: "creative",
  baseShape: "cloud",
  eyes: { preset: "wide", size: 1.2, pupil: "star" },
  antennas: { count: 1, style: "leaf", animation: "sway" },
  colors: { primary: "#8B5CF6", secondary: "#EC4899", glow: "#E879F9" },
  personality: { bounce: 0.4, sway: 0.3, breathing: true }
}
```

### The Scholar
```typescript
{
  setup: "research",
  baseShape: "diamond",
  eyes: { preset: "curious", size: 1.0, pupil: "ring" },
  antennas: { count: 2, style: "coiled", animation: "bounce" },
  colors: { primary: "#F59E0B", secondary: "#1E40AF", glow: "#EAB308" },
  personality: { bounce: 0.15, sway: 0.1, breathing: true }
}
```

### The Guardian
```typescript
{
  setup: "operations",
  baseShape: "square",
  eyes: { preset: "alert", size: 0.9, pupil: "dot" },
  antennas: { count: 2, style: "zigzag", animation: "wiggle" },
  colors: { primary: "#DC2626", secondary: "#F59E0B", glow: "#EF4444" },
  personality: { bounce: 0.05, sway: 0.02, breathing: false }
}
```

### The Helper
```typescript
{
  setup: "generalist",
  baseShape: "round",
  eyes: { preset: "round", size: 1.0, pupil: "dot" },
  antennas: { count: 2, style: "curved", animation: "sway" },
  colors: { primary: "#14B8A6", secondary: "#34D399", glow: "#2DD4BF" },
  personality: { bounce: 0.3, sway: 0.15, breathing: true }
}
```

---

## Accessibility Guidelines

### Color Contrast

- Body colors must have 4.5:1 contrast against backgrounds
- Eye colors must have 3:1 contrast against body
- Glow effects should not be the only visual indicator

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .avatar {
    animation: none !important;
    transition: none !important;
  }
  
  .avatar__eyes {
    /* Static eyes, no blink */
  }
  
  .avatar__antennas {
    /* Static position */
  }
}
```

### Screen Reader Support

```typescript
// Announce emotion changes
const announceEmotion = (emotion: AvatarEmotion) => {
  const announcement = `Agent avatar is now feeling ${emotion}`;
  // Use ARIA live region
};

// Avatar component
<svg 
  role="img"
  aria-label={`Agent avatar: ${description}`}
  aria-live="polite"
>
  ...
</svg>
```

---

## Implementation Checklist

### Visual Design
- [ ] All 5 body shapes defined
- [ ] All 12+ eye presets designed
- [ ] All 6 antenna styles defined
- [ ] Color palette per setup documented
- [ ] Emotion animations specified
- [ ] Size variants tested

### Technical
- [ ] SVG paths exported
- [ ] CSS keyframes defined
- [ ] Animation performance optimized
- [ ] Responsive scaling implemented
- [ ] Accessibility requirements met

### Documentation
- [ ] Design tokens documented
- [ ] Animation timing documented
- [ ] Template gallery complete
- [ ] Usage examples provided
