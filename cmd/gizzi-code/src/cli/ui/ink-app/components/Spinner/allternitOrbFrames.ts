/**
 * AllternitOrb for the terminal — the brand's agent-activity mark, sized for
 * the one-row spinner line.
 *
 * Web/desktop source of truth: Allternit Assets/Brand/Allternit/thinking-orb/.
 * The A-block mark is square blocks around a coral core, so the terminal
 * version is drawn in quadrant block characters, not braille dots:
 *
 *     ▞▪▚   left stroke of the A · coral core · right stroke
 *
 * Each side cell is a 2×2 grid of quadrant blocks; the core is its own cell
 * (▪ at rest, ■ on a beat, ◆ when it turns). The choreographies follow the
 * web states:
 *
 *   thinking  – breathe: the strokes open out to pillars while the core turns
 *               to a diamond, pull in past home, then settle
 *   searching – radar: a two-block sweep circles the core
 *   working   – gears: both strokes spin like meshed gears around the core
 *   writing   – the A is drawn block by block in stroke order, holds, then
 *               clears in the same order; the core beats
 *   idle      – the static mark
 */

export type AllternitOrbState = 'thinking' | 'searching' | 'working' | 'writing' | 'idle'

export type OrbFrame = { left: string; core: string; right: string }

// Quadrant bits within one cell.
const TL = 1, TR = 2, BL = 4, BR = 8
const QUADRANT = [' ', '▘', '▝', '▀', '▖', '▌', '▞', '▛', '▗', '▚', '▐', '▜', '▄', '▙', '▟', '█'] as const

const CORE = { rest: '▪', beat: '■', turn: '◆' } as const

const f = (left: number, core: string, right: number): OrbFrame => ({
  left: QUADRANT[left]!,
  core,
  right: QUADRANT[right]!,
})
const repeat = (frame: OrbFrame, n: number): OrbFrame[] => Array.from({ length: n }, () => frame)

// Rest: the two strokes of the A leaning into the core.
const LEFT = TR | BL // ▞
const RIGHT = TL | BR // ▚
export const ORB_IDLE = f(LEFT, CORE.rest, RIGHT)

// Clockwise ring of quadrants around the core, from 12 o'clock: [cell, bit].
const RING: ReadonlyArray<readonly ['L' | 'R', number]> = [
  ['L', TR], ['R', TL], ['R', TR], ['R', BR], ['R', BL], ['L', BR], ['L', BL], ['L', TL],
]
function sweep(i: number): OrbFrame {
  let left = 0, right = 0
  for (const k of [0, 1]) {
    const [side, bit] = RING[(i - k + RING.length) % RING.length]!
    if (side === 'L') left |= bit
    else right |= bit
  }
  return f(left, i % 4 < 2 ? CORE.rest : CORE.turn, right)
}

// A line spinning in a 2×2 cell: / — \ |. The right side mirrors the left,
// so the two strokes turn like meshed gears.
const SPIN_LEFT = [TR | BL, BL | BR, TL | BR, TR | BR]
const SPIN_RIGHT = [TL | BR, BL | BR, TR | BL, TL | BL]

export const ORB_FRAMES: Record<AllternitOrbState, { stepMs: number; frames: OrbFrame[] }> = {
  thinking: {
    stepMs: 200,
    frames: [
      ...repeat(ORB_IDLE, 4),
      f(TL | BL, CORE.beat, TR | BR), // open out to pillars
      ...repeat(f(TL | BL, CORE.turn, TR | BR), 2),
      ...repeat(f(TR | BR, CORE.rest, TL | BL), 2), // pull in past home
      f(BR, CORE.rest, BL),
      ...repeat(ORB_IDLE, 2),
    ],
  },
  searching: {
    stepMs: 140,
    frames: RING.map((_, i) => sweep(i)),
  },
  working: {
    stepMs: 130,
    frames: SPIN_LEFT.map((left, i) => f(left, i % 2 ? CORE.turn : CORE.rest, SPIN_RIGHT[i]!)),
  },
  writing: {
    stepMs: 140,
    frames: [
      f(0, CORE.rest, 0),
      f(BL, CORE.beat, 0),
      f(LEFT, CORE.rest, 0),
      f(LEFT, CORE.beat, TL),
      f(LEFT, CORE.rest, RIGHT),
      ...repeat(ORB_IDLE, 5),
      f(TR, CORE.beat, RIGHT),
      f(0, CORE.rest, RIGHT),
      f(0, CORE.beat, BR),
      ...repeat(f(0, CORE.rest, 0), 3),
    ],
  },
  idle: { stepMs: 1000, frames: [ORB_IDLE] },
}

export function orbFrameAt(state: AllternitOrbState, timeMs: number): OrbFrame {
  const { stepMs, frames } = ORB_FRAMES[state]
  return frames[Math.floor(timeMs / stepMs) % frames.length]!
}

/** Spinner stream mode → orb state. Tool-name refinement: {@link orbStateForTool}. */
export function orbStateForMode(mode: string | undefined): AllternitOrbState {
  switch (mode) {
    case 'responding':
    case 'tool-input':
      return 'writing'
    case 'tool-use':
      return 'working'
    default:
      return 'thinking'
  }
}

/** Same mapping as the web `orbStateForTool()`. */
export function orbStateForTool(toolName: string | undefined): AllternitOrbState {
  const name = (toolName ?? '').toLowerCase().replace(/[_\-\s]/g, '')
  if (/search|grep|glob|find|fetch|browse|lookup/.test(name)) return 'searching'
  if (/write|edit|create|replace|notebook/.test(name)) return 'writing'
  return 'working'
}
