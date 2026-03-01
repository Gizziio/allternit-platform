/**
 * A2R Animation System - Driver
 * 
 * Core engine that computes animation frames based on a single tick source.
 * No timers, no Date.now - pure functions of (tick, spec).
 */

import type { AnimSpec, AnimMode, AnimationDriverConfig, AnimationMetric } from "./types"
import { AnimationRegistry } from "./registry"

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
   * 
   * @param id - Animation ID from registry
   * @returns Frame string for current tick
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
   * Get frame with procedural generation for A2R signature loaders.
   * Supports complex animations like DAG pulse with runtime inputs.
   * 
   * @param id - Base animation ID
   * @param inputs - Runtime inputs for procedural generation
   * @returns Frame string
   */
  frameProcedural(id: string, inputs: {
    phase?: string
    severity?: "low" | "med" | "high"
    seed?: string
    activeCount?: number
    events?: Array<{ type: string }>
  } = {}): string {
    // Delegate to specific procedural generators
    if (id === "a2r.orbit_harness") {
      return this.orbitHarnessFrame(inputs)
    }
    if (id === "a2r.rails_scan") {
      return this.railsScanFrame(inputs)
    }
    if (id === "a2r.dag_pulse") {
      return this.dagPulseFrame(inputs)
    }

    // Fall back to standard frame lookup
    return this.frame(id)
  }

  /**
   * Map A2R runtime state to animation ID.
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
        // 0..n-1..1.. repeat
        // e.g., 4 frames: 0,1,2,3,2,1,0,1,2,3...
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
  // PRIVATE: Procedural generators (A2R Signature Loaders)
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

    // Severity drives tail length
    const tailLen = {
      low: 1,
      med: 3,
      high: 5,
    }[inputs.severity || "med"]

    // Phase drives intensity glyphs
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

    // Event markers from bounded window (last 8 events)
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
    // Simplified: show a small tree structure with pulse
    const tick = this.config.getTick()
    const pulsePos = Number(tick / 2n) % 5

    // Fixed micro-DAG:  ●─●╲●
    //                    ╲●
    const positions = ["●", "─", "●", "╲", "●"]
    const active = positions.map((c, i) => i === pulsePos ? "◎" : c)

    return active.join("")
  }

  // ==============================================================================
  // PRIVATE: Utilities
  // ==============================================================================

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

  // ==============================================================================
  // PRIVATE: Metrics
  // ==============================================================================

  private emitMetric(animId: string, tick: bigint, frameIndex: number, cellsWritten: number): void {
    if (!this.config.onMetric) return

    // Throttle metrics
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

/** Create driver with A2R defaults */
export function createA2RDriver(
  config: AnimationDriverConfig
): AnimationDriver {
  const registry = new AnimationRegistry()
  return new AnimationDriver(registry, config)
}
