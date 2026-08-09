import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import {
  addAuthProfile,
  readAuthProfiles,
  removeAuthProfile,
  setActiveAuthProfile,
} from "../../src/runtime/context/config/auth-profiles"

const directories: string[] = []

async function configFixture(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gizzi-auth-profiles-"))
  directories.push(directory)
  return path.join(directory, "config.toml")
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe("config.toml authentication profiles", () => {
  test("adds, activates, and removes profiles while preserving other config", async () => {
    const configPath = await configFixture()
    await fs.writeFile(configPath, 'default_model = "anthropic/claude-sonnet-4"\n')

    await addAuthProfile(configPath, "work", {
      provider: "anthropic",
      api_key_env: "ANTHROPIC_API_KEY",
    })
    await addAuthProfile(configPath, "local", {
      provider: "openai-compatible",
      base_url: "http://localhost:11434/v1",
    })
    await setActiveAuthProfile(configPath, "local")
    await removeAuthProfile(configPath, "local")

    expect(await readAuthProfiles(configPath)).toEqual({
      active_profile: "work",
      profiles: {
        work: { provider: "anthropic", api_key_env: "ANTHROPIC_API_KEY" },
      },
    })
    expect(await fs.readFile(configPath, "utf8")).toContain('default_model = "anthropic/claude-sonnet-4"')
    expect((await fs.stat(configPath)).mode & 0o777).toBe(0o600)
  })

  test("rejects duplicate and unknown profiles", async () => {
    const configPath = await configFixture()
    await addAuthProfile(configPath, "work", { provider: "anthropic" })

    await expect(addAuthProfile(configPath, "work", { provider: "openai" })).rejects.toThrow("already exists")
    await expect(setActiveAuthProfile(configPath, "missing")).rejects.toThrow("not found")
    await expect(removeAuthProfile(configPath, "missing")).rejects.toThrow("not found")
  })
})
