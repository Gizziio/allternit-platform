# Gizzi Mascot Animation - Handoff Document

## Files Modified

1. `/src/views/chat/AgentModeGizzi.tsx` - Main orchestration component
2. `/src/components/ai-elements/GizziMascot.tsx` - Mascot rendering & leg animations
3. `/src/views/chat/AgentModeGizzi.test.tsx` - Test file (minor updates)

---

## Animation States

| State | Description | Duration | From Position | To Position |
|-------|-------------|----------|---------------|-------------|
| `off-screen` | Not visible | - | - | x: ±500px |
| `peeking` | At screen edge, looking in | 0.5s | off-screen | x: ±140px, y: -10 |
| `skimming-in` | Moving toward bar | 2.0s | edge | x: ±30px |
| `on-bar` | On input bar, interactive | 0.05s | - | x: mouse*260, y: 0 |
| `popping-up` | Mode switch: behind→bar | 0.35s | y: 60 (behind) | y: 0 (on bar) |
| `jumping-out` | Exit: bar→behind | 0.25s | y: 0 | y: 70 (behind) |

---

## Entry Sequence (Agent Mode ON)

```
off-screen → peeking (2s) → skimming-in (2s) → on-bar
```

## Exit Sequence (Agent Mode OFF)

```
on-bar → jumping-out (0.25s) → off-screen
```

## Mode Switch Sequence (Agent stays ON)

```
[previous surface] → popping-up (0.35s) → on-bar [new surface]
```

---

## Key Features Implemented

### 1. Mouse Tracking (1:1)
- Linear mapping (no curves)
- Range: ±260px from center
- Transition: 0.05s for snappy response
- Tracks even when hovering directly on mascot

### 2. Leg Animation
- Alternating leg pairs (A/B pairs)
- Duration: 400-450ms for skim mode
- Animation includes vertical lift (`translateY`) for realistic stepping
- Legs move when: `skimming-in`, `skimming-out`, or `on-bar` with movement

### 3. Fast Toggle Handling
- Detects toggle within 800ms
- Skips full entry animation
- Goes directly to `on-bar`

### 4. Positioning
- `mascotBottom: -8px` (sits ON bar surface)
- z-index: 35 when visible, 5 when behind

---

## Bugs Fixed

### Bug 1 — `popping-up` animation end position (FIXED 2026-02-28)

**Root cause**: `getMotionProps()` was returning `{ y: 60 }` (start position) instead of `{ y: 0 }` (end position on the bar).

**Fix applied** in `AgentModeGizzi.tsx`:
```typescript
case 'popping-up':
  return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }; // y: 0 = ON bar
```

---

### Bug 2 — Surface change never triggers `popping-up` (FIXED 2026-03-01)

---

### Bug 3 — Mascot still floats: framer-motion `initial` only fires on mount (FIXED 2026-03-01)

**Root cause**: The entry/exit `useEffect` only had `[active]` in its dependency array.
When the user switched surfaces while `active` stayed `true`, React never re-ran the effect,
so the `popping-up` state was never set. The animation appeared to do nothing.

**Fix applied** — added a dedicated `useEffect` in `AgentModeGizzi.tsx` that fires only on
`surface` changes:

```typescript
// Separate ref for tracking surface in the surface-change effect
const prevSurfaceForSwitchRef = useRef(surface);

useEffect(() => {
  const prevSurface = prevSurfaceForSwitchRef.current;
  prevSurfaceForSwitchRef.current = surface;

  if (prevSurface === surface) return;  // skip initial mount / no-op re-renders
  if (!active) return;                  // only act when agent is on

  clearAllTimers();
  setAnimState('popping-up');
  setBarPosition(0);
  barPositionRef.current = 0;

  entryTimerRef.current = window.setTimeout(() => {
    setAnimState('on-bar');
  }, 350);

  return clearAllTimers;
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [surface]);
```

The now-redundant surface-change block was also removed from the `[active]` effect.

---

