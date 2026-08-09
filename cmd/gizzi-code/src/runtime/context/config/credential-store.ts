import fs from "fs/promises"
import path from "path"

/**
 * Where CLI credentials (API keys, tokens) should be persisted.
 *
 * - `"file"`    — write secrets to the local filesystem alongside profile metadata.
 * - `"keyring"` — write secrets to the OS keyring via a pluggable backend.
 * - `"auto"`    — prefer keyring, fall back to file if keyring is unavailable.
 */
export type CredentialStore = "file" | "keyring" | "auto"

/**
 * Pluggable credential backend. A real OS keyring implementation can be wired
 * in by providing a {@link KeyringBackend} to {@link createCredentialWriter}.
 */
export interface CredentialWriter {
  readonly name: string
  write(service: string, account: string, secret: string): Promise<void>
  read(service: string, account: string): Promise<string | null>
  remove(service: string, account: string): Promise<void>
}

/**
 * Filesystem-backed credential writer. Secrets are stored as JSON per service
 * in the configured directory with 0o600 permissions.
 */
export class FileCredentialWriter implements CredentialWriter {
  readonly name = "file"

  constructor(private readonly dir: string) {}

  private file(service: string): string {
    return path.join(this.dir, `${service}.json`)
  }

  async write(service: string, account: string, secret: string): Promise<void> {
    const file = this.file(service)
    await fs.mkdir(this.dir, { recursive: true })
    let data: Record<string, string> = {}
    try {
      data = JSON.parse(await fs.readFile(file, "utf8"))
    } catch {
      // File missing or corrupt — start fresh.
    }
    data[account] = secret
    await fs.writeFile(file, JSON.stringify(data, null, 2), { mode: 0o600 })
  }

  async read(service: string, account: string): Promise<string | null> {
    try {
      const data = JSON.parse(await fs.readFile(this.file(service), "utf8")) as Record<string, string>
      return data[account] ?? null
    } catch {
      return null
    }
  }

  async remove(service: string, account: string): Promise<void> {
    try {
      const file = this.file(service)
      const data = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, string>
      delete data[account]
      await fs.writeFile(file, JSON.stringify(data, null, 2), { mode: 0o600 })
    } catch {
      // Nothing to remove.
    }
  }
}

/**
 * Backend contract for a real OS keyring. Implementations should throw when the
 * keyring is unavailable so that `"auto"` mode can fall back to file storage.
 */
export interface KeyringBackend {
  write(service: string, account: string, secret: string): Promise<void>
  read(service: string, account: string): Promise<string | null>
  remove(service: string, account: string): Promise<void>
}

/**
 * Keyring-backed credential writer. Delegates all operations to the supplied
 * backend. By default uses a backend that throws, making this a safe scaffold
 * until an OS keyring implementation is wired in.
 */
export class KeyringCredentialWriter implements CredentialWriter {
  readonly name = "keyring"

  constructor(private readonly backend: KeyringBackend) {}

  async write(service: string, account: string, secret: string): Promise<void> {
    await this.backend.write(service, account, secret)
  }

  async read(service: string, account: string): Promise<string | null> {
    return this.backend.read(service, account)
  }

  async remove(service: string, account: string): Promise<void> {
    await this.backend.remove(service, account)
  }
}

class AutoCredentialWriter implements CredentialWriter {
  readonly name = "auto"

  constructor(
    private readonly keyring: CredentialWriter,
    private readonly file: CredentialWriter,
  ) {}

  async write(service: string, account: string, secret: string): Promise<void> {
    try {
      await this.keyring.write(service, account, secret)
    } catch {
      await this.file.write(service, account, secret)
    }
  }

  async read(service: string, account: string): Promise<string | null> {
    const value = await this.keyring.read(service, account)
    if (value !== null) return value
    return this.file.read(service, account)
  }

  async remove(service: string, account: string): Promise<void> {
    await this.keyring.remove(service, account).catch(() => undefined)
    await this.file.remove(service, account)
  }
}

/**
 * Default keyring backend used when no real OS keyring is provided. It throws
 * on write so `"auto"` falls back to file storage, and returns null on read.
 */
export function notImplementedKeyringBackend(): KeyringBackend {
  return {
    write: async () => {
      throw new Error("keyring backend not configured")
    },
    read: async () => null,
    remove: async () => undefined,
  }
}

function defaultCredentialDir(): string {
  const home = process.env.GIZZI_TEST_HOME || require("os").homedir()
  return path.join(home, ".gizzi", "credentials")
}

/**
 * Create a {@link CredentialWriter} for the requested storage mode.
 *
 * @param store   The storage mode from config.
 * @param options Optional keyring backend or file directory. When omitted, a
 *                scaffold keyring backend and `~/.gizzi/credentials` are used.
 */
export function createCredentialWriter(
  store: CredentialStore,
  options?: { keyring?: KeyringBackend; fileDir?: string },
): CredentialWriter {
  const fileWriter = new FileCredentialWriter(options?.fileDir ?? defaultCredentialDir())
  const keyringWriter = new KeyringCredentialWriter(options?.keyring ?? notImplementedKeyringBackend())

  switch (store) {
    case "file":
      return fileWriter
    case "keyring":
      return keyringWriter
    case "auto":
      return new AutoCredentialWriter(keyringWriter, fileWriter)
  }
}
