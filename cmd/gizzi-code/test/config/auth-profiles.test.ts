import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Auth } from "../../src/runtime/integrations/auth"
import type { KeyringBackend } from "../../src/runtime/context/config/credential-store"
import {
  addAuthProfile,
  getAuthStatus,
  loginApiKey,
  readAuthProfiles,
  removeAuthProfile,
  resolveApiKey,
  setActiveAuthProfile,
} from "../../src/runtime/context/config/auth-profiles"

const directories: string[] = []

async function configFixture(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gizzi-auth-profiles-"))
  directories.push(directory)
  return path.join(directory, "config.toml")
}

function memoryKeyring(): KeyringBackend {
  const store = new Map<string, string>()
  const key = (service: string, account: string) => `${service}:${account}`
  return {
    write: async (service, account, secret) => {
      store.set(key(service, account), secret)
    },
    read: async (service, account) => store.get(key(service, account)) ?? null,
    remove: async (service, account) => {
      store.delete(key(service, account))
    },
  }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
  // Clean up runtime auth store so OAuth state does not leak between tests.
  const auth = await Auth.all()
  for (const key of Object.keys(auth)) {
    await Auth.remove(key)
  }
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

describe("loginApiKey", () => {
  test("stores API key in config.toml by default", async () => {
    const configPath = await configFixture()
    const result = await loginApiKey(configPath, "sk-config")

    expect(result.profile).toBe("default")
    expect(result.method).toBe("file")

    const auth = await readAuthProfiles(configPath)
    expect(auth.active_profile).toBe("default")
    expect(auth.credential_store).toBe("file")
    expect(auth.profiles.default).toEqual({ provider: "anthropic", api_key: "sk-config" })
  })

  test("stores API key in keyring when configured", async () => {
    const configPath = await configFixture()
    const keyring = memoryKeyring()
    const result = await loginApiKey(configPath, "sk-keyring", {
      credentialStore: "keyring",
      writer: { name: "keyring", ...keyring },
    })

    expect(result.method).toBe("keyring")

    const auth = await readAuthProfiles(configPath)
    expect(auth.profiles.default?.api_key).toBeUndefined()
    expect(auth.credential_store).toBe("keyring")
    expect(await keyring.read("gizzi-auth-profile", "default")).toBe("sk-keyring")
  })

  test("'auto' falls back to file when keyring is unavailable", async () => {
    const configPath = await configFixture()
    const keyring = memoryKeyring()
    const result = await loginApiKey(configPath, "sk-auto", {
      credentialStore: "auto",
      writer: {
        name: "keyring",
        write: async () => {
          throw new Error("keyring unavailable")
        },
        read: keyring.read,
        remove: keyring.remove,
      },
    })

    expect(result.method).toBe("file")

    const auth = await readAuthProfiles(configPath)
    expect(auth.profiles.default?.api_key).toBe("sk-auto")
    expect(auth.credential_store).toBe("auto")
  })

  test("updates existing profile instead of creating a duplicate", async () => {
    const configPath = await configFixture()
    await loginApiKey(configPath, "sk-old", { profile: "work", provider: "openai" })
    await loginApiKey(configPath, "sk-new", { profile: "work", provider: "anthropic" })

    const auth = await readAuthProfiles(configPath)
    expect(Object.keys(auth.profiles)).toEqual(["work"])
    expect(auth.profiles.work).toEqual({ provider: "anthropic", api_key: "sk-new" })
  })
})

describe("resolveApiKey", () => {
  test("resolves key from config, env, and keyring", async () => {
    const configPath = await configFixture()
    const keyring = memoryKeyring()
    const writer = { name: "keyring", ...keyring }

    await loginApiKey(configPath, "sk-config", { profile: "file" })
    expect(await resolveApiKey(configPath, "file", writer)).toMatchObject({
      source: "config",
      key: "sk-config",
    })

    process.env.CUSTOM_API_KEY = "sk-env"
    await addAuthProfile(configPath, "env", { provider: "anthropic", api_key_env: "CUSTOM_API_KEY" })
    expect(await resolveApiKey(configPath, "env", writer)).toMatchObject({
      source: "env",
      key: "sk-env",
    })
    delete process.env.CUSTOM_API_KEY

    await loginApiKey(configPath, "sk-keyring", {
      profile: "keyring",
      credentialStore: "keyring",
      writer,
    })
    expect(await resolveApiKey(configPath, "keyring", writer)).toMatchObject({
      source: "keyring",
      key: "sk-keyring",
    })
  })
})

describe("getAuthStatus", () => {
  test("reports OAuth token when present in runtime auth store", async () => {
    const configPath = await configFixture()
    await Auth.set("anthropic", {
      type: "oauth",
      access: "access-token",
      refresh: "refresh-token",
      expires: Date.now() + 60_000,
    })

    expect(await getAuthStatus(configPath)).toEqual({ method: "oauth_token" })
  })

  test("reports API key when an active profile resolves", async () => {
    const configPath = await configFixture()
    await loginApiKey(configPath, "sk-status", { profile: "work" })

    expect(await getAuthStatus(configPath)).toEqual({ method: "api_key", profile: "work" })
  })

  test("reports none when no credentials exist", async () => {
    const configPath = await configFixture()
    expect(await getAuthStatus(configPath)).toEqual({ method: "none" })
  })
})
