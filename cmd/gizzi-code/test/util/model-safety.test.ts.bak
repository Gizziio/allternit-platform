// @ts-nocheck
import { describe, expect, test } from "bun:test"
import { blockedModelReason, isModelBlocked } from "../../src/util/model-safety"

describe("model-safety", () => {
  test("blocks unstable nano tier on opencode provider", () => {
    expect(isModelBlocked({ providerID: "opencode", modelID: "glm-4-nano" })).toBe(true)
    expect(blockedModelReason({ providerID: "opencode", modelID: "glm-4-nano" })).toContain("nano")
  })

  test("blocks unsupported gpt-5.3-codex-spark path for openai accounts", () => {
    expect(isModelBlocked({ providerID: "openai", modelID: "gpt-5.3-codex-spark" })).toBe(true)
    expect(
      blockedModelReason({
        providerID: "openai",
        modelID: "model-x",
        name: "GPT-5.3 Codex Spark",
      }),
    ).toContain("not supported")
  })

  test("allows supported codex model families", () => {
    expect(isModelBlocked({ providerID: "openai", modelID: "gpt-5.2-codex" })).toBe(false)
    expect(isModelBlocked({ providerID: "opencode", modelID: "minimax-m2.5-free" })).toBe(false)
  })
})
