/**
 * GIZZI Animation System - Registry
 * 
 * Central registry for animation specifications.
 * All animations must be registered before use.
 */

import type { AnimSpec } from "@/cli/ui/components/animation/types"

type SetupSceneFrameSpec = {
  badge: string
  beacon: string
  leftEye: string
  rightEye: string
  mouth: string
  core?: string
  leftHand?: string
  rightHand?: string
  stance?: string
}

type GridFirstMascotFrameSpec = {
  beacon: string
  eyes: string
  mouth: string
  legs?: string
}

function renderGridFirstMascotLines(frame: GridFirstMascotFrameSpec): string[] {
  const beacon = frame.beacon.length >= 2 ? frame.beacon.slice(0, 2) : frame.beacon.padEnd(2, " ")
  return [
    `      ${beacon}      `, // 0: Floating Beacon (14 wide)
    "   ▄▄▄  ▄▄▄   ", // 1: Antenna Blocks (14 wide)
    " ▄██████████▄ ", // 2: Head Top (14 wide)
    ` █${frame.eyes}█ `, // 3: Eye Panel - Eyes (1 + 1 + 10 + 1 + 1 = 14)
    ` █${frame.mouth}█ `, // 4: Eye Panel - Mark (1 + 1 + 10 + 1 + 1 = 14)
    "  ▀████████▀  ", // 5: Head Bottom (14 wide)
    "   █ █  █ █   ", // 6: 4 Legs (14 wide)
    "   ▀ ▀  ▀ ▀   ", // 7: Sub-pixel Feet (14 wide)
  ]
}

function renderGridFirstMascotFrame(frame: GridFirstMascotFrameSpec) {
  return renderGridFirstMascotLines(frame).join("\n")
}

function renderCompactMascotFrame(frame: { beacon: string; eyes: string; mouth: string }) {
  const b = frame.beacon.length >= 2 ? frame.beacon.slice(0, 2) : frame.beacon.padEnd(2, " ")
  const e = frame.eyes.length >= 2 ? frame.eyes.slice(0, 2) : frame.eyes.padEnd(2, " ")
  const m = frame.mouth.length >= 2 ? frame.mouth.slice(0, 2) : frame.mouth.padEnd(2, " ")
  return [
    `   ${b}   `,     // 8 wide
    " ▄▀▀█▀▀▄",     // 8 wide
    `█  ${e}  █`,     // 8 wide
    `█  ${m}  █`,     // 8 wide
    " ▀█▀▀█▀ ",     // 8 wide
  ].join("\n")
}

function fit(value: string, width: number) {
  return value.padEnd(width, " ").slice(0, width)
}

function renderSetupMascotFrame(frame: SetupSceneFrameSpec) {
  // Use a fixed width for the badge to ensure stable rendering
  const badgeWidth = 26
  const badge = frame.badge.padStart(Math.floor((badgeWidth + frame.badge.length) / 2), " ").padEnd(badgeWidth, " ")

  // Dynamic eyes from spec: leftEye and rightEye are combined into 10-char eyes string
  // Full line 3: " █" + "  L    R  " + "█ " (14 chars)
  const le = frame.leftEye.length >= 1 ? frame.leftEye[0] : "●"
  const re = frame.rightEye.length >= 1 ? frame.rightEye[0] : "●"
  const eyes = `  ${le}    ${re}  `

  // Dynamic mouth from spec: centered in 10-char mouth string
  // Full line 4: " █" + "  Mouth   " + "█ " (14 chars)
  const m = frame.mouth.slice(0, 10)
  const mouth = m.padStart(Math.floor((10 + m.length) / 2), " ").padEnd(10, " ")

  const lines = renderGridFirstMascotLines({
    beacon: frame.beacon,
    eyes,
    mouth,
  })

  // Padding to center the 14-char mascot under the 26-char badge:
  // (26 - 14) / 2 = 6 spaces.
  const mascotPadding = "      "

  return [badge, ...lines.map((line) => `${mascotPadding}${line}`)].join("\n")
}

function registerSetupScene(registry: AnimationRegistry, id: string, frames: SetupSceneFrameSpec[], intervalTicks = 2) {
  registry.register({
    id,
    frames: frames.map((frame) => renderSetupMascotFrame(frame)),
    intervalTicks,
    mode: "loop",
  })
}

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

