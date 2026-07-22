import { describe, expect, test } from "bun:test"
import { ACP } from "@/runtime/integrations/acp/agent"

describe("ACP unified config options", () => {
  test("keeps model, thinking, and mode as orthogonal selectors", () => {
    const options = ACP.buildSessionConfigOptions({
      models: [{ modelId: "moonshot/kimi", name: "Moonshot/Kimi" }],
      model: { providerID: "moonshot", modelID: "kimi" },
      variants: ["low", "high"],
      variant: "high",
      modes: [{ id: "build", name: "Build" }, { id: "plan", name: "Plan" }],
      modeId: "build",
    })

    expect(options.map((option) => option.id)).toEqual(["model", "thinking", "mode"])
    expect(options[0]?.currentValue).toBe("moonshot/kimi")
    expect(options[1]?.currentValue).toBe("high")
    expect(options[2]?.currentValue).toBe("build")
  })

  test("hides thinking when the model has no variants", () => {
    const options = ACP.buildSessionConfigOptions({
      models: [{ modelId: "local/tiny", name: "Local/Tiny" }],
      model: { providerID: "local", modelID: "tiny" },
      variants: [],
      modes: [],
    })
    expect(options.map((option) => option.id)).toEqual(["model"])
  })
})

