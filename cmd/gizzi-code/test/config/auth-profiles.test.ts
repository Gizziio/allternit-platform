import { afterEach, beforeAll, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Auth } from "../../src/runtime/integrations/auth"
import {
  createCredentialWriter,
  notImplementedKeyringBackend,
  type CredentialWriter,
  type KeyringBackend,
} from "../../src/runtime/context/config/credential-store"
import {
  addAuthProfile,
  diagnoseAuth,
  getAuthStatus,
  loginApiKey,
  logout,
  migrateInlineApiKeys,
  readAuthProfiles,
  removeAuthProfile,
  resolveApiKey,
  setActiveAuthProfile,
  storeApiKeyForProfile,
} from "../../src/runtime/context/config/auth-profiles"

const directories: string[] = []
let testHome = ""

async function configFixture(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gizzi-auth-profiles-"))
  directories.push(directory)
  return path.join(directory, "config.toml")
}

async function fileDirFixture(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gizzi-auth-filedir-"))
  directories.push(directory)
  return directory
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

/**
 * Hermetic "auto" writer: keyring backend that throws (simulating a platform
 * with no OS secure store) and a temp-dir fallback file with a silent
 * notifier, so tests never touch the real keychain or ~/.gizzi.
 */
function hermeticWriter(fileDir: string): CredentialWriter {
  return createCredentialWriter("auto", {
    keyring: notImplementedKeyringBackend(),
    fileDir,
    notifier: () => {},
  })
}

beforeAll(() => {
  // Safety net: any default-constructed fallback writer lands in a temp home.
  testHome = path.join(os.tmpdir(), `gizzi-auth-test-home-${Date.now()}`)
  process.env.GIZZI_TEST_HOME = testHome
})

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
  test("never writes the API key inline into config.toml", async () => {
    const configPath = await configFixture()
    const fileDir = await fileDirFixture()
    const writer = hermeticWriter(fileDir)

    const result = await loginApiKey(configPath, "sk-auto", { writer, credentialStore: "auto" })

    expect(result.profile).toBe("default")
    expect(result.method).toBe("file")

    const auth = await readAuthProfiles(configPath)
    expect(auth.active_profile).toBe("default")
    expect(auth.credential_store).toBe("auto")
    expect(auth.profiles.default?.api_key).toBeUndefined()
    expect(await fs.readFile(configPath, "utf8")).not.toContain("sk-auto")

    // Key is resolvable from the credential store.
    expect(await resolveApiKey(configPath, "default", writer)).toMatchObject({
      source: "keyring",
      key: "sk-auto",
    })
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

  test("'file' store mode uses the marked fallback file, not config.toml", async () => {
    const configPath = await configFixture()
    const fileDir = await fileDirFixture()
    const writer = createCredentialWriter("file", { fileDir, notifier: () => {} })

    const result = await loginApiKey(configPath, "sk-file", { credentialStore: "file", writer })

    expect(result.method).toBe("file")
    expect(await fs.readFile(configPath, "utf8")).not.toContain("sk-file")
    expect(await writer.read("gizzi-auth-profile", "default")).toBe("sk-file")
  })

  test("'auto' with an explicit failing writer degrades to the fallback file", async () => {
    const configPath = await configFixture()
    const fileDir = await fileDirFixture()
    const keyring = memoryKeyring()
    const result = await loginApiKey(configPath, "sk-degrade", {
      credentialStore: "auto",
      fileDir,
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
    expect(await fs.readFile(configPath, "utf8")).not.toContain("sk-degrade")
    const writer = createCredentialWriter("file", { fileDir, notifier: () => {} })
    expect(await writer.read("gizzi-auth-profile", "default")).toBe("sk-degrade")
  })

  test("updates existing profile instead of creating a duplicate", async () => {
    const configPath = await configFixture()
    const fileDir = await fileDirFixture()
    const writer = hermeticWriter(fileDir)
    await loginApiKey(configPath, "sk-old", { profile: "work", provider: "openai", writer, credentialStore: "auto" })
    await loginApiKey(configPath, "sk-new", { profile: "work", provider: "anthropic", writer, credentialStore: "auto" })

    const auth = await readAuthProfiles(configPath)
    expect(Object.keys(auth.profiles)).toEqual(["work"])
    expect(auth.profiles.work?.api_key).toBeUndefined()
    expect(await writer.read("gizzi-auth-profile", "work")).toBe("sk-new")
  })
})

describe("storeApiKeyForProfile", () => {
  test("stores a key for a named profile without activating it", async () => {
    const configPath = await configFixture()
    const fileDir = await fileDirFixture()
    const writer = hermeticWriter(fileDir)

    await addAuthProfile(configPath, "work", { provider: "anthropic" })
    await setActiveAuthProfile(configPath, "work")
    await storeApiKeyForProfile(configPath, "work", "sk-stored", writer)

    expect(await writer.read("gizzi-auth-profile", "work")).toBe("sk-stored")
    expect(await fs.readFile(configPath, "utf8")).not.toContain("sk-stored")
  })
})

describe("migrateInlineApiKeys", () => {
  test("moves inline plaintext keys into the store and strips config.toml", async () => {
    const configPath = await configFixture()
    const fileDir = await fileDirFixture()
    const writer = hermeticWriter(fileDir)
    await fs.writeFile(
      configPath,
      [
        '[auth]',
        'active_profile = "work"',
        'credential_store = "auto"',
        '',
        '[auth.profiles.work]',
        'provider = "anthropic"',
        'api_key = "sk-inline"',
        '',
        '[auth.profiles.envonly]',
        'provider = "anthropic"',
        'api_key_env = "ANTHROPIC_API_KEY"',
      ].join("\n"),
    )

    const result = await migrateInlineApiKeys(configPath, writer)

    expect(result.migrated).toEqual(["work"])
    expect(result.failed).toEqual([])

    const auth = await readAuthProfiles(configPath)
    expect(auth.profiles.work?.api_key).toBeUndefined()
    expect(await fs.readFile(configPath, "utf8")).not.toContain("sk-inline")
    expect(await writer.read("gizzi-auth-profile", "work")).toBe("sk-inline")
  })

  test("keeps inline keys (chmod 600) when no store can hold them", async () => {
    const configPath = await configFixture()
    await fs.chmod(configPath, 0o644).catch(() => {})
    await fs.writeFile(
      configPath,
      [
        '[auth]',
        'active_profile = "work"',
        'credential_store = "keyring"',
        '',
        '[auth.profiles.work]',
        'provider = "anthropic"',
        'api_key = "sk-stuck"',
      ].join("\n"),
    )
    await fs.chmod(configPath, 0o644)

    const throwingWriter: CredentialWriter = {
      name: "keyring",
      write: async () => {
        throw new Error("no OS secure store")
      },
      read: async () => null,
      remove: async () => {},
    }

    const result = await migrateInlineApiKeys(configPath, throwingWriter)

    expect(result.migrated).toEqual([])
    expect(result.failed).toEqual(["work"])
    expect((await fs.stat(configPath)).mode & 0o777).toBe(0o600)

    // Key remains readable for continuity.
    const resolved = await resolveApiKey(configPath, "work", throwingWriter)
    expect(resolved).toMatchObject({ source: "config", key: "sk-stuck" })
  })

  test("resolveApiKey migrates legacy inline keys on read", async () => {
    const configPath = await configFixture()
    const fileDir = await fileDirFixture()
    const writer = hermeticWriter(fileDir)
    await fs.writeFile(
      configPath,
      [
        '[auth]',
        'active_profile = "work"',
        '',
        '[auth.profiles.work]',
        'provider = "anthropic"',
        'api_key = "sk-lazy"',
      ].join("\n"),
    )

    const resolved = await resolveApiKey(configPath, undefined, writer)

    expect(resolved).toMatchObject({ source: "keyring", key: "sk-lazy", profileName: "work" })
    expect(await fs.readFile(configPath, "utf8")).not.toContain("sk-lazy")
  })
})

describe("resolveApiKey", () => {
  test("resolves key from store, env, and keyring", async () => {
    const configPath = await configFixture()
    const keyring = memoryKeyring()
    const writer = { name: "keyring", ...keyring }

    await loginApiKey(configPath, "sk-store", { profile: "store", credentialStore: "keyring", writer })
    expect(await resolveApiKey(configPath, "store", writer)).toMatchObject({
      source: "keyring",
      key: "sk-store",
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
    const fileDir = await fileDirFixture()
    const writer = hermeticWriter(fileDir)
    await loginApiKey(configPath, "sk-status", { profile: "work", writer, credentialStore: "auto" })

    expect(await getAuthStatus(configPath, writer)).toEqual({ method: "api_key", profile: "work" })
  })

  test("reports none when no credentials exist", async () => {
    const configPath = await configFixture()
    expect(await getAuthStatus(configPath)).toEqual({ method: "none" })
  })
})

describe("logout", () => {
  test("removes the active API-key profile and clears active_profile", async () => {
    const configPath = await configFixture()
    const fileDir = await fileDirFixture()
    const writer = hermeticWriter(fileDir)
    await loginApiKey(configPath, "sk-logout", { profile: "work", writer, credentialStore: "auto" })

    const result = await logout(configPath, undefined, writer)
    expect(result.method).toBe("api_key")
    expect(result.profile).toBe("work")

    expect(await getAuthStatus(configPath, writer)).toEqual({ method: "none" })
    const auth = await readAuthProfiles(configPath)
    expect(auth.profiles.work).toBeUndefined()
    expect(auth.active_profile).toBeUndefined()
    expect(await writer.read("gizzi-auth-profile", "work")).toBeNull()
  })

  test("removes a specific profile when named", async () => {
    const configPath = await configFixture()
    const fileDir = await fileDirFixture()
    const writer = hermeticWriter(fileDir)
    await loginApiKey(configPath, "sk-keep", { profile: "keep", writer, credentialStore: "auto" })
    await loginApiKey(configPath, "sk-remove", { profile: "remove", writer, credentialStore: "auto" })

    await logout(configPath, "remove", writer)

    const auth = await readAuthProfiles(configPath)
    expect(auth.profiles.remove).toBeUndefined()
    expect(auth.profiles.keep).toBeDefined()
    expect(auth.active_profile).toBe("keep")
  })

  test("clears OAuth tokens from the runtime auth store", async () => {
    const configPath = await configFixture()
    await Auth.set("anthropic", {
      type: "oauth",
      access: "access-token",
      refresh: "refresh-token",
      expires: Date.now() + 60_000,
    })

    const result = await logout(configPath)
    expect(result.method).toBe("oauth_token")

    expect(await getAuthStatus(configPath)).toEqual({ method: "none" })
  })
})

describe("diagnoseAuth", () => {
  test("reports no auth when config is missing", async () => {
    const configPath = await configFixture()
    const diagnosis = await diagnoseAuth(configPath)
    expect(diagnosis.config_exists).toBe(false)
    expect(diagnosis.method).toBe("none")
    expect(diagnosis.profile_count).toBe(0)
  })

  test("reports API-key auth and profile names", async () => {
    const configPath = await configFixture()
    const fileDir = await fileDirFixture()
    const writer = hermeticWriter(fileDir)
    await loginApiKey(configPath, "sk-diag", { profile: "work", writer, credentialStore: "auto" })

    const diagnosis = await diagnoseAuth(configPath, writer)
    expect(diagnosis.config_exists).toBe(true)
    expect(diagnosis.method).toBe("api_key")
    expect(diagnosis.active_profile).toBe("work")
    expect(diagnosis.profile_names).toEqual(["work"])
  })
})