/** Create registry with GIZZI default animations */
export function createGIZZIRegistry(): AnimationRegistry {
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

  // GIZZI Monolith - A shifting geometric stack (G-based)
  registry.register({
    id: "gizzi.monolith",
    frames: [
      "▖", "▗", "▝", "▘", // single corners
      "▞", "▚", // diagonals
      "▙", "▜", "▛", "▟", // three corners
      "■" // full block
    ],
    intervalTicks: 2,
    mode: "loop",
  })

  // GIZZI Schematic - Shifting technical markers
  registry.register({
    id: "gizzi.schematic",
    frames: ["┤", "┘", "┴", "└", "├", "┌", "┬", "┐"],
    intervalTicks: 2,
    mode: "loop",
  })

  // GIZZI Minolith - 1-character branded state
  registry.register({
    id: "gizzi.monolith.idle",
    frames: ["▗▄"],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.monolith.thinking",
    frames: ["▗▄", "▗▛", "▗▜", "▗▟"],
    intervalTicks: 4,
    mode: "loop",
  })

  // Official GIZZI Monolith Pulse - High fidelity assembly
  registry.register({
    id: "gizzi.monolith.pulse",
    frames: [
      "▗▄", 
      "▐▛", 
      "▐▌", 
      "▐▙", 
      "▐▙▄",
      "▝▀"
    ],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.monolith.executing",
    frames: ["▗▄", "▗▛▜", "▗▜▟", "▗▟▄"],
    intervalTicks: 3,
    mode: "loop",
  })

  // Runtime mascot scenes (chat companion)
  // These base animations are mostly single-frame because the 'Alive' driver 
  // implements its own staggered timing for blinking and looking around.
  registry.register({
    id: "gizzi.mascot.idle",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ●    ●  ", mouth: "  A : / / " }),
    ],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.blink",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  -    -  ", mouth: "  A : / / " }),
    ],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.look-left",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: " ●    ●   ", mouth: "  A : / / " }),
    ],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.look-right",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "   ●    ● ", mouth: "  A : / / " }),
    ],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.look-left",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "▀ ", mouth: "--" }),
    ],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.look-right",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: " ▀", mouth: "--" }),
    ],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.thinking",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ?    ?  ", mouth: "  A : / / " }),
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  -    -  ", mouth: "  A : / / " }),
    ],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.executing",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  !    !  ", mouth: "  A : --- " }),
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  !    !  ", mouth: "  A : / / " }),
    ],
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.responding",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ^    ^  ", mouth: "  A : ▭    " }),
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ^    ^  ", mouth: "  A : ▭▭   " }),
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ^    ^  ", mouth: "  A : ▭▭▭  " }),
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ^    ^  ", mouth: "  A : ▭▭   " }),
    ],
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.alert",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  !    !  ", mouth: "  A : ▭▭▭ " }),
    ],
    intervalTicks: 4,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.curious",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  o    O  ", mouth: "  A : / / " }),
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  O    o  ", mouth: "  A : / / " }),
    ],
    intervalTicks: 8,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.focused",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ◉    ◉  ", mouth: "  A : / / " }),
    ],
    intervalTicks: 6,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.steady",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ●    ●  ", mouth: "  A : / / " }),
    ],
    intervalTicks: 10,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.pleased",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ^    ^  ", mouth: "  A : ◡◡◡ " }),
    ],
    intervalTicks: 5,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.skeptical",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  O    o  ", mouth: "  A : --- " }),
    ],
    intervalTicks: 7,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.mischief",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  !    !  ", mouth: "  A : ﹏﹏ " }),
    ],
    intervalTicks: 4,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.proud",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ^    ^  ", mouth: "  A : / / " }),
    ],
    intervalTicks: 6,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.dizzy",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  X    X  ", mouth: "  A : / / " }),
      renderGridFirstMascotFrame({ beacon: "  ", eyes: "  X    X  ", mouth: "  A : / / " }),
    ],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.startled",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  !    !  ", mouth: "  A : ▭▭▭ " }),
    ],
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.locked-on",
    frames: [
      renderGridFirstMascotFrame({ beacon: "▄▄", eyes: "  ●    ●  ", mouth: "  A : / / " }),
    ],
    intervalTicks: 4,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.idle",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "▀▀", mouth: "--" }),
    ],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.blink",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "--", mouth: "--" }),
    ],
    intervalTicks: 1,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.thinking",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "??", mouth: "--" }),
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "--", mouth: "--" }),
    ],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.executing",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "!!", mouth: "▄▄" }),
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "!!", mouth: "▀▀" }),
    ],
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.responding",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "^^", mouth: "◡◡" }),
    ],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.alert",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "oO", mouth: "▭ " }),
    ],
    intervalTicks: 4,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.curious",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "oO", mouth: "--" }),
    ],
    intervalTicks: 8,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.focused",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "●●", mouth: "--" }),
    ],
    intervalTicks: 6,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.steady",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "◉◉", mouth: "--" }),
    ],
    intervalTicks: 10,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.pleased",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "^^", mouth: "▀▀" }),
    ],
    intervalTicks: 5,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.skeptical",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "--", mouth: "--" }),
    ],
    intervalTicks: 7,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.mischief",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "!!", mouth: "﹏ " }),
    ],
    intervalTicks: 4,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.proud",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "^^", mouth: "▄▄" }),
    ],
    intervalTicks: 6,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.dizzy",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "XX", mouth: "--" }),
    ],
    intervalTicks: 3,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.startled",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "!!", mouth: "▭ " }),
    ],
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.mascot.compact.locked-on",
    frames: [
      renderCompactMascotFrame({ beacon: "▄▄", eyes: "●●", mouth: "▀▀" }),
    ],
    intervalTicks: 4,
    mode: "loop",
  })

  // GIZZI Home Monolith - Subtly shimmering for the main screen (G-shape)
  registry.register({
    id: "gizzi.home.monolith",
    frames: [
      " ▗▄▄▄▄▄▄▖ \n ▐▛▀▀▀▀▀▘ \n ▐▌ ▗▄▄▄▖ \n ▐▌ ▐▙▄▟▌ \n ▐▙▄▄▄▄▟▌ \n  ▝▀▀▀▀▀▘ ",
      " ▗▄▄▄▄▄▄▖ \n ▐▓▀▀▀▀▀▘ \n ▐▓ ▗▄▄▄▖ \n ▐▓ ▐▓▄▟▌ \n ▐▓▄▄▄▄▟▌ \n  ▝▀▀▀▀▀▘ ",
      " ▗▄▄▄▄▄▄▖ \n ▐▒▀▀▀▀▀▘ \n ▐▒ ▗▄▄▄▖ \n ▐▒ ▐▒▄▟▌ \n ▐▒▄▄▄▄▟▌ \n  ▝▀▀▀▀▀▘ ",
      " ▗▄▄▄▄▄▄▖ \n ▐░▀▀▀▀▀▘ \n ▐░ ▗▄▄▄▖ \n ▐░ ▐░▄▟▌ \n ▐░▄▄▄▄▟▌ \n  ▝▀▀▀▀▀▘ ",
      " ▗▄▄▄▄▄▄▖ \n ▐▒▀▀▀▀▀▘ \n ▐▒ ▗▄▄▄▖ \n ▐▒ ▐▒▄▟▌ \n ▐▒▄▄▄▄▟▌ \n  ▝▀▀▀▀▀▘ ",
      " ▗▄▄▄▄▄▄▖ \n ▐▓▀▀▀▀▀▘ \n ▐▓ ▗▄▄▄▖ \n ▐▓ ▐▓▄▟▌ \n ▐▓▄▄▄▄▟▌ \n  ▝▀▀▀▀▀▘ "
    ],
    intervalTicks: 4,
    mode: "loop",
  })

  // Startup setup scenes for the onboarding wizard
  registerSetupScene(registry, "gizzi.setup.workspace", [
    { badge: "[ WORKSPACE TRUST ]", beacon: "●", leftEye: "▮", rightEye: "▮", mouth: ":||", stance: "__" },
    { badge: "[ WORKSPACE TRUST ]", beacon: "◉", leftEye: "▮", rightEye: "▮", mouth: ":__", leftHand: "/\\", rightHand: "\\/", stance: "__" },
    { badge: "[ PATH CHECK ••• ]", beacon: "●", leftEye: "▯", rightEye: "▮", mouth: ":|_", leftHand: "\\_", rightHand: "_/", stance: "--" },
    { badge: "[ PATH CHECK ••• ]", beacon: "◉", leftEye: "▮", rightEye: "▯", mouth: ":||", leftHand: "/\\", rightHand: "\\/", stance: "--" },
    { badge: "[ WORKSPACE TRUST ]", beacon: "●", leftEye: "▮", rightEye: "▮", mouth: ":__", stance: "__" },
    { badge: "[ WORKSPACE READY ]", beacon: "◆", leftEye: "▮", rightEye: "▮", mouth: ":)", stance: "__" },
  ])

  registerSetupScene(registry, "gizzi.setup.theme", [
    { badge: "[ THEME • SUN ]", beacon: "☼", leftEye: "◉", rightEye: "◔", mouth: ":/?", leftHand: "/\\", rightHand: "_/", stance: "__" },
    { badge: "[ THEME • MOON ]", beacon: "☾", leftEye: "◔", rightEye: "◉", mouth: ":__", leftHand: "\\_", rightHand: "\\/", stance: "__" },
    { badge: "[ THEME • SUN ]", beacon: "☼", leftEye: "◉", rightEye: "◉", mouth: ":)", leftHand: "/\\", rightHand: "_/", stance: "--" },
    { badge: "[ THEME • MOON ]", beacon: "☾", leftEye: "◉", rightEye: "◉", mouth: ":_)", leftHand: "\\_", rightHand: "\\/", stance: "__" },
    { badge: "[ THEME • SUN ]", beacon: "☼", leftEye: "◔", rightEye: "◉", mouth: ":/?", leftHand: "/\\", rightHand: "_/", stance: "--" },
    { badge: "[ APPEARANCE LOCK ]", beacon: "✦", leftEye: "◉", rightEye: "◉", mouth: ":)", stance: "__" },
  ])

  registerSetupScene(registry, "gizzi.setup.account", [
    { badge: "[ CLERK LOGIN ]", beacon: "▲", leftEye: "◉", rightEye: "◉", mouth: ":O!", leftHand: "/\\", rightHand: "\\/", stance: "__" },
    { badge: "[ BROWSER AUTH ]", beacon: "◆", leftEye: "◎", rightEye: "◎", mouth: "://", leftHand: "\\_", rightHand: "_/", stance: "__" },
    { badge: "[ CALLBACK WAIT ]", beacon: "▲", leftEye: "◉", rightEye: "◉", mouth: ":||", leftHand: "/\\", rightHand: "\\/", stance: "--" },
    { badge: "[ CALLBACK WAIT ]", beacon: "◆", leftEye: "◎", rightEye: "◎", mouth: "://", leftHand: "\\_", rightHand: "_/", stance: "--" },
    { badge: "[ CLAIM SESSION ]", beacon: "▲", leftEye: "◉", rightEye: "◉", mouth: ":__", leftHand: "/\\", rightHand: "\\/", stance: "__" },
    { badge: "[ ACCOUNT MOUNTED ]", beacon: "✓", leftEye: "◉", rightEye: "◉", mouth: ":)", stance: "__" },
  ])

  registerSetupScene(registry, "gizzi.setup.provider", [
    { badge: "[ PROVIDER LINK ]", beacon: "●", leftEye: "■", rightEye: "■", mouth: ":__", leftHand: "\\_", rightHand: "_/", stance: "__" },
    { badge: "[ TOKEN CHECK ]", beacon: "○", leftEye: "□", rightEye: "■", mouth: ":|_", leftHand: "/\\", rightHand: "\\/", stance: "__" },
    { badge: "[ TOKEN CHECK ]", beacon: "●", leftEye: "■", rightEye: "□", mouth: ":||", leftHand: "\\_", rightHand: "_/", stance: "--" },
    { badge: "[ PROVIDER LINK ]", beacon: "○", leftEye: "■", rightEye: "■", mouth: "://", leftHand: "/\\", rightHand: "\\/", stance: "--" },
    { badge: "[ ROUTE ONLINE ]", beacon: "●", leftEye: "■", rightEye: "■", mouth: ":__", leftHand: "\\_", rightHand: "_/", stance: "__" },
    { badge: "[ PROVIDER READY ]", beacon: "✓", leftEye: "■", rightEye: "■", mouth: ":)", stance: "__" },
  ])

  registerSetupScene(registry, "gizzi.setup.terminal", [
    { badge: "[ TERMINAL TUNE ]", beacon: "⌘", leftEye: "▣", rightEye: "▣", mouth: ":__", leftHand: "\\_", rightHand: "_/", stance: "__" },
    { badge: "[ SHELL PROFILE ]", beacon: "⌥", leftEye: "▤", rightEye: "▣", mouth: ":_:", leftHand: "/\\", rightHand: "\\/", stance: "__" },
    { badge: "[ SHELL PROFILE ]", beacon: "⌘", leftEye: "▣", rightEye: "▤", mouth: ":__", leftHand: "\\_", rightHand: "_/", stance: "--" },
    { badge: "[ MOTION CHECK ]", beacon: "⌥", leftEye: "▣", rightEye: "▣", mouth: ":|_", leftHand: "/\\", rightHand: "\\/", stance: "--" },
    { badge: "[ TERMINAL TUNE ]", beacon: "⌘", leftEye: "▣", rightEye: "▣", mouth: ":__", leftHand: "\\_", rightHand: "_/", stance: "__" },
    { badge: "[ TERMINAL READY ]", beacon: "✓", leftEye: "▣", rightEye: "▣", mouth: ":)", stance: "__" },
  ])

  registerSetupScene(registry, "gizzi.setup.mcp", [
    { badge: "[ MCP HANDSHAKE ]", beacon: "◈", leftEye: "◆", rightEye: "◆", mouth: "://", leftHand: "/\\", rightHand: "\\/", stance: "__" },
    { badge: "[ MCP ROUTES ]", beacon: "◇", leftEye: "◈", rightEye: "◆", mouth: ":||", leftHand: "\\_", rightHand: "_/", stance: "--" },
    { badge: "[ MCP ROUTES ]", beacon: "◈", leftEye: "◆", rightEye: "◈", mouth: "://", leftHand: "/\\", rightHand: "\\/", stance: "--" },
    { badge: "[ ADAPTER CHECK ]", beacon: "◇", leftEye: "◆", rightEye: "◆", mouth: ":__", leftHand: "\\_", rightHand: "_/", stance: "__" },
    { badge: "[ ADAPTER CHECK ]", beacon: "◈", leftEye: "◆", rightEye: "◆", mouth: "://", leftHand: "/\\", rightHand: "\\/", stance: "--" },
    { badge: "[ MCP READY ]", beacon: "✓", leftEye: "◆", rightEye: "◆", mouth: ":)", stance: "__" },
  ])

  registerSetupScene(registry, "gizzi.setup.ready", [
    { badge: "[ READY TO CODE ]", beacon: "★", leftEye: "^", rightEye: "^", mouth: ":D", leftHand: "/\\", rightHand: "\\/", stance: "__" },
    { badge: "[ SESSION GATE ]", beacon: "✓", leftEye: "◉", rightEye: "◉", mouth: ":)", leftHand: "\\_", rightHand: "_/", stance: "__" },
    { badge: "[ READY TO CODE ]", beacon: "★", leftEye: "^", rightEye: "^", mouth: ":D", leftHand: "/\\", rightHand: "\\/", stance: "--" },
    { badge: "[ SESSION GATE ]", beacon: "✓", leftEye: "◉", rightEye: "◉", mouth: ":)", leftHand: "\\_", rightHand: "_/", stance: "--" },
    { badge: "[ FINAL CHECK ]", beacon: "★", leftEye: "^", rightEye: "^", mouth: ":_)", leftHand: "/\\", rightHand: "\\/", stance: "__" },
    { badge: "[ OPEN SESSION ]", beacon: "✓", leftEye: "^", rightEye: "^", mouth: ":D", stance: "__" },
  ])

  // GIZZI Thinking Shimmer - Block shade wave for reasoning blocks
  registry.register({
    id: "gizzi.thinking.shimmer",
    frames: [
      "░░▒▓██▓▒░░",
      "░▒▓██▓▒░░░",
      "▒▓██▓▒░░░░",
      "▓██▓▒░░░░▒",
      "██▓▒░░░░▒▓",
      "█▓▒░░░░▒▓█",
      "▓▒░░░░▒▓██",
      "▒░░░░▒▓██▓",
      "░░░░▒▓██▓▒",
      "░░░▒▓██▓▒░",
    ],
    intervalTicks: 2,
    mode: "loop",
  })

  // GIZZI Thinking Label Pulse - Cycles through label variations
  registry.register({
    id: "gizzi.thinking.label",
    frames: [
      "Thinking",
      "Thinking .",
      "Thinking ..",
      "Thinking ...",
      "Thinking ..",
      "Thinking .",
    ],
    intervalTicks: 4,
    mode: "loop",
  })

  // GIZZI Signature Loaders
  // Orbital Harness - 12 segment ring
  registry.register({
    id: "gizzi.orbit_harness.connecting",
    frames: Array.from({ length: 12 }, (_, i) => {
      const segments = Array(12).fill(".")
      segments[i] = "o"
      return segments.join("")
    }),
    intervalTicks: 2,
    mode: "loop",
  })

  registry.register({
    id: "gizzi.orbit_harness.executing",
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
    id: "gizzi.orbit_harness.completed",
    frames: ["[complete]"],
    intervalTicks: 1,
    mode: "once",
  })

  // Rails Scan
  registry.register({
    id: "gizzi.rails_scan",
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
