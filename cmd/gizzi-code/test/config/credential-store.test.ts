import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import {
  createCredentialWriter,
  FALLBACK_CREDENTIALS_FILENAME,
  FileCredentialWriter,
  INSECURE_FALLBACK_MARKER,
  KeyringCredentialWriter,
  notImplementedKeyringBackend,
  type FallbackNotification,
  type KeyringBackend,
} from "../../src/runtime/context/config/credential-store"

const directories: string[] = []

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gizzi-credential-store-"))
  directories.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

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

function collectingNotifier(messages: string[]): FallbackNotification {
  return (message) => messages.push(message)
}

describe("FileCredentialWriter (insecure fallback)", () => {
  test("writes secrets into a single marked credentials.json", async () => {
    const dir = await tempDir()
    const writer = new FileCredentialWriter(dir)

    await writer.write("gizzi-auth-profile", "work", "sk-file")
    await writer.write("gizzi-auth-profile", "personal", "sk-file-2")

    const file = path.join(dir, FALLBACK_CREDENTIALS_FILENAME)
    const raw = JSON.parse(await fs.readFile(file, "utf8"))
    expect(raw[INSECURE_FALLBACK_MARKER]).toBe(true)
    expect(raw.credentials["gizzi-auth-profile"]).toEqual({
      work: "sk-file",
      personal: "sk-file-2",
    })

    expect(await writer.read("gizzi-auth-profile", "work")).toBe("sk-file")
    expect(await writer.read("gizzi-auth-profile", "personal")).toBe("sk-file-2")

    await writer.remove("gizzi-auth-profile", "work")
    expect(await writer.read("gizzi-auth-profile", "work")).toBeNull()
    expect(await writer.read("gizzi-auth-profile", "personal")).toBe("sk-file-2")
  })

  test("returns null for missing secrets", async () => {
    const dir = await tempDir()
    const writer = new FileCredentialWriter(dir)
    expect(await writer.read("missing", "missing")).toBeNull()
  })

  test("creates file with 0o600 and directory with 0o700", async () => {
    const dir = await tempDir()
    const credDir = path.join(dir, "nested")
    const writer = new FileCredentialWriter(credDir)
    await writer.write("svc", "acct", "secret")

    const fileStat = await fs.stat(path.join(credDir, FALLBACK_CREDENTIALS_FILENAME))
    expect(fileStat.mode & 0o777).toBe(0o600)
    const dirStat = await fs.stat(credDir)
    expect(dirStat.mode & 0o777).toBe(0o700)
  })

  test("warns once via the injected notifier", async () => {
    const dir = await tempDir()
    const messages: string[] = []
    const writer = new FileCredentialWriter(dir, { notifier: collectingNotifier(messages) })

    await writer.write("svc", "a", "one")
    await writer.write("svc", "b", "two")
    await writer.read("svc", "a")

    expect(messages.length).toBe(1)
    expect(messages[0]).toContain("UNENCRYPTED")
    expect(messages[0]).toContain(FALLBACK_CREDENTIALS_FILENAME)
  })

  test("migrates legacy per-service files and renames them to .migrated", async () => {
    const dir = await tempDir()
    // Legacy layout: <dir>/<service>.json holding { account: secret }
    await fs.mkdir(path.join(dir, "credentials"), { recursive: true })
    const legacyDir = path.join(dir, "credentials")
    await fs.writeFile(
      path.join(legacyDir, "gizzi-auth-profile.json"),
      JSON.stringify({ legacy: "sk-legacy" }),
    )
    await fs.writeFile(path.join(legacyDir, "notes.json"), JSON.stringify({ x: "not-a-secret" }))

    const writer = new FileCredentialWriter(legacyDir, { notifier: () => {} })
    expect(await writer.read("gizzi-auth-profile", "legacy")).toBe("sk-legacy")
    expect(await writer.read("notes", "x")).toBe("not-a-secret")

    // Legacy files renamed to .migrated backups; merged into the marked file.
    await expect(fs.access(path.join(legacyDir, "gizzi-auth-profile.json"))).rejects.toThrow()
    const backupExists = await fs
      .stat(path.join(legacyDir, "gizzi-auth-profile.json.migrated"))
      .then(() => true)
      .catch(() => false)
    expect(backupExists).toBe(true)
    const merged = JSON.parse(
      await fs.readFile(path.join(legacyDir, FALLBACK_CREDENTIALS_FILENAME), "utf8"),
    )
    expect(merged[INSECURE_FALLBACK_MARKER]).toBe(true)
    expect(merged.credentials["gizzi-auth-profile"].legacy).toBe("sk-legacy")
    expect(merged.credentials.notes.x).toBe("not-a-secret")
  })
})

describe("KeyringCredentialWriter", () => {
  test("delegates to the supplied backend", async () => {
    const backend = memoryKeyring()
    const writer = new KeyringCredentialWriter(backend)

    await writer.write("gizzi-auth-profile", "work", "sk-keyring")
    expect(await writer.read("gizzi-auth-profile", "work")).toBe("sk-keyring")

    await writer.remove("gizzi-auth-profile", "work")
    expect(await writer.read("gizzi-auth-profile", "work")).toBeNull()
  })
})

describe("createCredentialWriter", () => {
  test("'file' returns the marked fallback writer", async () => {
    const dir = await tempDir()
    const messages: string[] = []
    const writer = createCredentialWriter("file", { fileDir: dir, notifier: collectingNotifier(messages) })
    expect(writer.name).toBe("file")
    await writer.write("svc", "acct", "secret")
    expect(await writer.read("svc", "acct")).toBe("secret")
    expect(messages.length).toBe(1)
  })

  test("'keyring' returns a keyring writer using the provided backend", async () => {
    const backend = memoryKeyring()
    const writer = createCredentialWriter("keyring", { keyring: backend })
    expect(writer.name).toBe("keyring")
    await writer.write("svc", "acct", "secret")
    expect(await writer.read("svc", "acct")).toBe("secret")
  })

  test("'auto' prefers keyring and reports the keyring target", async () => {
    const dir = await tempDir()
    const backend = memoryKeyring()
    const writer = createCredentialWriter("auto", { keyring: backend, fileDir: dir })
    expect(writer.name).toBe("auto")

    await writer.write("svc", "acct", "secret")
    expect(await writer.read("svc", "acct")).toBe("secret")
    expect(await backend.read("svc", "acct")).toBe("secret")
  })

  test("'auto' falls back to the marked file when keyring backend throws", async () => {
    const dir = await tempDir()
    const messages: string[] = []
    const writer = createCredentialWriter("auto", {
      keyring: notImplementedKeyringBackend(),
      fileDir: dir,
      notifier: collectingNotifier(messages),
    })

    await writer.write("svc", "acct", "fallback-secret")
    expect(await writer.read("svc", "acct")).toBe("fallback-secret")

    const raw = JSON.parse(await fs.readFile(path.join(dir, FALLBACK_CREDENTIALS_FILENAME), "utf8"))
    expect(raw[INSECURE_FALLBACK_MARKER]).toBe(true)
    expect(messages.length).toBe(1)
    expect(messages[0]).toContain("UNENCRYPTED")
  })

  test("'auto' remove clears both keyring and fallback file", async () => {
    const dir = await tempDir()
    const backend = memoryKeyring()
    const writer = createCredentialWriter("auto", {
      keyring: backend,
      fileDir: dir,
      notifier: () => {},
    })
    await writer.write("svc", "acct", "secret")
    await writer.remove("svc", "acct")
    expect(await writer.read("svc", "acct")).toBeNull()
  })
})
