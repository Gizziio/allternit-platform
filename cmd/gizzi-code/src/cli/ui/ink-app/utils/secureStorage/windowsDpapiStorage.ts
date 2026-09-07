// @ts-nocheck
import { chmodSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { execaSync } from 'execa'
import { getErrnoCode } from '../errors'
import { logForDebugging } from '../debug'
import { jsonParse, jsonStringify } from '../slowOperations'
import type { SecureStorage, SecureStorageData } from './types'

const BLOB_NAME = 'credentials.dpapi'

function storagePath(): { dir: string; file: string } {
  const dir = (
    process.env.GIZZI_CONFIG_DIR ?? join(homedir(), '.gizzi')
  ).normalize('NFC')
  return { dir, file: join(dir, BLOB_NAME) }
}

function powershell(script: string, input?: string): string | null {
  try {
    const result = execaSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        input,
        reject: false,
        timeout: 15_000,
        windowsHide: true,
        encoding: 'utf8',
      },
    )
    if (result.exitCode !== 0) {
      logForDebugging(`[dpapi] powershell exit ${result.exitCode}: ${result.stderr}`, {
        level: 'error',
      })
      return null
    }
    return result.stdout?.trim() ?? ''
  } catch (e) {
    logForDebugging(`[dpapi] powershell failed: ${e instanceof Error ? e.message : e}`, {
      level: 'error',
    })
    return null
  }
}

const PROTECT = [
  'Add-Type -AssemblyName System.Security',
  '$in = New-Object IO.MemoryStream',
  '[Console]::OpenStandardInput().CopyTo($in)',
  '$prot = [Security.Cryptography.ProtectedData]::Protect($in.ToArray(), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '[Convert]::ToBase64String($prot)',
].join('; ')

const UNPROTECT = [
  'Add-Type -AssemblyName System.Security',
  '$b64 = [Console]::In.ReadToEnd()',
  '$raw = [Convert]::FromBase64String($b64.Trim())',
  '$plain = [Security.Cryptography.ProtectedData]::Unprotect($raw, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '[Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))',
].join('; ')

function decryptBlob(b64: string): SecureStorageData | null {
  const json = powershell(UNPROTECT, b64)
  if (!json) return null
  try {
    return jsonParse(json)
  } catch {
    return null
  }
}

export const windowsDpapiStorage: SecureStorage = {
  name: 'dpapi',
  read(): SecureStorageData | null {
    if (process.platform !== 'win32') return null
    const { file } = storagePath()
    try {
      const b64 = readFileSync(file, 'utf8')
      if (!b64.trim()) return null
      return decryptBlob(b64)
    } catch {
      return null
    }
  },
  async readAsync(): Promise<SecureStorageData | null> {
    return this.read()
  },
  update(data: SecureStorageData): { success: boolean; warning?: string } {
    if (process.platform !== 'win32') {
      return { success: false }
    }
    try {
      const { dir, file } = storagePath()
      try {
        mkdirSync(dir, { mode: 0o700 })
      } catch (e: unknown) {
        if (getErrnoCode(e) !== 'EEXIST') throw e
      }
      const b64 = powershell(PROTECT, jsonStringify(data))
      if (!b64) return { success: false }
      writeFileSync(file, b64, { encoding: 'utf8' })
      try {
        chmodSync(file, 0o600)
      } catch {
        // Windows ACLs; chmod is best-effort
      }
      return { success: true }
    } catch (e) {
      logForDebugging(`[dpapi] update failed: ${e instanceof Error ? e.message : e}`, {
        level: 'error',
      })
      return { success: false }
    }
  },
  delete(): boolean {
    const { file } = storagePath()
    try {
      unlinkSync(file)
      return true
    } catch (e: unknown) {
      return getErrnoCode(e) === 'ENOENT'
    }
  },
}
