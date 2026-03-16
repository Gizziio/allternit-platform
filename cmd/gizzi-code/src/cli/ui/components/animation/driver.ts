/**
 * GIZZI Animation System - Driver
 * 
 * Core engine that computes animation frames based on a single tick source.
 * No timers, no Date.now - pure functions of (tick, spec).
 */

import type { AnimSpec, AnimMode, AnimationDriverConfig, AnimationMetric } from "@/cli/ui/components/animation/types"
import { AnimationRegistry } from "@/cli/ui/components/animation/registry"

export class AnimationDriver {
  private lastMetricsTick = 0n
  private metricsThrottle = 10n // Emit metric every N ticks

  constructor(
    private registry: AnimationRegistry,
    private config: AnimationDriverConfig
  ) {}

  /**
   * Get the current frame for an animation.
   * Pure function: same tick + id = same frame.
   */
  frame(id: string): string {
    const spec = this.registry.get(id)

    // If animations disabled, return static first frame
    if (!this.config.animationsEnabled()) {
      this.emitDisabledMetric(id)
      return spec.frames[0]
    }

    const tick = this.config.getTick()
    const step = Number(tick / BigInt(spec.intervalTicks))
    const frameIndex = this.computeFrameIndex(spec.frames.length, step, spec.mode)
    const frame = spec.frames[frameIndex]

    // Emit observability metric (throttled)
    this.emitMetric(id, tick, frameIndex, frame.length)

    return frame
  }

  /**
   * Get frame with procedural generation for GIZZI signature loaders.
   */
  frameProcedural(id: string, inputs: {
    phase?: string
    severity?: "low" | "med" | "high"
    seed?: string
    activeCount?: number
    events?: Array<{ type: string }>
    compact?: boolean
    state?: string
  } = {}): string {
    // Alive Mascot Logic (Staggered blinking, subtle idle motion)
    if (id === "gizzi.mascot.alive") {
      return this.aliveMascotFrame(inputs)
    }

    // Delegate to specific procedural generators
    if (id === "gizzi.orbit_harness") {
      return this.orbitHarnessFrame(inputs)
    }
    if (id === "gizzi.rails_scan") {
      return this.railsScanFrame(inputs)
    }
    if (id === "gizzi.dag_pulse") {
      return this.dagPulseFrame(inputs)
    }

    // Fall back to standard frame lookup
    return this.frame(id)
  }

  /**
   * Alive Mascot - Staggered blinking, gaze shifting, and horizontal wandering.
   */
  private aliveMascotFrame(inputs: { compact?: boolean; state?: string }): string {
    const tick = this.config.getTick()
    const isCompact = !!inputs.compact
    const state = inputs.state || "idle"

    const animBase = isCompact ? "gizzi.mascot.compact" : "gizzi.mascot"

    // 1. Horizontal Wandering Logic (The "Pacing" Engine)
    // We use a 600-tick master cycle (~30 seconds)
    const wanderCycle = tick % 600n
    let offsetX = 0
    let isWalking = false

    if (!isCompact) {
      if (wanderCycle < 100n) {
        // State: Stay at origin (0-5s)
        offsetX = 0
      } else if (wanderCycle < 200n) {
        // State: Walk Right (5-10s) - move from 0 to 12
        offsetX = Math.floor(Number(wanderCycle - 100n) / 8) 
        isWalking = true
      } else if (wanderCycle < 400n) {
        // State: Stay at Right (10-20s)
        offsetX = 12
      } else if (wanderCycle < 500n) {
        // State: Walk Left (20-25s) - move from 12 back to 0
        offsetX = 12 - Math.floor(Number(wanderCycle - 400n) / 8)
        isWalking = true
      } else {
        // State: Stay at origin (25-30s)
        offsetX = 0
      }
    }

    // 2. Expression Selection
    let selectedFrame: string

    // Blinking (Natural rhythm - ~1 blink per 8-12 seconds, none when focused)
    const canBlink = state === "idle" || state === "steady" || state === "pleased" || state === "proud" || state === "curious"
    const blinkBucket = tick / 120n  // 6-second windows at 20fps
    const blinkHash = Number((blinkBucket * 11n + 7n) % 9n)  // 2 of 9 windows blink
    const tickInBucket = tick % 120n

    // Choose the base animation
    if (canBlink && blinkHash === 0 && tickInBucket < 2n) {
      selectedFrame = this.frame(`${animBase}.blink`)
    } else if (canBlink && blinkHash === 4 && (tickInBucket < 2n || (tickInBucket > 8n && tickInBucket < 10n))) {
      selectedFrame = this.frame(`${animBase}.blink`)
    } else if (isWalking) {
      selectedFrame = this.frame(`${animBase}.walking`)
    } else {
      // Gaze Shifting
      const gazeBucket = tick / 240n
      const gazeHash = Number((gazeBucket * 11n + 3n) % 8n)
      const tickInGaze = tick % 240n
      const canShiftGaze = state === "idle" || state === "steady" || state === "curious" || state === "pleased"

      if (canShiftGaze && gazeHash === 1 && tickInGaze < 40n) {
        selectedFrame = this.frame(`${animBase}.look-left`)
      } else if (canShiftGaze && gazeHash === 2 && tickInGaze < 40n) {
        selectedFrame = this.frame(`${animBase}.look-right`)
      } else {
        selectedFrame = this.frame(`${animBase}.${state}`)
      }
    }

    // 3. Apply Physical Translation (prepended spaces)
    if (offsetX > 0) {
      const padding = " ".repeat(offsetX)
      return selectedFrame
        .split("\n")
        .map(line => padding + line)
        .join("\n")
    }

    return selectedFrame
  }

