import { describe, expect, test } from "bun:test"
import { isPaidAllternitPlan, pickDefaultBrain } from "../../src/runtime/providers/default-brain"
import type { DiscoveredProvider } from "../../src/runtime/providers/discovery"

const claude: DiscoveredProvider = {
  id: "claude-cli",
  name: "Claude (installed CLI)",
  auth_type: "subprocess",
  source: "subprocess",
  models: [{ id: "claude-sonnet-5", name: "Claude Sonnet 5" }],
}

const kimi: DiscoveredProvider = {
  id: "kimi-cli",
  name: "Kimi (CLI)",
  auth_type: "subprocess",
  source: "subprocess",
  models: [{ id: "kimi-k3", name: "Kimi K3" }],
}

const cloud: DiscoveredProvider = {
  id: "allternit",
  name: "Allternit Cloud",
  auth_type: "api_key",
  source: "platform",
  models: [{ id: "llama-3.1-8b", name: "Llama 3.1 8B" }],
}

describe("isPaidAllternitPlan", () => {
  test("Plus/Super/Ultra active or trialing are paid", () => {
    expect(isPaidAllternitPlan({ id: "plus", label: "Plus", plan_tier: "pro", status: "active" })).toBe(true)
    expect(isPaidAllternitPlan({ id: "super", label: "Super", plan_tier: "team", status: "trialing" })).toBe(true)
    expect(isPaidAllternitPlan({ id: "ultra", label: "Ultra", plan_tier: "team", status: "active" })).toBe(true)
  })

  test("Free and canceled are not paid", () => {
    expect(isPaidAllternitPlan({ id: "free", label: "Free", plan_tier: "free", status: "none" })).toBe(false)
    expect(isPaidAllternitPlan({ id: "plus", label: "Plus", plan_tier: "pro", status: "canceled" })).toBe(false)
    expect(isPaidAllternitPlan(null)).toBe(false)
  })
})

describe("pickDefaultBrain", () => {
  test("unpaid defaults to the first installed CLI", () => {
    expect(
      pickDefaultBrain({
        plan: { id: "free", label: "Free", plan_tier: "free", status: "none" },
        providers: [cloud, claude, kimi],
      }),
    ).toBe("claude-cli/claude-sonnet-5")
  })

  test("paid Plus/Super/Ultra defaults to Allternit Cloud", () => {
    expect(
      pickDefaultBrain({
        currentModel: "claude-cli/claude-sonnet-5",
        plan: { id: "plus", label: "Plus", plan_tier: "pro", status: "active" },
        providers: [cloud, claude],
      }),
    ).toBe("allternit/llama-3.1-8b")
  })

  test("a pinned /model is left alone even after a sub is bought", () => {
    expect(
      pickDefaultBrain({
        modelAuto: false,
        currentModel: "kimi-cli/kimi-k3",
        plan: { id: "ultra", label: "Ultra", plan_tier: "team", status: "active" },
        providers: [cloud, claude, kimi],
      }),
    ).toBeNull()
  })

  test("unpaid keeps an existing CLI pick", () => {
    expect(
      pickDefaultBrain({
        currentModel: "kimi-cli/kimi-k3",
        plan: null,
        providers: [claude, kimi],
      }),
    ).toBeNull()
  })

  test("no-ops when the target is already selected", () => {
    expect(
      pickDefaultBrain({
        currentModel: "allternit/llama-3.1-8b",
        plan: { id: "super", label: "Super", plan_tier: "team", status: "active" },
        providers: [cloud],
      }),
    ).toBeNull()
  })
})
