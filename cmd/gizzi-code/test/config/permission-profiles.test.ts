import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import {
  addPermissionProfile,
  readPermissionProfiles,
  removePermissionProfile,
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
})
