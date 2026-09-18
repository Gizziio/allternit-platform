import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { getLogLevel, log, setLogLevel } from "../../src/runtime/util/log"

describe("runtime/util/log", () => {
  afterEach(() => {
    setLogLevel("info")
  })

  describe("success level", () => {
    test("prints at the default info level", () => {
      const spy = spyOn(console, "log").mockImplementation(() => {})
      try {
        log("success", "theme saved")
        expect(spy).toHaveBeenCalled()
        const output = spy.mock.calls.map((c) => String(c[0])).join("\n")
        expect(output).toContain("[SUCCESS]")
        expect(output).toContain("theme saved")
      } finally {
        spy.mockRestore()
      }
    })

    test("is suppressed once the level is raised to warn", () => {
      setLogLevel("warn")
      const spy = spyOn(console, "log").mockImplementation(() => {})
      try {
        log("success", "theme saved")
        expect(spy).not.toHaveBeenCalled()
      } finally {
        spy.mockRestore()
      }
    })

    test("setLogLevel/getLogLevel round-trip accepts success", () => {
      setLogLevel("success")
      expect(getLogLevel()).toBe("success")
    })
  })
})
