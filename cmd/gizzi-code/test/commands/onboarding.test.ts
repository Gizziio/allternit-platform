import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import {
  ONBOARDING_MARKER_FILE,
  markOnboardingComplete,
  onboardingMarkerPath,
  runOnboardingDefaults,
  runOnboardingWizard,
  shouldOfferFirstRunOnboarding,
  type OnboardingDeps,
} from "../../src/cli/commands/onboarding"

type OfferDeps = Parameters<typeof shouldOfferFirstRunOnboarding>[0]

function offerDeps(overrides: Partial<OfferDeps> = {}): OfferDeps {
  return {
    interactive: true,
    isCI: false,
    stateDir: "/nonexistent-state",
    configToml: "/nonexistent-config/config.toml",
    authConfigured: async () => false,
    exists: async () => false,
    ...overrides,
  }
}

function wizardDeps(tmp: string, overrides: Partial<OnboardingDeps> = {}): OnboardingDeps {
  const files = new Set<string>()
  return {
    interactive: false,
    isCI: false,
    stateDir: tmp,
    configToml: path.join(tmp, "config.toml"),
    authConfigured: async () => false,
    exists: async (p) => files.has(p),
    writeFile: async (p, contents) => {
      files.add(p)
      await Bun.write(p, contents)
    },
    listBrains: async () => ({ plan: null, providers: [] }),
    setBrain: async () => {},
    ...overrides,
  }
}

describe("shouldOfferFirstRunOnboarding", () => {
  test("offers on first interactive launch with no config and no auth", async () => {
    expect(await shouldOfferFirstRunOnboarding(offerDeps())).toBe(true)
  })

  test("does not offer when the marker exists (never nag again)", async () => {
    const deps = offerDeps()
    deps.exists = async (p) => p === onboardingMarkerPath(deps.stateDir)
    expect(await shouldOfferFirstRunOnboarding(deps)).toBe(false)
  })

  test("does not offer when config.toml exists", async () => {
    const deps = offerDeps()
    deps.exists = async (p) => p === deps.configToml
    expect(await shouldOfferFirstRunOnboarding(deps)).toBe(false)
  })

  test("does not offer when auth is already configured", async () => {
    expect(await shouldOfferFirstRunOnboarding(offerDeps({ authConfigured: async () => true }))).toBe(false)
  })

  test("does not offer in non-interactive environments", async () => {
    expect(await shouldOfferFirstRunOnboarding(offerDeps({ interactive: false }))).toBe(false)
    expect(await shouldOfferFirstRunOnboarding(offerDeps({ isCI: true }))).toBe(false)
  })
})

describe("runOnboardingWizard non-interactive path", () => {
  test("skips gracefully when stdin is not a TTY", async () => {
    await using tmp = await tmpdir()
    const result = await runOnboardingWizard(wizardDeps(tmp.path))
    expect(result).toBe("skipped")
  })

  test("skips gracefully in CI", async () => {
    await using tmp = await tmpdir()
    const result = await runOnboardingWizard(wizardDeps(tmp.path, { interactive: true, isCI: true }))
    expect(result).toBe("skipped")
  })

  test("does not set the completion marker when skipped", async () => {
    await using tmp = await tmpdir()
    await runOnboardingWizard(wizardDeps(tmp.path))
    const marker = onboardingMarkerPath(tmp.path)
    const exists = await Bun.file(marker).exists()
    expect(exists).toBe(false)
  })

  test("a skipped run still leaves shouldOffer false when a marker exists", async () => {
    await using tmp = await tmpdir()
    const deps = wizardDeps(tmp.path)
    await markOnboardingComplete(deps)
    const exists = await Bun.file(path.join(tmp.path, ONBOARDING_MARKER_FILE)).exists()
    expect(exists).toBe(true)
    expect(
      await shouldOfferFirstRunOnboarding({
        interactive: true,
        isCI: false,
        stateDir: tmp.path,
        configToml: path.join(tmp.path, "config.toml"),
        authConfigured: async () => false,
        exists: deps.exists,
      }),
    ).toBe(false)
  })
})

describe("runOnboardingDefaults", () => {
  test("auto-picks the first installed CLI and writes the marker", async () => {
    await using tmp = await tmpdir()
    const brains: string[] = []
    const result = await runOnboardingDefaults(
      wizardDeps(tmp.path, {
        listBrains: async () => ({
          plan: null,
          providers: [
            {
              id: "grok",
              name: "Grok",
              auth_type: "subprocess",
              source: "subprocess",
              models: [{ id: "default", name: "Grok default" }],
            },
          ],
        }),
        setBrain: async (model) => {
          brains.push(model)
        },
      }),
    )
    expect(result).toBe("completed")
    expect(brains).toEqual(["grok/default"])
    expect(await Bun.file(path.join(tmp.path, ONBOARDING_MARKER_FILE)).exists()).toBe(true)
  })

  test("paid Plus/Super/Ultra defaults to Allternit Cloud", async () => {
    await using tmp = await tmpdir()
    const brains: string[] = []
    const result = await runOnboardingDefaults(
      wizardDeps(tmp.path, {
        listBrains: async () => ({
          plan: { id: "plus", label: "Plus", plan_tier: "pro", status: "active" },
          providers: [
            {
              id: "allternit",
              name: "Allternit Cloud",
              auth_type: "api_key",
              source: "platform",
              models: [{ id: "llama-3.1-8b", name: "Llama 3.1 8B" }],
            },
            {
              id: "grok",
              name: "Grok",
              auth_type: "subprocess",
              source: "subprocess",
              models: [{ id: "default", name: "Grok default" }],
            },
          ],
        }),
        setBrain: async (model) => {
          brains.push(model)
        },
      }),
    )
    expect(result).toBe("completed")
    expect(brains).toEqual(["allternit/llama-3.1-8b"])
  })
})