  /**
   * Map runtime state to animation ID.
   */
  stateToAnimationId(state: string): string {
    const mapping: Record<string, string> = {
      idle: "status.idle",
      connecting: "status.connecting",
      hydrating: "status.connecting",
      planning: "status.planning",
      web: "status.web",
      executing: "status.executing",
      responding: "status.responding",
      compacting: "status.compacting",
    }
    return mapping[state] || "status.idle"
  }

  /**
   * Get current tick from driver config.
   */
  currentTick(): bigint {
    return this.config.getTick()
  }

  /**
   * Check if animations are enabled.
   */
  isEnabled(): boolean {
    return this.config.animationsEnabled()
  }

  // ==============================================================================
  // PRIVATE: Frame computation
  // ==============================================================================

  private computeFrameIndex(length: number, step: number, mode: AnimMode): number {
    if (length === 1) return 0

    switch (mode) {
      case "loop":
        return step % length

      case "once":
        return Math.min(step, length - 1)

      case "pingpong": {
        const period = length * 2 - 2
        if (period <= 0) return 0
        const k = step % period
        return k < length ? k : period - k
      }

      default:
        return 0
    }
  }

  // ==============================================================================
  // PRIVATE: Procedural generators (GIZZI Signature Loaders)
  // ==============================================================================

  /**
   * Orbital Harness - 12 segment ring with variable intensity.
   */
  private orbitHarnessFrame(inputs: {
    phase?: string
    severity?: "low" | "med" | "high"
  }): string {
    const SEGMENTS = 12
    const tick = this.config.getTick()
    const interval = inputs.phase === "executing" ? 1n : 2n
    const head = Number(tick / interval) % SEGMENTS

    const tailLen = {
      low: 1,
      med: 3,
      high: 5,
    }[inputs.severity || "med"]

    const glyphs = inputs.phase === "executing"
      ? ["◓", "◒", "◑"]
      : inputs.phase === "completed"
        ? ["◉"]
        : ["◐", "◑"]

    let result = ""
    for (let i = 0; i < SEGMENTS; i++) {
      const dist = (i - head + SEGMENTS) % SEGMENTS
      if (dist === 0) {
        result += glyphs[0] // Head
      } else if (dist < tailLen) {
        result += glyphs[Math.min(dist, glyphs.length - 1)]
      } else {
        result += "·"
      }
    }

    return result
  }

  /**
   * Rails Scan - Horizontal rail with moving scanner and event markers.
   */
  private railsScanFrame(inputs: {
    events?: Array<{ type: string }>
  }): string {
    const WIDTH = 12
    const tick = this.config.getTick()
    const scanPos = this.pingPong(Number(tick / 2n), WIDTH)

    const events = (inputs.events || []).slice(-8)
    const markers = events.map((e, i) => ({
      pos: Math.floor((i / Math.max(events.length, 1)) * WIDTH),
      symbol: this.eventTypeToSymbol(e.type),
    }))

    let rail = "╞"
    for (let i = 0; i < WIDTH; i++) {
      if (i === scanPos) {
        rail += "●"
      } else {
        const marker = markers.find(m => m.pos === i)
        rail += marker ? marker.symbol : "═"
      }
    }
    rail += "╡"

    return rail
  }

  /**
   * DAG Pulse - Micro DAG with traveling pulse (simplified version).
   */
  private dagPulseFrame(inputs: {
    seed?: string
    activeCount?: number
  }): string {
    const tick = this.config.getTick()
    const pulsePos = Number(tick / 2n) % 5
    const positions = ["●", "─", "●", "╲", "●"]
    const active = positions.map((c, i) => i === pulsePos ? "◎" : c)
    return active.join("")
  }

  private pingPong(step: number, max: number): number {
    if (max <= 1) return 0
    const period = max * 2 - 2
    const k = step % period
    return k < max ? k : period - k
  }

  private eventTypeToSymbol(type: string): string {
    const map: Record<string, string> = {
      tool_call: "◎",
      tool_result: "◉",
      receipt: "◈",
      error: "✕",
      warning: "◌",
    }
    return map[type] || "·"
  }

  private emitMetric(animId: string, tick: bigint, frameIndex: number, cellsWritten: number): void {
    if (!this.config.onMetric) return
    if (tick - this.lastMetricsTick < this.metricsThrottle) return
    this.lastMetricsTick = tick

    this.config.onMetric({
      type: "frame_render",
      animId,
      tick,
      frameIndex,
      timestamp: Date.now(),
      cellsWritten,
    })
  }

  private emitDisabledMetric(animId: string): void {
    if (!this.config.onMetric) return
    this.config.onMetric({
      type: "animation_disabled",
      animId,
      tick: this.config.getTick(),
      timestamp: Date.now(),
      cellsWritten: 0,
    })
  }
}

/** Create driver with GIZZI defaults */
export function createGIZZIDriver(
  config: AnimationDriverConfig
): AnimationDriver {
  const registry = new AnimationRegistry()
  return new AnimationDriver(registry, config)
}
