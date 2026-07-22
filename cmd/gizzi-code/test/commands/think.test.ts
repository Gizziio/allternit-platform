import { describe, test, expect } from "bun:test"
import { parseThinkArg, getThinkingConfigForMode, describeThinkingConfig, executeThink } from "../../src/cli/ui/ink-app/commands/think/think"

describe("/think slash command", () => {
  test("parseThinkArg recognizes modes", () => {
    expect(parseThinkArg("")).toBe("status")
    expect(parseThinkArg("status")).toBe("status")
    expect(parseThinkArg("on")).toBe("on")
    expect(parseThinkArg("enabled")).toBe("on")
    expect(parseThinkArg("off")).toBe("off")
    expect(parseThinkArg("disabled")).toBe("off")
    expect(parseThinkArg("hard")).toBe("hard")
    expect(parseThinkArg("deep")).toBe("hard")
    expect(parseThinkArg("ultrathink")).toBe("ultrathink")
    expect(parseThinkArg("adaptive")).toBe("adaptive")
    expect(parseThinkArg("nonsense")).toBeNull()
  })

  test("getThinkingConfigForMode returns correct configs", () => {
    expect(getThinkingConfigForMode("on")).toEqual({ type: "adaptive" })
    expect(getThinkingConfigForMode("adaptive")).toEqual({ type: "adaptive" })
    expect(getThinkingConfigForMode("off")).toEqual({ type: "disabled" })
    expect(getThinkingConfigForMode("hard")).toEqual({ type: "enabled", budgetTokens: 31999 })
    expect(getThinkingConfigForMode("ultrathink")).toEqual({ type: "enabled", budgetTokens: 31999 })
  })

  test("describeThinkingConfig describes current state", () => {
    expect(describeThinkingConfig(undefined, true)).toBe("Thinking is on (adaptive)")
    expect(describeThinkingConfig({ type: "adaptive" }, true)).toBe("Thinking is on (adaptive)")
    expect(describeThinkingConfig({ type: "enabled", budgetTokens: 31999 }, true)).toBe("Thinking is on with 31,999 budget tokens")
    expect(describeThinkingConfig(undefined, false)).toBe("Thinking is disabled")
    expect(describeThinkingConfig({ type: "disabled" }, true)).toBe("Thinking is disabled")
  })

  test("executeThink returns status message and state updates", () => {
    const on = executeThink("on")
    expect(on.enabled).toBe(true)
    expect(on.configOverride).toEqual({ type: "adaptive" })
    expect(on.message).toContain("Thinking on")

    const hard = executeThink("hard")
    expect(hard.enabled).toBe(true)
    expect(hard.configOverride).toEqual({ type: "enabled", budgetTokens: 31999 })
    expect(hard.message).toContain("Think hard")

    const off = executeThink("off")
    expect(off.enabled).toBe(false)
    expect(off.configOverride).toBeUndefined()
    expect(off.message).toContain("Thinking off")
  })
})
