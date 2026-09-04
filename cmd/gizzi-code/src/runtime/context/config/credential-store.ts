import fs from "fs/promises"
import path from "path"
import { Log } from "@/shared/util/log"
import { createMacOSKeychainBackend } from "./keychain-backend"

/**
 * Where CLI credentials (API keys, tokens) should be persisted.
 *
 * - `"keyring"` — write secrets to the OS keyring (macOS Keychain via the
 *   `security` CLI; Linux libsecret and Windows Credential Manager backends
 *   are not implemented yet, so those platforms throw in `"keyring"` mode).
 * - `"file"`    — write secrets to a marked, 0o600 "insecure fallback" file
 *   (see {@link FileCredentialWriter}). Used ONLY when no OS secure store is
 *   available. Never writes secrets inline into config.toml.
 * - `"auto"`    — prefer keyring, fall back to the marked file if the keyring
 *   is unavailable. This is the default.
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

/** Marker written into the fallback file so it is unmistakable on disk. */
export const INSECURE_FALLBACK_MARKER = "insecureFallback"

/** Single file (inside the configured directory) holding fallback secrets. */
export const FALLBACK_CREDENTIALS_FILENAME = "credentials.json"

/** Legacy layout: one `<service>.json` file per service inside the directory. */
const LEGACY_SERVICE_FILE_PATTERN = /\.json$/

export type FallbackNotification = (message: string) => void

function fallbackRemediation(): string {
  switch (process.platform) {
    case "linux":
      return "Install libsecret / gnome-keyring (e.g. `apt install libsecret-1-0 gnome-keyring`) and restart gizzi to store credentials in the OS keyring instead."
    case "win32":
      return "Windows Credential Manager support is not implemented yet; this plaintext fallback is a deprecated stopgap."
    default:
      return "Credentials will move to the OS keyring once a backend is available for this platform."
  }
}

function defaultNotifier(message: string): void {
  // One-time stderr warning; tests and embedders can inject their own notifier.
  console.error(message)
}

let deprecationLogged = false

function logDeprecationOnce(): void {
  if (deprecationLogged) return
  deprecationLogged = true
  Log.Default.warn(
    "credential-store: insecure plaintext fallback file in use (deprecated). " +
      fallbackRemediation(),
  )
}

export interface FallbackFileOptions {
  /** Called once per process with the user-facing plaintext warning. */
  notifier?: FallbackNotification
}

interface FallbackFileData {
  insecureFallback: boolean
  version: 1
  credentials: Record<string, Record<string, string>>
}

function emptyFallbackData(): FallbackFileData {
  return { insecureFallback: true, version: 1, credentials: {} }
}

/**
 * Filesystem-backed credential writer of LAST RESORT, for platforms without
 * an OS secure store. Secrets live in a single `credentials.json` file that:
 *
 * - carries an `"insecureFallback": true` marker so the file is
 *   unmistakable when found on disk,
 * - is created with 0o600 permissions inside a 0o700 directory (and re-
 *   chmodded on every write, so pre-existing lax permissions are fixed),
 * - triggers a one-time user warning (with platform-specific remediation)
 *   plus a deprecation entry in the session log on first write.
 *
 * Legacy layout: earlier revisions wrote one `<service>.json` file per
 * service into the same directory. Reads transparently migrate those
 * entries into the single marked file and rename the legacy files to
 * `*.migrated` backups.
 */
export class FileCredentialWriter implements CredentialWriter {
  readonly name = "file"
  private warned = false

  constructor(
    private readonly dir: string,
    private readonly options: FallbackFileOptions = {},
  ) {}

  private file(): string {
    return path.join(this.dir, FALLBACK_CREDENTIALS_FILENAME)
  }

  private notify(): void {
    logDeprecationOnce()
    if (this.warned) return
    this.warned = true
    const message =
      "WARNING: gizzi is storing credentials UNENCRYPTED in " +
      this.file() +
      " (no OS secure store available).\n" +
      "  " +
      fallbackRemediation() +
      "\n" +
      "  This plaintext fallback is deprecated and will be removed in a future release."
    ;(this.options.notifier ?? defaultNotifier)(message)
  }

