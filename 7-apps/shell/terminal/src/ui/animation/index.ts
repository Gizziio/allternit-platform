/**
 * A2R Animation System
 * 
 * Deterministic, tick-driven animations for terminal UI components.
 * 
 * Architecture:
 * - Single tick source drives all animations
 * - No per-component timers
 * - Pure functions: frame(tick, spec) -> string
 * - Observable metrics for debugging/auditing
 * 
 * Usage (basic):
 * ```typescript
 * import { AnimationRegistry, AnimationDriver, createA2RRegistry } from "@/ui/animation"
 * 
 * const registry = createA2RRegistry()
 * const driver = new AnimationDriver(registry, {
 *   getTick: () => globalTick,
 *   animationsEnabled: () => kv.get("animations_enabled", true),
 * })
 * 
 * const frame = driver.frame("status.executing")
 * ```
 * 
 * Usage (SolidJS integration):
 * ```tsx
 * import { AnimationProvider, useAnimatedFrame } from "@/ui/animation"
 * 
 * <AnimationProvider tickRate={20}>
 *   <StatusBar />
 * </AnimationProvider>
 * 
 * // In component:
 * const frame = useAnimatedFrame("status.connecting")
 * ```
 */

// Core
export { AnimationRegistry, createA2RRegistry } from "./registry"
export { AnimationDriver, createA2RDriver } from "./driver"
export type {
  AnimMode,
  AnimSpec,
  AnimInputs,
  AnimationMetric,
  AnimationDriverConfig,
  A2RRuntimeState,
} from "./types"

// SolidJS Integration
export {
  AnimationProvider,
  useAnimation,
  useAnimatedFrame,
  useStatusFrame,
  useOrbitalHarness,
  useRailsScan,
} from "./context"
export type { AnimationProviderProps } from "./context"

// Progress Bars
export {
  ProgressBar,
  DeterminateProgress,
  renderProgressBar,
  getPercentage,
  ProgressAnimations,
} from "./progress"
export type { ProgressBarProps } from "./progress"
