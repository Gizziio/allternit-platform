// @ts-nocheck
import { describe, expect, test } from "bun:test"

// ─── Inline copies of pure logic (self-contained — no runtime imports) ───────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const

function getSpinnerFrame(tick: number): string {
  return SPINNER_FRAMES[tick % SPINNER_FRAMES.length]
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

type AgentStatus = "working" | "thinking" | "completed" | "error" | "idle"

function statusToIcon(status: AgentStatus): string {
  switch (status) {
    case "working":
    case "thinking":
      return "spinner"
    case "completed":
      return "✓"
    case "error":
      return "✗"
    case "idle":
      return "○"
    default:
      return "○"
  }
}

function treeConnector(isLast: boolean, depth: number): string {
  if (depth === 0) return isLast ? "└─ " : "├─ "
  const indent = "│  ".repeat(depth - 1) + (isLast ? "   " : "│  ")
  return indent + (isLast ? "└─ " : "├─ ")
}

function treeContinuation(isLast: boolean, depth: number): string {
  if (depth === 0) return isLast ? "   " : "│  "
  const indent = "│  ".repeat(depth - 1) + (isLast ? "   " : "│  ")
  return indent + (isLast ? "   " : "│  ")
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("swarm-live-visualizer: spinner frame cycling", () => {
  test("returns the correct frame for each tick index", () => {
    expect(getSpinnerFrame(0)).toBe("⠋")
    expect(getSpinnerFrame(1)).toBe("⠙")
    expect(getSpinnerFrame(5)).toBe("⠴")
    expect(getSpinnerFrame(9)).toBe("⠏")
  })

  test("wraps around after all 10 frames", () => {
    expect(getSpinnerFrame(10)).toBe("⠋")
    expect(getSpinnerFrame(11)).toBe("⠙")
    expect(getSpinnerFrame(20)).toBe("⠋")
  })

  test("handles large tick values", () => {
    expect(getSpinnerFrame(1003)).toBe(SPINNER_FRAMES[1003 % 10])
    expect(getSpinnerFrame(999999)).toBe(SPINNER_FRAMES[999999 % 10])
  })

  test("produces all 10 unique frames in one full cycle", () => {
    const frames = Array.from({ length: 10 }, (_, i) => getSpinnerFrame(i))
    const unique = new Set(frames)
    expect(unique.size).toBe(10)
  })
})

describe("swarm-live-visualizer: time formatting", () => {
  test("formats zero milliseconds", () => {
    expect(formatElapsed(0)).toBe("0s")
  })

  test("formats sub-second values as 0s", () => {
    expect(formatElapsed(500)).toBe("0s")
    expect(formatElapsed(999)).toBe("0s")
  })

  test("formats seconds only", () => {
    expect(formatElapsed(1000)).toBe("1s")
    expect(formatElapsed(12000)).toBe("12s")
    expect(formatElapsed(59000)).toBe("59s")
  })

  test("formats minutes and seconds", () => {
    expect(formatElapsed(60000)).toBe("1m")
    expect(formatElapsed(83000)).toBe("1m 23s")
    expect(formatElapsed(120000)).toBe("2m")
    expect(formatElapsed(3599000)).toBe("59m 59s")
  })

  test("formats hours and minutes", () => {
    expect(formatElapsed(3600000)).toBe("1h")
    expect(formatElapsed(3660000)).toBe("1h 1m")
    expect(formatElapsed(7500000)).toBe("2h 5m")
  })

  test("handles negative values gracefully", () => {
    expect(formatElapsed(-1000)).toBe("0s")
    expect(formatElapsed(-99999)).toBe("0s")
  })
})

describe("swarm-live-visualizer: status to icon mapping", () => {
  test("working and thinking statuses return spinner placeholder", () => {
    expect(statusToIcon("working")).toBe("spinner")
    expect(statusToIcon("thinking")).toBe("spinner")
  })

  test("completed status returns checkmark", () => {
    expect(statusToIcon("completed")).toBe("✓")
  })

  test("error status returns cross", () => {
    expect(statusToIcon("error")).toBe("✗")
  })

  test("idle status returns circle", () => {
    expect(statusToIcon("idle")).toBe("○")
  })

  test("unknown status falls through to circle", () => {
    expect(statusToIcon("unknown" as AgentStatus)).toBe("○")
  })
})

describe("swarm-live-visualizer: tree connector generation", () => {
  test("depth-0 non-last child uses ├─", () => {
    expect(treeConnector(false, 0)).toBe("├─ ")
  })

  test("depth-0 last child uses └─", () => {
    expect(treeConnector(true, 0)).toBe("└─ ")
  })

  test("depth-1 non-last child has correct indent", () => {
    expect(treeConnector(false, 1)).toBe("│  ├─ ")
  })

  test("depth-1 last child has correct indent", () => {
    expect(treeConnector(true, 1)).toBe("   └─ ")
  })

  test("depth-2 connectors nest properly", () => {
    expect(treeConnector(false, 2)).toBe("│  │  ├─ ")
    expect(treeConnector(true, 2)).toBe("│     └─ ")
  })

  test("continuation lines for depth-0", () => {
    expect(treeContinuation(false, 0)).toBe("│  ")
    expect(treeContinuation(true, 0)).toBe("   ")
  })

  test("continuation lines for depth-1", () => {
    expect(treeContinuation(false, 1)).toBe("│  │  ")
    expect(treeContinuation(true, 1)).toBe("      ")
  })
})
