/**
 * A2R Animation System - Registry
 * 
 * Central registry for animation specifications.
 * All animations must be registered before use.
 */

import type { AnimSpec } from "./types"

export class AnimationRegistry {
  private specs = new Map<string, AnimSpec>()

  /**
   * Register an animation specification.
   * @throws If spec is invalid or ID already exists
   */
  register(spec: AnimSpec): void {
    if (!spec.id) {
      throw new Error("Animation spec must have an id")
    }
    if (!spec.frames.length) {
      throw new Error(`Animation ${spec.id} has no frames`)
    }
    if (spec.intervalTicks <= 0) {
      throw new Error(`Animation ${spec.id} intervalTicks must be > 0`)
    }
    if (this.specs.has(spec.id)) {
      throw new Error(`Animation ${spec.id} is already registered`)
    }
    this.specs.set(spec.id, spec)
  }

  /**
   * Get an animation specification by ID.
   * @throws If animation not found
   */
  get(id: string): AnimSpec {
    const spec = this.specs.get(id)
    if (!spec) {
      throw new Error(`Unknown animation id: ${id}`)
    }
    return spec
  }

  /** Check if animation is registered */
  has(id: string): boolean {
    return this.specs.has(id)
  }

  /** Unregister an animation */
  unregister(id: string): boolean {
    return this.specs.delete(id)
  }

  /** List all registered animation IDs */
  list(): string[] {
    return Array.from(this.specs.keys())
  }

  /** Get count of registered animations */
  count(): number {
    return this.specs.size
  }

  /** Clear all registrations */
  clear(): void {
    this.specs.clear()
  }
}

/** Create registry with A2R default animations */
export function createA2RRegistry(): AnimationRegistry {
  const registry = new AnimationRegistry()

  // Status bar pulse animations
  registry.register({
    id: "status.connecting",
    frames: ["<....>", "<=...>", "<==..>", "<===.>", "<====>", "<.===>", "<..==>", "<...=>"],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "status.planning",
    frames: ["<^...>", "<.^..>", "<..^.>", "<...^>", "<..^.>", "<.^..>"],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "status.web",
    frames: ["<@...>", "<.@..>", "<..@.>", "<...@>"],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "status.executing",
    frames: ["<*...>", "<.*..>", "<..*.>", "<...*>"],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "status.responding",
    frames: ["<...~>", "<..~~>", "<.~~~>", "<~~~~>", "<~~~.>", "<~~..>", "<~...>"],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "status.compacting",
    frames: ["<....>", "<#...>", "<##..>", "<###.>", "<####>", "<.###>", "<..##>", "<...#>"],
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "status.idle",
    frames: [">"],
    intervalTicks: 1,
    mode: "loop",
  })

  // Spinner animations
  registry.register({
    id: "spinner.braille",
    frames: ["|", "/", "-", "\\", "|", "/", "-", "\\"],
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "spinner.quadrant",
    frames: ["|", "/", "-", "\\"],
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "spinner.dots",
    frames: [".", "..", "...", "...."],
    intervalTicks: 3,
    mode: "loop",
  })

  // A2Rchitech Monolith - A shifting geometric stack
  registry.register({
    id: "a2r.monolith",
    frames: [
      "▖", "▗", "▝", "▘", // single corners
      "▞", "▚", // diagonals
      "▙", "▜", "▛", "▟", // three corners
      "■" // full block
    ],
    intervalTicks: 2,
    mode: "loop",
  })

  // A2Rchitech Schematic - Shifting technical markers
  registry.register({
    id: "a2r.schematic",
    frames: ["┤", "┘", "┴", "└", "├", "┌", "┬", "┐"],
    intervalTicks: 2,
    mode: "loop",
  })

  // A2Rchitech Minolith - 1-character branded state
  registry.register({
    id: "a2r.monolith.idle",
    frames: ["⣠⣄"],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "a2r.monolith.thinking",
    frames: ["⣠⣄", "⣻⢿", "⣿⣿", "⣻⢿"],
    intervalTicks: 4,
    mode: "loop",
  })

  // Official A2Rchitech Monolith Pulse - High fidelity assembly
  registry.register({
    id: "a2r.monolith.pulse",
    frames: [
      "⠁⠈", // Peak
      "⢠⡄", // Slants
      "⢬⡫", // Crossbar
      "⣻⢿", // Full A-Monolith
      "⢬⡫",
      "⢠⡄",
      "⠁⠈"
    ],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "a2r.monolith.executing",
    frames: ["⣠ ", "⣠⣄", " ⣄", "⣠⣄"],
    intervalTicks: 3,
    mode: "loop",
  })

  // A2Rchitech Home Monolith - Subtly shimmering for the main screen
  registry.register({
    id: "a2r.home.monolith",
    frames: [
      "     ▄     \n    ▟█▙    \n   ▟█ █▙   \n  ▟█████▙  \n ▟█     █▙ ",
      "     ▄     \n    ▟█▙    \n   ▟█ █▙   \n  ▟▓▓▓▓▓▙  \n ▟█     █▙ ",
      "     ▄     \n    ▟█▙    \n   ▟█ █▙   \n  ▟▒▒▒▒▒▙  \n ▟█     █▙ ",
      "     ▄     \n    ▟█▙    \n   ▟█ █▙   \n  ▟░░░░░▙  \n ▟█     █▙ ",
      "     ▄     \n    ▟█▙    \n   ▟█ █▙   \n  ▟▒▒▒▒▒▙  \n ▟█     █▙ ",
      "     ▄     \n    ▟█▙    \n   ▟█ █▙   \n  ▟▓▓▓▓▓▙  \n ▟█     █▙ "
    ],
    intervalTicks: 4,
    mode: "loop",
  })

  // A2R Signature Loaders
  // Orbital Harness - 12 segment ring
  registry.register({
    id: "a2r.orbit_harness.connecting",
    frames: Array.from({ length: 12 }, (_, i) => {
      const segments = Array(12).fill(".")
      segments[i] = "o"
      return segments.join("")
    }),
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "a2r.orbit_harness.executing",
    frames: Array.from({ length: 12 }, (_, i) => {
      const segments = Array(12).fill(".")
      segments[i] = "o"
      segments[(i + 1) % 12] = "O"
      segments[(i + 2) % 12] = "o"
      return segments.join("")
    }),
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "a2r.orbit_harness.completed",
    frames: ["[complete]"],
    intervalTicks: 1,
    mode: "once",
  })

  // Rails Scan
  registry.register({
    id: "a2r.rails_scan",
    frames: Array.from({ length: 12 }, (_, i) => {
      const rail = Array(12).fill("=")
      rail[i] = "*"
      return "[" + rail.join("") + "]"
    }),
    intervalTicks: 2,
    mode: "pingpong",
  })

  // Progress animations
  registry.register({
    id: "progress.braille",
    frames: [".", ":", "-", "=", "-", ":", "."],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "progress.blocks",
    frames: [".", ":", "-", "=", "#", "##", "###", "####"],
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "progress.growing",
    frames: [
      "..........",
      "#.........",
      "##........",
      "###.......",
      "####......",
      "#####.....",
      "######....",
      "#######...",
      "########..",
      "#########.",
      "##########",
    ],
    intervalTicks: 3,
    mode: "loop",
  })

  return registry
}
