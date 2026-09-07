import { describe, test, expect } from "bun:test"
import {
  ColorDiff,
  ColorFile,
  getSyntaxTheme,
  listSyntaxThemes,
} from "../../src/vendor/color-diff-napi"
import { StructuredDiff } from "../../src/cli/ui/ink-app/components/StructuredDiff"

describe("color-diff-napi vendor shim", () => {
  test("color-math mode: diff/similar/closest/map", () => {
    const cd = new ColorDiff()
    expect(cd.diff({ r: 255, g: 0, b: 0 }, { r: 255, g: 0, b: 0 })).toBeCloseTo(0)
    expect(cd.similar({ r: 255, g: 0, b: 0 }, { r: 250, g: 5, b: 5 })).toBe(true)
    expect(cd.closest({ r: 255, g: 0, b: 0 }, [])).toBeNull()
    expect(cd.closest({ r: 255, g: 0, b: 0 }, [{ r: 0, g: 0, b: 255 }])).toEqual({ r: 0, g: 0, b: 255 })
    expect(cd.map({ r: 255, g: 0, b: 0 }, [{ r: 0, g: 0, b: 255 }, { r: 255, g: 0, b: 0 }])).toBe(1)
  })

  test("custom threshold is honored", () => {
    const strict = new ColorDiff(0.1)
    expect(strict.similar({ r: 255, g: 0, b: 0 }, { r: 250, g: 5, b: 5 })).toBe(false)
  })

  test("diff-render construction accepts (patch, firstLine, filePath, fileContent)", () => {
    const patch = { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-a", "+b"] }
    // Regression: gizzi-code 2.0.5 crashed with
    // "new ColorDiff(...).render is not a function" (TypeError) because the
    // TS port only implemented the color-math API.
    let instance: ColorDiff
    expect(() => {
      instance = new ColorDiff(patch, null, "foo.ts", "a\nb")
    }).not.toThrow()
    expect(typeof (instance! as unknown as { render?: unknown }).render).toBe("function")
  })

  test("render() never throws and signals fallback via null", () => {
    const patch = { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-a", "+b"] }
    const cd = new ColorDiff(patch, null, "foo.ts", "a\nb")
    expect(cd.render("dark-plus", 80, false)).toBeNull()
    // Color-math instances also expose a safe render()
    expect(new ColorDiff().render("dark-plus", 80, false)).toBeNull()
  })

  test("getSyntaxTheme/listSyntaxThemes", () => {
    expect(listSyntaxThemes().length).toBeGreaterThan(0)
    expect(getSyntaxTheme("monokai")?.name).toBe("Monokai")
    expect(getSyntaxTheme("no-such-theme")).toBeNull()
  })

  test("ColorFile still works", () => {
    expect(ColorFile.hexToRgb("ff0000")).toEqual({ r: 255, g: 0, b: 0 })
    expect(ColorFile.hexToRgb("f00")).toEqual({ r: 255, g: 0, b: 0 })
    const cf = new ColorFile()
    cf.add({ r: 1, g: 2, b: 3 })
    expect(cf.getColors()).toEqual([{ r: 1, g: 2, b: 3 }])
    cf.clear()
    expect(cf.getColors()).toEqual([])
  })

  test("StructuredDiff component imports (module graph loads)", () => {
    // memo() wraps the component, so the export is an object, not a function.
    expect(typeof StructuredDiff).toMatch(/function|object/)
    expect(StructuredDiff).toBeTruthy()
  })
})
