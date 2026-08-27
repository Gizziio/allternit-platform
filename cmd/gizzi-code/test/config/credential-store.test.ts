import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import {
  createCredentialWriter,
  FileCredentialWriter,
  KeyringCredentialWriter,
  notImplementedKeyringBackend,
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

describe("FileCredentialWriter", () => {
  test("writes, reads, and removes secrets", async () => {
    const dir = await tempDir()
    const writer = new FileCredentialWriter(dir)

    await writer.write("gizzi-auth-profile", "work", "sk-file")
    expect(await writer.read("gizzi-auth-profile", "work")).toBe("sk-file")

    await writer.write("gizzi-auth-profile", "personal", "sk-file-2")
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
  test("'file' returns a file writer", async () => {
    const dir = await tempDir()
    const writer = createCredentialWriter("file", { fileDir: dir })
    expect(writer.name).toBe("file")
    await writer.write("svc", "acct", "secret")
    expect(await writer.read("svc", "acct")).toBe("secret")
  })

  test("'keyring' returns a keyring writer using the provided backend", async () => {
    const backend = memoryKeyring()
    const writer = createCredentialWriter("keyring", { keyring: backend })
    expect(writer.name).toBe("keyring")
    await writer.write("svc", "acct", "secret")
    expect(await writer.read("svc", "acct")).toBe("secret")
  })

  test("'auto' prefers keyring and falls back to file on failure", async () => {
    const dir = await tempDir()
    const backend = memoryKeyring()
    const writer = createCredentialWriter("auto", { keyring: backend, fileDir: dir })
    expect(writer.name).toBe("auto")

    await writer.write("svc", "acct", "secret")
    expect(await writer.read("svc", "acct")).toBe("secret")
  })

  test("'auto' falls back to file when keyring backend throws", async () => {
    const dir = await tempDir()
    const writer = createCredentialWriter("auto", {
      keyring: notImplementedKeyringBackend(),
      fileDir: dir,
    })

    await writer.write("svc", "acct", "fallback-secret")
    expect(await writer.read("svc", "acct")).toBe("fallback-secret")
  })
})
