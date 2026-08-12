import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import {
  addPermissionProfile,
  exportPermissionProfile,
  importPermissionProfile,
  parseDsl,
  readPermissionProfiles,
  removePermissionProfile,
  renderDsl,
  setActivePermissionProfile,
} from "../../src/runtime/context/config/permission-profiles"

const directories: string[] = []

async function configFixture(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gizzi-permission-profiles-"))
  directories.push(directory)
  return path.join(directory, "config.toml")
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe("config.toml permission profiles", () => {
  test("adds, activates, and removes profiles while preserving other config", async () => {
    const configPath = await configFixture()
    await fs.writeFile(configPath, 'default_model = "anthropic/claude-sonnet-4"\n')

    await addPermissionProfile(configPath, "strict", { bash: "ask", edit: "ask" })
    await addPermissionProfile(configPath, "relaxed", { bash: "allow", edit: "allow" })
    await setActivePermissionProfile(configPath, "relaxed")
    await removePermissionProfile(configPath, "relaxed")

    expect(await readPermissionProfiles(configPath)).toEqual({
      active_profile: "strict",
      profiles: {
        strict: { rules: { bash: "ask", edit: "ask" } },
      },
    })
    expect(await fs.readFile(configPath, "utf8")).toContain('default_model = "anthropic/claude-sonnet-4"')
  })

  test("rejects duplicate and unknown profiles", async () => {
    const configPath = await configFixture()
    await addPermissionProfile(configPath, "strict", { bash: "ask" })

    await expect(addPermissionProfile(configPath, "strict", { bash: "deny" })).rejects.toThrow("already exists")
    await expect(setActivePermissionProfile(configPath, "missing")).rejects.toThrow("not found")
    await expect(removePermissionProfile(configPath, "missing")).rejects.toThrow("not found")
  })

  test("round-trips through TOML rendering", async () => {
    const configPath = await configFixture()
    await addPermissionProfile(configPath, "strict", { bash: "ask", webfetch: "deny" })

    const text = await fs.readFile(configPath, "utf8")
    expect(text).toContain("[permission_profiles]")
    expect(text).toContain('[permission_profiles.profiles."strict".rules]')

    const reloaded = await readPermissionProfiles(configPath)
    expect(reloaded.profiles.strict?.rules).toEqual({ bash: "ask", webfetch: "deny" })
  })

  test("parses and renders policy DSL", () => {
    const dsl = "bash ask\nfile.read allow\nhttp.get deny\n# ignored\n"
    const rules = parseDsl(dsl)
    expect(rules).toEqual({ bash: "ask", "file.read": "allow", "http.get": "deny" })
    expect(renderDsl({ rules })).toEqual("bash ask\nfile.read allow\nhttp.get deny")

    expect(() => parseDsl("bash unknown")).toThrow("Invalid permission action")
    expect(() => parseDsl("bash")).toThrow("Invalid permission DSL line")
  })

  test("imports and exports permission profiles via DSL", async () => {
    const configPath = await configFixture()
    await fs.writeFile(configPath, 'default_model = "anthropic/claude-sonnet-4"\n')

    const dslFile = path.join(path.dirname(configPath), "strict.dsl")
    await fs.writeFile(dslFile, "bash ask\nfile.write ask\n")

    await importPermissionProfile(configPath, "strict", await fs.readFile(dslFile, "utf8"))
    const exported = await exportPermissionProfile(configPath, "strict")
    expect(exported).toEqual("bash ask\nfile.write ask")

    const reloaded = await readPermissionProfiles(configPath)
    expect(reloaded.profiles.strict?.rules).toEqual({ bash: "ask", "file.write": "ask" })
    expect(reloaded.active_profile).toEqual("strict")

    await expect(importPermissionProfile(configPath, "strict", "bash deny")).rejects.toThrow(
      "already exists",
    )
    await importPermissionProfile(configPath, "strict", "bash deny", { overwrite: true })
    expect((await readPermissionProfiles(configPath)).profiles.strict?.rules.bash).toEqual("deny")
    expect(await fs.readFile(configPath, "utf8")).toContain('default_model = "anthropic/claude-sonnet-4"')
  })
})
