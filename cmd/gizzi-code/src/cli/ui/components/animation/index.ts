/**
 * GIZZI Animation System
 * 
 * Deterministic, tick-driven animations for terminal UI components.
 */

// Core
export { AnimationRegistry, createGIZZIRegistry } from "@/cli/ui/components/animation/registry"
export { AnimationDriver, createGIZZIDriver } from "@/cli/ui/components/animation/driver"
export type {
  AnimMode,
  AnimSpec,
  AnimInputs,
  AnimationMetric,
  AnimationDriverConfig,
  GIZZIRuntimeState,
} from "./types"

// SolidJS Integration
export {
  AnimationProvider,
  useAnimation,
  useAnimatedFrame,
  useStatusFrame,
  useOrbitalHarness,
  useRailsScan,
  useMascotFrame,
} from "./context"
export type { AnimationProviderProps } from "@/cli/ui/components/animation/context"

// Progress Bars
export {
  ProgressBar,
  DeterminateProgress,
  renderProgressBar,
  getPercentage,
  ProgressAnimations,
} from "./progress"
export type { ProgressBarProps } from "@/cli/ui/components/animation/progress"
