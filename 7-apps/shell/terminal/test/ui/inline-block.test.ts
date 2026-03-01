import { describe, expect, test } from "bun:test"
import { blockValue, inlineText } from "../../src/ui/a2r/inline-coerce"

describe("A2R inline block coercion", () => {
  test("normalizes mixed inline values to strings", () => {
    const value = inlineText(["a", 1, 2n, null, false, () => "b", new Error("boom")])
    expect(value).toBe("a12bboom")
  })

  test("extracts children text from props wrapper", () => {
    const value = inlineText({ props: { children: "hello" } })
    expect(value).toBe("hello")
  })

  test("stringifies plain objects", () => {
    const value = inlineText({ a: 1, b: "two" })
    expect(value).toContain('"a":1')
    expect(value).toContain('"b":"two"')
  })

  test("uses text fallback for plain objects with props key", () => {
    const value = blockValue({ props: { foo: "bar" }, nested: { a: 1 } })
    expect(value.text).toBeTruthy()
  })

  test("coerces renderable-like wrappers into safe text", () => {
    const value = blockValue({ tuiRenderable: { props: { children: "wrapped-node" } } })
    expect(value.text).toContain("wrapped-node")
  })
})
