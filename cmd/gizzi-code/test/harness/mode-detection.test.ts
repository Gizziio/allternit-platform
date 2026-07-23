import { describe, test, expect, afterEach } from "bun:test"
import { getHarnessMode, shouldUseHarness } from "../../src/cli/ui/ink-app/utils/feature-flags"

const ENV_VARS = [
  "GIZZI_HARNESS_MODE",
  "ALLTERNIT_CLOUD_TOKEN",
  "ALLTERNIT_LOCAL_URL",
  "ALLTERNIT_SUBPROCESS_CMD",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
]

afterEach(() => {
  for (const key of ENV_VARS) {
    delete process.env[key]
  }
})

describe("harness mode detection", () => {
  test("explicit GIZZI_HARNESS_MODE overrides detection", () => {
    process.env.GIZZI_HARNESS_MODE = "subprocess"
    process.env.ANTHROPIC_API_KEY = "test"
    expect(getHarnessMode()).toBe("subprocess")
  })

  test("ALLTERNIT_CLOUD_TOKEN selects cloud", () => {
    process.env.ALLTERNIT_CLOUD_TOKEN = "token"
    expect(getHarnessMode()).toBe("cloud")
  })

  test("ALLTERNIT_LOCAL_URL selects local", () => {
    process.env.ALLTERNIT_LOCAL_URL = "http://localhost:11434"
    expect(getHarnessMode()).toBe("local")
  })

  test("ALLTERNIT_SUBPROCESS_CMD selects subprocess", () => {
    process.env.ALLTERNIT_SUBPROCESS_CMD = "kimi -p"
    expect(getHarnessMode()).toBe("subprocess")
  })

  test("ANTHROPIC_API_KEY selects byok", () => {
    process.env.ANTHROPIC_API_KEY = "key"
    expect(getHarnessMode()).toBe("byok")
  })

  test("OPENAI_API_KEY selects byok", () => {
    process.env.OPENAI_API_KEY = "key"
    expect(getHarnessMode()).toBe("byok")
  })

  test("no credentials returns legacy", () => {
    expect(getHarnessMode()).toBe("legacy")
  })

  test("shouldUseHarness is true when enabled and mode is not legacy", () => {
    process.env.ANTHROPIC_API_KEY = "key"
    expect(shouldUseHarness()).toBe(true)
  })

  test("shouldUseHarness is false when mode is legacy", () => {
    expect(shouldUseHarness()).toBe(false)
  })

  test("GIZZI_HARNESS_ENABLED=false disables harness even with credentials", () => {
    process.env.ANTHROPIC_API_KEY = "key"
    process.env.GIZZI_HARNESS_ENABLED = "false"
    expect(shouldUseHarness()).toBe(false)
  })
})