**Root cause of Bug 3**: Even after Bugs 1 & 2 were fixed, the mascot still floated. The reason:
framer-motion only reads the `initial` prop **when the component mounts** (key changes). Since
the mascot uses `key="gizzi-mascot"` (stable), it never remounts on state changes. When
`animState` transitions to `popping-up`, the component is already at y:0 (from `on-bar`),
the `animate` target is also y:0, and framer-motion sees no movement — nothing happens.

**Fix**: introduce a `pre-popping-up` phase that uses `animate` with `duration:0` to
snap the component to y:60 BEFORE the spring animation starts. framer-motion then has
a real non-zero delta to animate.

```typescript
// New AnimationState variant
| 'pre-popping-up'  // Instant snap to y:60 (behind bar), duration:0

// getMotionProps — two new cases
case 'pre-popping-up':
  return { x: 0, y: 60, rotate: 0, scale: 0.9, opacity: 1 }; // snap to start
case 'popping-up':
  return { x: 0, y: 0,  rotate: 0, scale: 1,   opacity: 1 }; // spring to end

// duration — instant for phase 1
animState === 'pre-popping-up' ? 0 :     // no animation, just sets position
animState === 'popping-up'     ? 0.35 :  // spring-bounce to bar
```

Two-phase sequence in the surface-change `useEffect`:
```typescript
setAnimState('pre-popping-up');           // Phase 1: snap to y:60 (instant)
entryTimerRef.current = setTimeout(() => {
  setAnimState('popping-up');             // Phase 2: spring y:60 → y:0
  entryTimerRef.current = setTimeout(() => {
    setAnimState('on-bar');               // Settle
  }, 350);
}, 16); // ~1 frame gap so React flushes Phase 1 before Phase 2 starts
```

---

## Testing

Run tests:
```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/6-ui/a2r-platform
npm test -- --run AgentModeGizzi GizziMascot
```

**16 tests passing** (9 original + 7 new mode-switch tests added 2026-03-01).

New tests cover:
- `popping-up` state triggered on surface change while active
- Settles to `on-bar` after 350ms pop-up duration
- All 4 surface-pair transitions (`chat→cowork`, `cowork→code`, `code→browser`, `browser→chat`)
- Surface change while inactive does NOT trigger `popping-up`

---

## Animation Easing Curves

| Animation | Easing |
|-----------|--------|
| peeking | easeInOut |
| skimming-in | easeInOut |
| landing | [0.34, 1.56, 0.64, 1] (spring-bounce) |
| popping-up | [0.34, 1.56, 0.64, 1] (spring-bounce) |
| jumping-out | [0.4, 0, 0.6, 1] (ease-in) |
| on-bar | easeInOut |

---

## Configuration by Surface

| Surface | Entry Side | Size | Base Emotion | Selected Emotion |
|---------|-----------|------|--------------|------------------|
| chat | left | 68px | curious | pleased |
| cowork | right | 64px | focused | proud |
| code | left | 58px | alert | focused |
| browser | right | 58px | curious | focused |

---

## Known Issues Summary

1. ~~**Mode Switch Bug**: Mascot floats instead of popping up from behind bar~~ **FIXED**
2. ~~**`useEffect` missing `surface` dep**: Mode switch never triggered~~ **FIXED**
3. ~~**framer-motion `initial` only fires on mount**: Mascot still floated~~ **FIXED**
4. **Leg Animation**: May need further tuning for realistic walking feel (low priority)

---

## Dependencies

- framer-motion: Animation library
- React hooks: useEffect, useState, useRef, useCallback, useMemo

---

## Completed Steps

1. ✅ Fixed `getMotionProps()` — `popping-up` now animates to `{ y: 0 }` (on bar)
2. ✅ Fixed surface-change `useEffect` — dedicated effect with `[surface]` dep
3. ✅ Fixed framer-motion `initial`-on-mount limitation — added `pre-popping-up` phase
4. ✅ Tested mode switching between all 4 surfaces (16 tests passing)
5. ✅ Verified pre-popping-up snap → popping-up spring sequence in tests

---

Document updated: 2026-03-01
