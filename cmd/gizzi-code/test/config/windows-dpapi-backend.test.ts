import { describe, expect, test } from "bun:test"
import { createWindowsDpapiBackend } from "../../src/runtime/context/config/windows-dpapi-backend"
import { defaultKeyringBackend } from "../../src/runtime/context/config/credential-store"

describe("createWindowsDpapiBackend", () => {
  test("is inert / throws on non-Windows platforms", async () => {
    if (process.platform === "win32") return
    const backend = createWindowsDpapiBackend()
    await expect(backend.write("svc", "acct", "secret")).rejects.toThrow(/win32/)
    expect(await backend.read("svc", "acct")).toBeNull()
    await backend.remove("svc", "acct")
  })
})

describe("defaultKeyringBackend", () => {
  test("is defined for the current platform", () => {
    expect(defaultKeyringBackend()).toBeDefined()
  })
})
