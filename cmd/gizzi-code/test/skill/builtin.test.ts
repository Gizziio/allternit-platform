/**
 * Tests for the skills system.
 *
 * Validates that the skills runtime exports are present and functional.
 */
import { test, expect, describe } from "bun:test"
import {
  createSkill,
  listSkills,
  getSkill,
  type Skill,
} from "../../src/runtime/skills"

describe("skills runtime", () => {
  test("createSkill is a function", () => {
    expect(typeof createSkill).toBe("function")
  })

  test("listSkills is a function", () => {
    expect(typeof listSkills).toBe("function")
  })

  test("getSkill is a function", () => {
    expect(typeof getSkill).toBe("function")
  })
})
