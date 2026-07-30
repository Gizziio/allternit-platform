import { describe, expect, test } from "bun:test"
import {
  LOCAL_INSTRUCTION_FILENAMES,
  pickWinner,
  ROOT_INSTRUCTION_FILENAMES,
} from "../../src/shared/utils/agentFileResolver"

describe("agentFileResolver.pickWinner", () => {
  test("GIZZI.md wins over CLAUDE.md and AGENTS.md", () => {
    expect(pickWinner(["CLAUDE.md", "AGENTS.md", "GIZZI.md"], ROOT_INSTRUCTION_FILENAMES)).toBe("GIZZI.md")
  })

  test("CLAUDE.md wins over AGENTS.md and CONTEXT.md when GIZZI.md absent", () => {
    expect(pickWinner(["AGENTS.md", "CONTEXT.md", "CLAUDE.md"], ROOT_INSTRUCTION_FILENAMES)).toBe("CLAUDE.md")
  })

  test("AGENTS.md wins over CONTEXT.md when GIZZI.md/CLAUDE.md absent", () => {
    expect(pickWinner(["CONTEXT.md", "AGENTS.md"], ROOT_INSTRUCTION_FILENAMES)).toBe("AGENTS.md")
  })

  test("CONTEXT.md wins when nothing else present", () => {
    expect(pickWinner(["CONTEXT.md"], ROOT_INSTRUCTION_FILENAMES)).toBe("CONTEXT.md")
  })

  test("returns undefined when nothing exists", () => {
    expect(pickWinner([], ROOT_INSTRUCTION_FILENAMES)).toBeUndefined()
  })

  test("GIZZI.local.md wins over CLAUDE.local.md", () => {
    expect(pickWinner(["CLAUDE.local.md", "GIZZI.local.md"], LOCAL_INSTRUCTION_FILENAMES)).toBe("GIZZI.local.md")
  })

  test("accepts a Set directly", () => {
    expect(pickWinner(new Set(["AGENTS.md"]), ROOT_INSTRUCTION_FILENAMES)).toBe("AGENTS.md")
  })
})
