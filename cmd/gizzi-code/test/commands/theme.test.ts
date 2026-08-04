// @ts-nocheck
import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import * as fs from "fs/promises"
import os from "os"
import path from "path"

async function tmpHome() {
  const dir = path.join(os.tmpdir(), "gizzi-theme-test-" + Math.random().toString(36).slice(2))
  await fs.mkdir(path.join(dir, ".config", "gizzi"), { recursive: true })
  return dir
}

describe("theme command", () => {
  let originalHome: string | undefined
  let testHome: string

  beforeEach(async () => {
    originalHome = process.env.HOME
    testHome = await tmpHome()
    process.env.HOME = testHome
    process.env.USERPROFILE = testHome
  })

  afterEach(async () => {
    process.env.HOME = originalHome
    await fs.rm(testHome, { recursive: true, force: true })
  })

  test("sets and reads built-in themes", async () => {
    const theme = await import("../../src/cli/commands/theme/index.ts")
    await theme.setTheme("light")
    expect(await theme.getCurrentTheme()).toBe("light")
    const effective = await theme.getEffectiveTheme()
    expect(effective.name).toBe("light")
    expect(effective.background).toBe("#ffffff")
  })

  test("creates, activates, edits, and deletes custom themes", async () => {
    const theme = await import("../../src/cli/commands/theme/index.ts")

    const custom = await theme.saveCustomTheme(
      "ocean",
      { background: "#001122", primary: "#0077be" },
      "dark",
    )
    expect(custom.name).toBe("ocean")
    expect(custom.background).toBe("#001122")
    expect(custom.primary).toBe("#0077be")
    expect(custom.custom).toBe(true)

    await theme.setTheme("ocean")
    expect(await theme.getCurrentTheme()).toBe("ocean")

    await theme.saveCustomTheme("ocean", { accent: "#ff5500" }, "dark")
    const updated = await theme.getThemeByName("ocean")
    expect(updated.accent).toBe("#ff5500")

    await theme.deleteCustomTheme("ocean")
    expect(await theme.getThemeByName("ocean")).toBeUndefined()
    expect(await theme.getCurrentTheme()).toBe("dark")
  })

  test("lists built-ins and custom themes", async () => {
    const theme = await import("../../src/cli/commands/theme/index.ts")
    await theme.saveCustomTheme("forest", { background: "#0b1c10" }, "dark")

    const { names, active } = await theme.listAllThemeNames()
    expect(names).toContain("dark")
    expect(names).toContain("light")
    expect(names).toContain("system")
    expect(names).toContain("forest")
    expect(active).toBe("dark")
  })

  test("normalizes short hex colors", async () => {
    const theme = await import("../../src/cli/commands/theme/index.ts")
    const custom = await theme.saveCustomTheme("short", { background: "#abc" }, "dark")
    expect(custom.background).toBe("#aabbcc")
  })

  test("resolves system theme to dark or light", async () => {
    const theme = await import("../../src/cli/commands/theme/index.ts")
    await theme.setTheme("system")
    const effective = await theme.getEffectiveTheme()
    expect(["dark", "light"]).toContain(effective.name)
  })

  test("CLI custom command creates a theme", async () => {
    const theme = await import("../../src/cli/commands/theme/index.ts")
    await theme.default(["custom", "cli-test", "--base", "dark", "--primary", "#123456"])
    const created = await theme.getThemeByName("cli-test")
    expect(created).toBeDefined()
    expect(created.primary).toBe("#123456")
  })

  test("CLI palette command edits a color", async () => {
    const theme = await import("../../src/cli/commands/theme/index.ts")
    await theme.saveCustomTheme("edit-test", {}, "dark")
    await theme.default(["palette", "edit-test", "--key", "link", "--value", "#00ff00"])
    const updated = await theme.getThemeByName("edit-test")
    expect(updated.link).toBe("#00ff00")
  })
})
