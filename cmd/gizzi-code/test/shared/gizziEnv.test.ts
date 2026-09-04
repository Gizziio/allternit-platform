import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import {
  readGizziEnv,
  setGizziEnv,
  hasGizziEnv,
} from "../../src/shared/utils/gizziEnv"

const DUAL_VARS = [
  "ENTRYPOINT",
  "SIMPLE",
  "AGENT",
  "TASK_LIST_ID",
  "COORDINATOR_MODE",
  "SESSION_ACCESS_TOKEN",
  "SESSION_ID",
] as const

describe("gizziEnv dual-name env access", () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const name of DUAL_VARS) {
      for (const prefix of ["GIZZI_", "CLAUDE_CODE_"]) {
        const key = `${prefix}${name}`
        if (!(key in saved)) saved[key] = process.env[key]
        delete process.env[key]
      }
    }
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  test("GIZZI_ wins over CLAUDE_CODE_ when both are set", () => {
    process.env.CLAUDE_CODE_ENTRYPOINT = "cli"
    process.env.GIZZI_ENTRYPOINT = "sdk-cli"
    expect(readGizziEnv("ENTRYPOINT")).toBe("sdk-cli")
  })

  test("falls back to CLAUDE_CODE_ when GIZZI_ is unset (back-compat read)", () => {
    process.env.CLAUDE_CODE_ENTRYPOINT = "local-agent"
    expect(readGizziEnv("ENTRYPOINT")).toBe("local-agent")
  })

  test("falls back to CLAUDE_CODE_ when GIZZI_ is whitespace-only", () => {
    process.env.GIZZI_ENTRYPOINT = "   "
    process.env.CLAUDE_CODE_ENTRYPOINT = "cli"
    expect(readGizziEnv("ENTRYPOINT")).toBe("cli")
  })

  test("returns undefined when neither form is set", () => {
    expect(readGizziEnv("ENTRYPOINT")).toBeUndefined()
  })

  test("setGizziEnv writes both GIZZI_ and CLAUDE_CODE_ forms", () => {
    setGizziEnv("SIMPLE", "1")
    expect(process.env.GIZZI_SIMPLE).toBe("1")
    expect(process.env.CLAUDE_CODE_SIMPLE).toBe("1")
    expect(readGizziEnv("SIMPLE")).toBe("1")
  })

  test("hasGizziEnv is true when either form is set, even to an empty string", () => {
    expect(hasGizziEnv("SESSION_ID")).toBe(false)
    process.env.CLAUDE_CODE_SESSION_ID = ""
    expect(hasGizziEnv("SESSION_ID")).toBe(true)
    delete process.env.CLAUDE_CODE_SESSION_ID
    process.env.GIZZI_SESSION_ID = ""
    expect(hasGizziEnv("SESSION_ID")).toBe(true)
  })

  test("readGizziEnv prefers GIZZI_ for every dual-set var", () => {
    for (const name of DUAL_VARS) {
      process.env[`CLAUDE_CODE_${name}`] = "legacy"
      process.env[`GIZZI_${name}`] = "owned"
      expect(readGizziEnv(name)).toBe("owned")
    }
  })
})
