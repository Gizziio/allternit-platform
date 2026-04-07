# Gizzi Brand Assets

## Quick Reference: File Locations

| Asset | Location | Description |
|-------|----------|-------------|
| **Design Spec** | `~/GIZZI_DESIGN_SPEC.md` | Official mascot anatomy & spec |
| **Mascot Component** | `src/cli/ui/components/gizzi/mascot.tsx` | React/Solid component implementation |
| **Animation Registry** | `src/cli/ui/components/animation/registry.ts` | All mascot states & frames |
| **Home Screen Usage** | `src/cli/ui/tui/routes/home.tsx:141` | Where mascot is rendered |
| **Logo Constants** | `src/cli/ui/logo.ts` | Static ASCII art logos |
| **This Doc** | `src/cli/ui/components/gizzi/BRAND.md` | You are here |

---

## GIZZI Mascot (The "Real" One)

The official GIZZI "Architectural Sentinel" mascot - 8 lines with the distinctive "A : / /" face mark.

### Full Mascot (8 lines × 14 chars)
```text
      ▄▄           <-- Floating Beacon (Coral)
   ▄▄▄  ▄▄▄        <-- Antenna Blocks (Sand)
 ▄██████████▄      <-- Head Top (Sand)
 █  ●    ●  █      <-- Eye Panel (Coral eyes on Obsidian bg)
 █  A : / / █      <-- Mark Panel (Coral "A : / /" on Obsidian bg)
  ▀████████▀       <-- Head Bottom (Sand)
   █ █  █ █        <-- 4 Legs (Structural Sand)
   ▀ ▀  ▀ ▀        <-- Feet (Structural Sand)
```

### Compact Mascot (5 lines × 8 chars)
```text
   ▄▄               <-- Beacon
 ▄▀▀█▀▀▄            <-- Shell cap
█  ▀▀  █            <-- Eyes
█  --  █            <-- Mouth
 ▀█▀▀█▀             <-- Base
```

### Color Palette (Obsidian & Sand)
| Element | Hex | RGB | Usage |
|---------|-----|-----|-------|
| **Sand** | `#D4B08C` | 212, 176, 140 | Shell, Antennae |
| **Coral** | `#D97757` | 217, 119, 87 | Beacon, Eyes, "A" mark |
| **Obsidian** | `#111318` | 17, 19, 24 | Eye panel background |
| **Structural** | `#8F6F56` | 143, 111, 86 | Legs, Feet |

### Usage in Code
```tsx
// Full mascot (the real one)
<GIZZIMascot state="idle" compact={false} />

// Compact mascot (space-constrained)
<GIZZIMascot state="idle" compact={true} />
```

### Available States
- `idle` - Static watcher
- `thinking` - Processing (question mark eyes)
- `executing` - Working (exclamation eyes)
- `responding` - Communicating (caret eyes, aperture mouth)
- `alert` - High priority notice
- `pleased` - Success (smile)
- `curious` - Analyzing (mismatched eyes)
- `focused` - Concentrating (filled eyes)
- `dizzy` - Error recovery (X eyes)
- `startled` - Surprised
- `locked-on` - Target acquired

---

## Matrix Logo (Boot Animation)

The "A" construct - 5-row ASCII matrix logo used in boot animation.

```
  █      ← Top center block
 █ █     ← Inner shoulders
██ ██    ← Crossbar with gaps (blocks at 1,2,4,5)
█ █ █    ← Center + outer sides (blocks at 1,3,5)
█   █    ← Outer legs (blocks at 1,5)
```

### Usage
- Boot animation (0-3 seconds)
- Brightness pulse effect (40%-100%)
- Gold/bronze color: `#D4B08C` (RGBA: 212, 176, 140)

### Specifications
- **Width**: 5 characters
- **Height**: 5 rows
- **Total blocks**: 11 blocks
- **Style**: Minimalist ASCII construct
- **Animation**: Brightness pulse (sin wave, divided by 8)

---

## Gizziio Logo (Main Brand)

The classic GIZZIIO ASCII logo - 4-row block lettering.

```
 ▄████▄  ▄█  ██████  ██████  ▄█  ▄█  ▄████▄ 
 ██  ▀▀  ██     ▄█▀     ▄█▀  ██  ██  ██  ██ 
 ██  ▄▄  ██   ▄█▀     ▄█▀    ██  ██  ██  ██ 
 ▀████▀  ▀█  ██████  ██████  ▀█  ▀█  ▀████▀ 
```

### Usage
- Logo reveal phase (3.8-5 seconds)
- Static display (no animation)
- Gold/bronze color: `#D4B08C`

### Specifications
- **Width**: 48 characters
- **Height**: 4 rows
- **Style**: Block lettering with decorative elements
- **Animation**: None (static)

---

## Legacy Color Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Gold/Bronze | `#D4B08C` | 212, 176, 140 | Primary brand color |
| White | `#FFFFFF` | 255, 255, 255 | Cursor, highlights |
| Gray | `#969696` | 150, 150, 150 | Secondary text |
| Dark Gray | `#6E6E6E` | 110, 110, 110 | Tertiary text |

---

## Implementation Files

- **This file**: `src/cli/ui/components/gizzi/BRAND.md`
- **Mascot component**: `src/cli/ui/components/gizzi/mascot.tsx`
- **Animation registry**: `src/cli/ui/components/animation/registry.ts`
- **Shimmering banner**: `src/cli/ui/components/gizzi/shimmering-banner.tsx`
- **Logo constants**: `src/cli/ui/logo.ts`

---

## Review Notes

### Full Mascot vs Compact
- **Full**: Use for home screen, prominent displays (shows the "A : / /" mark)
- **Compact**: Use for status bars, tight spaces (simplified, no face detail)

### Matrix Logo
- Represents the "A" construct from MatrixLogo.tsx
- Used ONLY during boot animation
- Brightness pulse makes it shimmer
- Vertical stack layout (not horizontal)

### Gizziio Logo
- Classic brand representation
- Used after typing animation
- Static, no effects
- Full width display
