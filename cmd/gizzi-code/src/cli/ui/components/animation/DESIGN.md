# Allternit Animation System - Design Note

## Overview

A deterministic, tick-driven animation system for Allternit's terminal UI that eliminates per-component timers and unifies all motion under a single clock source.

## Architecture

### Core Principle

```
frame = f(tick, spec)
```

Every animation frame is a pure function of:
- **tick**: Global counter incremented by central loop
- **spec**: Static animation definition (frames, interval, mode)

No `Date.now()`, no `setInterval`, no component-owned timers.

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    AnimationProvider                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │    Tick     │───▶│   Driver    │───▶│  StatusBar/etc  │ │
│  │   Counter   │    │             │    │                 │ │
│  │  (20 TPS)   │    │ frame(id)   │    │  useAnimatedFrame│ │
│  └─────────────┘    │             │    │                 │ │
│                     └─────────────┘    └─────────────────┘ │
│                            │                                │
│                     ┌─────────────┐                         │
│                     │  Registry   │                         │
│                     │             │                         │
│                     │  specs[id]  │                         │
│                     └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/ui/animation/
├── index.ts              # Public API exports
├── types.ts              # TypeScript types
├── registry.ts           # AnimationRegistry + Allternit defaults
├── driver.ts             # AnimationDriver (core engine)
├── context.tsx           # SolidJS provider + hooks
├── DESIGN.md             # This document
└── __tests__/
    ├── registry.test.ts  # 22 tests
    └── driver.test.ts    # 17 tests
```

## Animation Modes

| Mode | Behavior | Example |
|------|----------|---------|
| `loop` | Cycle frames indefinitely | Spinners, status pulses |
| `once` | Stop at last frame | Completion indicators |
| `pingpong` | Bounce back and forth | Scanner effects |

## Allternit Default Animations

### Status Bar Pulses

| State | ID | Frames | Interval |
|-------|-----|--------|----------|
| `connecting` | `status.connecting` | 8 frames | 3 ticks |
| `planning` | `status.planning` | 6 frames | 3 ticks |
| `executing` | `status.executing` | 4 frames | 3 ticks |
| `responding` | `status.responding` | 7 frames | 3 ticks |
| `compacting` | `status.compacting` | 8 frames | 2 ticks |

### Spinners

| ID | Frames | Interval |
|-----|--------|----------|
| `spinner.braille` | ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ | 2 ticks |
| `spinner.quadrant` | ◰◳◲◱ | 2 ticks |
| `spinner.dots` | ⋯⋰⋮⋱ | 3 ticks |

### Allternit Signature Loaders

| ID | Type | Width |
|-----|------|-------|
| `allternit.orbit_harness` | Procedural | 12 chars |
| `allternit.rails_scan` | Predefined | 14 chars |
| `allternit.dag_pulse` | Procedural | 5-12 chars |

## Usage

### Basic (Imperative)

```typescript
import { AnimationRegistry, AnimationDriver } from "@/ui/animation"

const registry = createAllternitRegistry()
const driver = new AnimationDriver(registry, {
  getTick: () => globalTick,
  animationsEnabled: () => kv.get("animations_enabled", true),
})

const frame = driver.frame("status.executing")
```

### SolidJS (Reactive)

```tsx
import { AnimationProvider, useAnimatedFrame, useStatusFrame } from "@/ui/animation"

// Wrap app
<AnimationProvider tickRate={20}>
  <App />
</AnimationProvider>

// In component
const frame = useAnimatedFrame("spinner.braille")
const pulse = useStatusFrame(() => "executing")
```

## Integration with Existing Code

### Before (setInterval anti-pattern)

```typescript
function StatusBar() {
  const [now, setNow] = createSignal(Date.now())
  
  createEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 120)
    onCleanup(() => clearInterval(timer))
  })
  
  const frameTick = createMemo(() => Math.floor(now() / 120))
  const pulse = createMemo(() => pulseFrame(state(), frameTick()))
  
  return <text>{pulse()}</text>
}
```

### After (tick-driven)

```typescript
function StatusBar() {
  const pulse = useStatusFrame(() => state())
  return <text>{pulse()}</text>
}
```

## Observability

The driver emits metrics for monitoring:

```typescript
type AnimationMetric = {
  type: "frame_render" | "phase_change" | "tick_rate" | "animation_disabled"
  animId: string
  tick: bigint
  frameIndex?: number
  timestamp: number
  cellsWritten: number
}
```

Usage:

```typescript
const driver = new AnimationDriver(registry, {
  getTick: () => tick,
  animationsEnabled: () => enabled,
  onMetric: (m) => console.log("anim:", m),
})
```

## Performance

- **Tick rate**: Configurable (default 20 TPS)
- **Frame computation**: O(1) arithmetic
- **Memory**: Pre-computed frames, no per-tick allocation
- **Render cost**: Bounded (fixed-width frames)

## Testing

All behavior is deterministic and testable:

```typescript
const driver = new AnimationDriver(registry, {
  getTick: () => 42n, // Fixed tick
  animationsEnabled: () => true,
})

expect(driver.frame("status.connecting")).toBe("<===·>")
```

Run tests:

```bash
bun test src/ui/animation/__tests__/
```

## Alignment with Incumbent Patterns

| Framework | Pattern | Allternit Implementation |
|-----------|---------|-------------------|
| Bubble Tea | Tick messages | Central tick counter |
| Ratatui | TPS/FPS split | 20 TPS logic, native render |
| K9s | Signal over motion | State-mapped animations |

## Future Work

- [ ] Background task dashboard using `allternit.dag_pulse`
- [ ] Orbital harness variants for different phases
- [ ] Progress bars for known-duration operations
- [ ] Web terminal scheduler (RAF-based)

## References

- Bubble Tea: https://github.com/charmbracelet/bubbletea
- Ratatui: https://github.com/ratatui/ratatui
- Research artifacts: See `docs/research/animation-systems.md`
