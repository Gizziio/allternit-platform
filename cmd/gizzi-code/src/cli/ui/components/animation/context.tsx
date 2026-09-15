/**
 * GIZZI Animation System - SolidJS Context
 * 
 * Provides AnimationDriver to TUI components via SolidJS context.
 * Integrates with existing KV context for animations_enabled setting.
 */

import { createContext, useContext, createSignal, createMemo, onCleanup, createEffect } from "solid-js"
import type { Accessor } from "solid-js"
import { AnimationDriver } from "@/cli/ui/components/animation/driver"
import { AnimationRegistry, createGIZZIRegistry } from "@/cli/ui/components/animation/registry"
import type { AnimationMetric } from "@/cli/ui/components/animation/types"

// ==============================================================================
// Context Types
// ==============================================================================

export type AnimationContextValue = {
  /** Get animation frame for current tick */
  frame: (id: string) => string
  /** Get procedural frame with inputs */
  frameProcedural: (id: string, inputs?: any) => string
  /** Map runtime state to animation ID */
  stateToAnimationId: (state: string) => string
  /** Current tick counter (for debugging) */
  tick: Accessor<bigint>
  /** Whether animations are enabled */
  enabled: Accessor<boolean>
  /** Registry instance (for adding custom animations) */
  registry: AnimationRegistry
}

// ==============================================================================
// Context Creation
// ==============================================================================

const AnimationContext = createContext<AnimationContextValue>()

// ==============================================================================
// Provider Props
// ==============================================================================

export type AnimationProviderProps = {
  /** Initial tick value */
  initialTick?: bigint
  /** Ticks per second (default: 20, can be reactive) */
  tickRate?: number | Accessor<number>
  /** Whether animations enabled (default: true) */
  enabled?: Accessor<boolean>
  /** Metric callback for observability */
  onMetric?: (metric: AnimationMetric) => void
  children: any
}

// ==============================================================================
// Provider Component
// ==============================================================================

export function AnimationProvider(props: AnimationProviderProps) {
  // Initialize registry with GIZZI defaults
  const registry = new AnimationRegistry()
  const defaults = createGIZZIRegistry()
  
  // Copy defaults into new registry
  for (const id of defaults.list()) {
    registry.register(defaults.get(id))
  }

  // Signals
  const [tick, setTick] = createSignal(props.initialTick ?? 0n)
  const enabled = props.enabled ?? (() => true)

  // Create driver with reactive config
  const driver = new AnimationDriver(registry, {
    getTick: () => tick(),
    animationsEnabled: enabled,
    onMetric: props.onMetric,
  })

  // Animation loop - reactive to tickRate changes
  let intervalId: ReturnType<typeof setInterval> | undefined

  const getTickRate = () => {
    const rate = props.tickRate ?? 20
    return typeof rate === "function" ? rate() : rate
  }

  createEffect(() => {
    // Clear existing interval
    if (intervalId) clearInterval(intervalId)

    const tickRate = getTickRate()
    const intervalMs = 1000 / tickRate

    intervalId = setInterval(() => {
      setTick(t => t + 1n)
    }, intervalMs)
  })

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId)
  })

  // Context value (memoized functions)
  const value: AnimationContextValue = {
    frame: (id: string) => driver.frame(id),
    frameProcedural: (id: string, inputs?: any) => driver.frameProcedural(id, inputs),
    stateToAnimationId: (state: string) => driver.stateToAnimationId(state),
    tick: () => tick(),
    enabled,
    registry,
  }

  return (
    <AnimationContext.Provider value={value}>
      {props.children}
    </AnimationContext.Provider>
  )
}

// ==============================================================================
// Hook
// ==============================================================================

export function useAnimation(): AnimationContextValue {
  const context = useContext(AnimationContext)
  if (!context) {
    throw new Error("useAnimation must be used within an AnimationProvider")
  }
  return context
}

// ==============================================================================
// Convenience Hooks
// ==============================================================================

/**
 * Hook to get an animated frame that updates automatically.
 * Returns a memo that recomputes when tick changes.
 */
export function useAnimatedFrame(id: string): Accessor<string> {
  const animation = useAnimation()
  return createMemo(() => animation.frame(id))
}

/**
 * Hook to get status bar frame for current runtime state.
 */
export function useStatusFrame(state: Accessor<string>): Accessor<string> {
  const animation = useAnimation()
  return createMemo(() => {
    const animId = animation.stateToAnimationId(state())
    return animation.frame(animId)
  })
}

/**
 * Hook for procedural orbital harness animation.
 */
export function useOrbitalHarness(
  phase: Accessor<string>,
  severity: Accessor<"low" | "med" | "high">
): Accessor<string> {
  const animation = useAnimation()
  return createMemo(() => animation.frameProcedural("gizzi.orbit_harness", {
    phase: phase(),
    severity: severity(),
  }))
}

/**
 * Hook for rails scan animation.
 */
export function useRailsScan(
  events: Accessor<Array<{ type: string }>>
): Accessor<string> {
  const animation = useAnimation()
  return createMemo(() => animation.frameProcedural("gizzi.rails_scan", {
    events: events(),
  }))
}

/**
 * Hook for alive mascot animation.
 */
export function useMascotFrame(
  state: Accessor<string>,
  compact: Accessor<boolean>
): Accessor<string> {
  const animation = useAnimation()
  return createMemo(() => animation.frameProcedural("gizzi.mascot.alive", {
    state: state(),
    compact: compact(),
  }))
}
