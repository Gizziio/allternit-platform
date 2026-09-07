import { chmodSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { execaSync } from "execa"
import { getErrnoCode } from "@/shared/utils/errors"
import type { KeyringBackend } from "./credential-store"

/**
 * Service-name suffix so this blob never collides with MCP OAuth
 * `credentials.dpapi` written by `windowsDpapiStorage`.
 */
const BLOB_NAME = "credentials-store.dpapi"

type Blob = Record<string, Record<string, string>>

function storagePath(): { dir: string; file: string } {
  const dir = (process.env.GIZZI_CONFIG_DIR ?? join(homedir(), ".gizzi")).normalize("NFC")
  return { dir, file: join(dir, BLOB_NAME) }
}

function powershell(script: string, input?: string): string | null {
  try {
    const result = execaSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        input,
        reject: false,
        timeout: 15_000,
        windowsHide: true,
        encoding: "utf8",
      },
    )
    if (result.exitCode !== 0) return null
    return result.stdout?.trim() ?? ""
  } catch {
    return null
  }
}

const PROTECT = [
  "Add-Type -AssemblyName System.Security",
  "$in = New-Object IO.MemoryStream",
  "[Console]::OpenStandardInput().CopyTo($in)",
  "$prot = [Security.Cryptography.ProtectedData]::Protect($in.ToArray(), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)",
  "[Convert]::ToBase64String($prot)",
].join("; ")

const UNPROTECT = [
  "Add-Type -AssemblyName System.Security",
  "$b64 = [Console]::In.ReadToEnd()",
  "$raw = [Convert]::FromBase64String($b64.Trim())",
  "$plain = [Security.Cryptography.ProtectedData]::Unprotect($raw, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)",
  "[Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))",
].join("; ")

function load(): Blob {
  const { file } = storagePath()
  try {
    const b64 = readFileSync(file, "utf8")
    if (!b64.trim()) return {}
    const json = powershell(UNPROTECT, b64)
    if (!json) return {}
    const parsed = JSON.parse(json) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as Blob
  } catch {
    return {}
  }
}

function save(data: Blob): void {
  const { dir, file } = storagePath()
  try {
    mkdirSync(dir, { mode: 0o700 })
  } catch (e: unknown) {
    if (getErrnoCode(e) !== "EEXIST") throw e
  }
  const b64 = powershell(PROTECT, JSON.stringify(data))
  if (!b64) {
    throw new Error("Windows DPAPI protect failed")
  }
  writeFileSync(file, b64, { encoding: "utf8" })
  try {
    chmodSync(file, 0o600)
  } catch {
    // Windows ACLs; chmod is best-effort
  }
}

/**
 * Keyring backend backed by Windows DPAPI (`ProtectedData` CurrentUser).
 *
 * One encrypted blob holds `{ [service]: { [account]: secret } }`. Throws when
 * not on win32 or when protect fails, so `"auto"` degrades to the marked
 * plaintext fallback.
 */
export function createWindowsDpapiBackend(): KeyringBackend {
  return {
    async write(service, account, secret) {
      if (process.platform !== "win32") {
        throw new Error("Windows DPAPI backend is only available on win32")
      }
      const data = load()
      data[service] = { ...(data[service] ?? {}), [account]: secret }
      save(data)
    },
    async read(service, account) {
      if (process.platform !== "win32") return null
      return load()[service]?.[account] ?? null
    },
    async remove(service, account) {
      if (process.platform !== "win32") return
      const data = load()
      if (!data[service] || !(account in data[service]!)) return
      delete data[service]![account]
      if (Object.keys(data[service]!).length === 0) delete data[service]
      if (Object.keys(data).length === 0) {
        try {
          unlinkSync(storagePath().file)
        } catch (e: unknown) {
          if (getErrnoCode(e) !== "ENOENT") throw e
        }
        return
      }
      save(data)
    },
  }
}
