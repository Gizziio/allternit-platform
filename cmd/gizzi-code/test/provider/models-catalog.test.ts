import { describe, expect, test } from "bun:test"
import { ModelsDev } from "@/runtime/providers/adapters/models"

function model(id: string) {
  return {
    id,
    name: id,
    release_date: "2026-01-01",
    attachment: false,
    reasoning: false,
    temperature: true,
    tool_call: true,
    limit: { context: 131072, output: 16384 },
    options: {},
  }
}

describe("models catalog validation", () => {
  test("retains valid providers when a sibling provider is malformed", () => {
    const result = ModelsDev.parse({
      valid: {
        id: "valid",
        name: "Valid",
        env: [],
        models: { current: model("current") },
      },
      broken: {
        id: "broken",
        name: "Broken",
        env: [],
        models: { invalid: { id: "invalid" } },
      },
    })

    expect(Object.keys(result)).toEqual(["valid"])
    expect(result.valid.models.current.limit.context).toBe(131072)
  })

  test("rejects non-object payloads instead of leaking corrupt cache state", () => {
    expect(ModelsDev.parse([])).toEqual({})
    expect(ModelsDev.parse("not-json-object")).toEqual({})
  })
})
