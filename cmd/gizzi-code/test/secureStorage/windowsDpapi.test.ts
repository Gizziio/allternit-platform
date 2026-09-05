import { describe, expect, test } from "bun:test"
import { windowsDpapiStorage } from "../../src/shared/utils/secureStorage/windowsDpapiStorage.ts"

describe("windowsDpapiStorage", () => {
  test("is inert on non-Windows platforms", () => {
    if (process.platform === "win32") return
    expect(windowsDpapiStorage.read()).toBeNull()
    expect(windowsDpapiStorage.update({ token: "x" }).success).toBe(false)
    expect(windowsDpapiStorage.delete()).toBe(true)
  })
})
