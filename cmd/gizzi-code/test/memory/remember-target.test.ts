// @ts-nocheck
import { describe, expect, test } from "bun:test"
import {
  buildRememberedContent,
  parseRememberArgs,
  REMEMBER_HEADING,
} from "../../src/cli/ui/ink-app/commands/remember/rememberTarget"

describe("parseRememberArgs", () => {
  test("defaults to User memory", () => {
    expect(parseRememberArgs("the staging deploy uses eu-west")).toEqual({
      target: "User",
      note: "the staging deploy uses eu-west",
    })
  })

  test("parses --project / --local / --user flags anywhere in the args", () => {
    expect(parseRememberArgs("--project run tests with bun test")).toEqual({
      target: "Project",
      note: "run tests with bun test",
    })
    expect(parseRememberArgs("note first --local")).toEqual({
      target: "Local",
      note: "note first",
    })
    expect(parseRememberArgs("--user explicit user note")).toEqual({
      target: "User",
      note: "explicit user note",
    })
  })

  test("rejects unknown flags", () => {
    const result = parseRememberArgs("--bogus note")
    expect("error" in result).toBe(true)
    expect(result.error).toContain("Unknown flag: --bogus")
  })

  test("rejects empty note (with or without flag)", () => {
    expect("error" in parseRememberArgs("")).toBe(true)
    expect("error" in parseRememberArgs("--project")).toBe(true)
    expect("error" in parseRememberArgs("   ")).toBe(true)
  })
})

describe("buildRememberedContent", () => {
  const stamp = "2026-09-26"

  test("creates the heading in an empty file", () => {
    const { next, line } = buildRememberedContent("", "my note", stamp)
    expect(line).toBe("- 2026-09-26: my note")
    expect(next).toBe(`${REMEMBER_HEADING}\n- 2026-09-26: my note\n`)
  })

  test("appends the heading after existing content", () => {
    const { next } = buildRememberedContent("# Title\n", "my note", stamp)
    expect(next).toBe(`# Title\n\n${REMEMBER_HEADING}\n- 2026-09-26: my note\n`)
  })

  test("inserts under an existing heading", () => {
    const existing = `# Title\n\n${REMEMBER_HEADING}\n- 2026-01-01: old note\n`
    const { next } = buildRememberedContent(existing, "new note", stamp)
    expect(next).toBe(
      `# Title\n\n${REMEMBER_HEADING}\n- 2026-09-26: new note\n- 2026-01-01: old note\n`,
    )
  })
})