  private async readFileData(): Promise<FallbackFileData> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file(), "utf8")) as Partial<FallbackFileData>
      if (raw && typeof raw === "object") {
        return {
          insecureFallback: true,
          version: 1,
          credentials: raw.credentials ?? {},
        }
      }
    } catch {
      // Missing or corrupt — start fresh.
    }
    return emptyFallbackData()
  }

  /** Migrate legacy per-service `<dir>/<service>.json` files, if any exist. */
  private async migrateLegacyFiles(data: FallbackFileData): Promise<boolean> {
    let migrated = false
    let entries: string[] = []
    try {
      entries = await fs.readdir(this.dir)
    } catch {
      return false
    }
    for (const entry of entries) {
      if (entry === FALLBACK_CREDENTIALS_FILENAME || !LEGACY_SERVICE_FILE_PATTERN.test(entry)) continue
      const legacyPath = path.join(this.dir, entry)
      try {
        const service = entry.replace(LEGACY_SERVICE_FILE_PATTERN, "")
        const legacy = JSON.parse(await fs.readFile(legacyPath, "utf8")) as Record<string, string>
        if (legacy && typeof legacy === "object") {
          data.credentials[service] = {
            ...(data.credentials[service] ?? {}),
            ...legacy,
          }
          migrated = true
        }
        await fs.rename(legacyPath, `${legacyPath}.migrated`)
      } catch {
        // Unreadable legacy file — leave it in place.
      }
    }
    return migrated
  }

  async write(service: string, account: string, secret: string): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true, mode: 0o700 })
    await fs.chmod(this.dir, 0o700).catch(() => {})
    const data = await this.readFileData()
    if (await this.migrateLegacyFiles(data)) {
      this.notify()
    }
    data.credentials[service] = { ...(data.credentials[service] ?? {}), [account]: secret }
    await fs.writeFile(this.file(), JSON.stringify(data, null, 2), { mode: 0o600 })
    await fs.chmod(this.file(), 0o600).catch(() => {})
    this.notify()
  }

  async read(service: string, account: string): Promise<string | null> {
    const data = await this.readFileData()
    if (await this.migrateLegacyFiles(data)) {
      // Persist the migrated merge so the legacy files can be retired.
      try {
        await fs.mkdir(this.dir, { recursive: true, mode: 0o700 })
        await fs.writeFile(this.file(), JSON.stringify(data, null, 2), { mode: 0o600 })
        await fs.chmod(this.file(), 0o600).catch(() => {})
        this.notify()
      } catch {
        // Best effort — the in-memory merge still serves this read.
      }
    }
    return data.credentials[service]?.[account] ?? null
  }

  async remove(service: string, account: string): Promise<void> {
    const data = await this.readFileData()
    if (await this.migrateLegacyFiles(data)) {
      this.notify()
    }
    if (data.credentials[service]) {
      delete data.credentials[service]![account]
    }
    try {
      await fs.mkdir(this.dir, { recursive: true, mode: 0o700 })
      await fs.writeFile(this.file(), JSON.stringify(data, null, 2), { mode: 0o600 })
      await fs.chmod(this.file(), 0o600).catch(() => {})
    } catch {
      // Nothing to remove / write failed — treat as removed.
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

export class AutoCredentialWriter implements CredentialWriter {
  readonly name = "auto"
  /** Where the most recent write landed — "keyring" or the "file" fallback. */
  private lastWrite: "keyring" | "file" | null = null

  get lastWriteTarget(): "keyring" | "file" | null {
    return this.lastWrite
  }

  constructor(
    private readonly keyring: CredentialWriter,
    private readonly file: CredentialWriter,
  ) {}

  async write(service: string, account: string, secret: string): Promise<void> {
    try {
      await this.keyring.write(service, account, secret)
      this.lastWrite = "keyring"
    } catch {
      await this.file.write(service, account, secret)
      this.lastWrite = "file"
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
  return path.join(home, ".gizzi")
}

/**
 * Create a {@link CredentialWriter} for the requested storage mode.
 *
 * @param store   The storage mode from config.
 * @param options Optional keyring backend, file directory, or fallback
 *                notifier. When omitted, the platform default keyring backend
 *                (macOS Keychain on darwin, throwing scaffold elsewhere) and
 *                `~/.gizzi` are used.
 */
export function createCredentialWriter(
  store: CredentialStore,
  options?: {
    keyring?: KeyringBackend
    fileDir?: string
    notifier?: FallbackNotification
  },
): CredentialWriter {
  const fileWriter = new FileCredentialWriter(options?.fileDir ?? defaultCredentialDir(), {
    notifier: options?.notifier,
  })
  const keyringWriter = new KeyringCredentialWriter(
    options?.keyring ?? defaultKeyringBackend(),
  )

  switch (store) {
    case "file":
      return fileWriter
    case "keyring":
      return keyringWriter
    case "auto":
      return new AutoCredentialWriter(keyringWriter, fileWriter)
  }
}

/**
 * Platform-default keyring backend: macOS Keychain on darwin, throwing
 * scaffold elsewhere (so `"auto"` degrades to the marked plaintext fallback
 * with a warning on Linux/Windows until libsecret / Credential Manager
 * backends land).
 */
export function defaultKeyringBackend(): KeyringBackend {
  if (process.platform === "darwin") {
    return createMacOSKeychainBackend()
  }
  return notImplementedKeyringBackend()
}
