/**
 * GIZZI Animation System - Types
 * 
 * Deterministic, tick-driven animations for TUI components.
 * No per-component timers - all animations derive from a single tick source.
 */

/** Animation playback mode */
export type AnimMode = "loop" | "pingpong" | "once"

/** Animation specification */
export type AnimSpec = {
  /** Unique identifier for the animation */
  id: string
  /** Array of frame strings */
  frames: string[]
  /** Advance frame every N ticks */
  intervalTicks: number
  /** Playback mode */
  mode: AnimMode
}

/** Runtime inputs for procedural animations */
export type AnimInputs = {
  /** Runtime phase (e.g., "executing", "planning") */
  phase?: string
  /** Severity level affecting animation intensity */
  severity?: "low" | "med" | "high"
  /** Seed for deterministic pseudo-random generation */
  seed?: string
  /** Number of active items (for DAG pulse, etc.) */
  activeCount?: number
  /** Event markers for rails scan */
  events?: Array<{ type: string; position?: number }>
  /** Generic extensible properties */
  [key: string]: any
}

/** Animation metric for observability */
export type AnimationMetric = {
  type: "frame_render" | "phase_change" | "tick_rate" | "animation_disabled"
  animId: string
  tick: bigint
  frameIndex?: number
  inputs?: Record<string, any>
  timestamp: number
  cellsWritten: number
}

/** Driver configuration */
export type AnimationDriverConfig = {
  /** Get current tick counter */
  getTick: () => bigint
  /** Check if animations are enabled globally */
  animationsEnabled: () => boolean
  /** Optional metric callback for observability */
  onMetric?: (metric: AnimationMetric) => void
}

/** GIZZI runtime states that map to animations */
export type GIZZIRuntimeState =
  | "idle"
  | "connecting"
  | "hydrating"
  | "planning"
  | "web"
  | "executing"
  | "responding"
  | "compacting"
