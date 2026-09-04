import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import {
  readGizziEnv,
  setGizziEnv,
  hasGizziEnv,
} from "../../src/shared/utils/gizziEnv"

const VARS = [
  "ENTRYPOINT",
  "SIMPLE",
  "AGENT",
  "TASK_LIST_ID",
  "COORDINATOR_MODE",
  "SESSION_ACCESS_TOKEN",
  "SESSION_ID",
] as const

describe("gizziEnv GIZZI_-only env access", () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const name of VARS) {
      const key = `GIZZI_${name}`
      if (!(key in saved)) saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  test("readGizziEnv reads GIZZI_${name}", () => {
    process.env.GIZZI_ENTRYPOINT = "sdk-cli"
    expect(readGizziEnv("ENTRYPOINT")).toBe("sdk-cli")
  })

  test("readGizziEnv treats whitespace-only as unset", () => {
    process.env.GIZZI_ENTRYPOINT = "   "
    expect(readGizziEnv("ENTRYPOINT")).toBeUndefined()
  })

  test("returns undefined when unset", () => {
    expect(readGizziEnv("ENTRYPOINT")).toBeUndefined()
  })

  test("setGizziEnv writes only the GIZZI_ form", () => {
    setGizziEnv("SIMPLE", "1")
    expect(process.env.GIZZI_SIMPLE).toBe("1")
    expect(process.env.GIZZI_CODE_SIMPLE).toBeUndefined()
    expect(readGizziEnv("SIMPLE")).toBe("1")
  })

  test("hasGizziEnv is true when GIZZI_ is set, even to an empty string", () => {
    expect(hasGizziEnv("SESSION_ID")).toBe(false)
    process.env.GIZZI_SESSION_ID = ""
    expect(hasGizziEnv("SESSION_ID")).toBe(true)
  })

  test("readGizziEnv ignores a leftover GIZZI_CODE_ form", () => {
    process.env.GIZZI_CODE_ENTRYPOINT = "legacy"
    expect(readGizziEnv("ENTRYPOINT")).toBeUndefined()
    process.env.GIZZI_ENTRYPOINT = "owned"
    expect(readGizziEnv("ENTRYPOINT")).toBe("owned")
    delete process.env.GIZZI_CODE_ENTRYPOINT
  })
})
