// @ts-nocheck
import { describe, expect, test } from "bun:test"
import { deriveRuntimeLaneCards, type RuntimeLaneToolSnapshot } from "../../src/ui/allternit/runtime-lane"

function baseInput(overrides: Partial<Parameters<typeof deriveRuntimeLaneCards>[0]> = {}) {
  return {
    tools: [] as RuntimeLaneToolSnapshot[],
    modeLabel: "Connecting",
    modeHint: "awaiting runtime",
    modeStatus: "pending" as const,
    runID: "abc123",
    elapsedSeconds: 7,
    pulse: "<==>",
    heartbeat: "..",
    separator: "·",
    glyphTool: "⧉",
    includeHistory: false,
    historyLimit: 2,
    maxCards: 4,
    defaultExecutingHint: "running tool calls",
    ...overrides,
  }
}

describe("runtime lane derivation", () => {
  test("returns active + latest settled + stage + bundle when history is collapsed", () => {
    const tools: RuntimeLaneToolSnapshot[] = [
      { callID: "1", tool: "read", label: "read", status: "completed", detail: "file A" },
      { callID: "2", tool: "grep", label: "grep", status: "completed", detail: "3 matches" },
      { callID: "3", tool: "bash", label: "bash", status: "error", detail: "$ npm test" },
      { callID: "4", tool: "websearch", label: "websearch", status: "running", detail: "\"ux patterns\"", web: true },
    ]

    const cards = deriveRuntimeLaneCards(baseInput({ tools, includeHistory: false, maxCards: 4 }))

    expect(cards).toHaveLength(4)
    expect(cards[0]?.id).toBe("active-4")
    expect(cards[1]?.id).toBe("settled-3")
    expect(cards[2]?.id).toBe("stage-abc123")
    expect(cards[3]?.id).toBe("bundle-abc123")
  })

  test("expands with recent settled history in reverse chronological order", () => {
    const tools: RuntimeLaneToolSnapshot[] = [
      { callID: "1", tool: "read", label: "read", status: "completed", detail: "file A" },
      { callID: "2", tool: "grep", label: "grep", status: "completed", detail: "5 matches" },
      { callID: "3", tool: "bash", label: "bash", status: "error", detail: "$ npm test" },
      { callID: "4", tool: "websearch", label: "websearch", status: "running", detail: "\"ux patterns\"", web: true },
    ]

    const cards = deriveRuntimeLaneCards(
      baseInput({ tools, includeHistory: true, historyLimit: 2, maxCards: 5 }),
    )

    expect(cards).toHaveLength(5)
    expect(cards[0]?.id).toBe("active-4")
    expect(cards[1]?.id).toBe("settled-3")
    expect(cards[2]?.id).toBe("settled-2")
    expect(cards[3]?.id).toBe("stage-abc123")
    expect(cards[4]?.id).toBe("bundle-abc123")
  })

  test("always preserves stage and bundle cards at tight card budgets", () => {
    const tools: RuntimeLaneToolSnapshot[] = [
      { callID: "1", tool: "read", label: "read", status: "running", detail: "file A" },
      { callID: "2", tool: "grep", label: "grep", status: "completed", detail: "2 matches" },
    ]

    const cards = deriveRuntimeLaneCards(baseInput({ tools, maxCards: 2 }))

    expect(cards).toHaveLength(2)
    expect(cards[0]?.id).toBe("stage-abc123")
    expect(cards[1]?.id).toBe("bundle-abc123")
  })

  test("returns stage and bundle even when there are no tools", () => {
    const cards = deriveRuntimeLaneCards(baseInput({ tools: [], maxCards: 4 }))

    expect(cards).toHaveLength(2)
    expect(cards[0]?.title).toBe("Connecting lane")
    expect(cards[1]?.title).toBe("Receipt Bundle")
  })
})
