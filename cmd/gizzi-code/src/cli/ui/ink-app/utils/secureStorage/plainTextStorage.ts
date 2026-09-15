// @ts-nocheck
import { chmodSync } from 'fs'
import { join } from 'path'
import { getGizziConfigHomeDir } from '../envUtils'
import { getErrnoCode } from '../errors'
import { getFsImplementation } from '../fsOperations'
import { logForDebugging } from '../debug'
import {
  jsonParse,
  jsonStringify,
  writeFileSync_DEPRECATED,
} from '../slowOperations'
import type { SecureStorage, SecureStorageData } from './types'

// Marker persisted in the on-disk JSON so a plaintext credential file is
// unmistakable when found. Stripped before data is returned to consumers.
const INSECURE_FALLBACK_MARKER = 'insecureFallback'

let plaintextWarningShown = false

function remediation(): string {
  switch (process.platform) {
    case 'linux':
      return 'Install libsecret / gnome-keyring (e.g. `apt install libsecret-1-0 gnome-keyring`) and restart gizzi to store credentials in the OS keyring instead.'
    case 'win32':
      return 'DPAPI storage failed; credentials were written to a permission-hardened local file instead.'
    default:
      return 'Credentials will move to the OS keyring once a backend is available for this platform.'
  }
}

function warnPlaintextOnce(storagePath: string): void {
  logForDebugging(
    `[plaintext] DEPRECATED insecure credential fallback in use at ${storagePath}`,
    { level: 'warn' },
  )
  if (plaintextWarningShown) return
  plaintextWarningShown = true
  console.error(
    `WARNING: gizzi is storing credentials UNENCRYPTED in ${storagePath} (no OS secure store available).\n` +
      `  ${remediation()}\n` +
      '  This plaintext fallback is deprecated and will be removed in a future release.',
  )
}

function getStoragePath(): { storageDir: string; storagePath: string } {
  const storageDir = getGizziConfigHomeDir()
  const storageFileName = '.credentials.json'
  return { storageDir, storagePath: join(storageDir, storageFileName) }
}

function stripMarker(data: SecureStorageData | null): SecureStorageData | null {
  if (data && typeof data === 'object') {
    delete data[INSECURE_FALLBACK_MARKER]
  }
  return data
}

export const plainTextStorage = {
  name: 'plaintext',
  read(): SecureStorageData | null {
    // sync IO: called from sync context (SecureStorage interface)
    const { storagePath } = getStoragePath()
    try {
      const data = getFsImplementation().readFileSync(storagePath, {
        encoding: 'utf8',
      })
      return stripMarker(jsonParse(data))
    } catch {
      return null
    }
  },
  async readAsync(): Promise<SecureStorageData | null> {
    const { storagePath } = getStoragePath()
    try {
      const data = await getFsImplementation().readFile(storagePath, {
        encoding: 'utf8',
      })
      return stripMarker(jsonParse(data))
    } catch {
      return null
    }
  },
  update(data: SecureStorageData): { success: boolean; warning?: string } {
    // sync IO: called from sync context (SecureStorage interface)
    try {
      const { storageDir, storagePath } = getStoragePath()
      try {
        getFsImplementation().mkdirSync(storageDir, { mode: 0o700 })
      } catch (e: unknown) {
        const code = getErrnoCode(e)
        if (code !== 'EEXIST') {
          throw e
        }
      }
      try {
        chmodSync(storageDir, 0o700)
      } catch {
        // Best effort — directory may already exist with other ownership.
      }

      const persisted: SecureStorageData = {
        ...data,
        [INSECURE_FALLBACK_MARKER]: true,
      }
      writeFileSync_DEPRECATED(storagePath, jsonStringify(persisted), {
        encoding: 'utf8',
        flush: false,
      })
      chmodSync(storagePath, 0o600)
      warnPlaintextOnce(storagePath)
      return {
        success: true,
        warning: 'Warning: Storing credentials in plaintext.',
      }
    } catch {
      return { success: false }
    }
  },
  delete(): boolean {
    // sync IO: called from sync context (SecureStorage interface)
    const { storagePath } = getStoragePath()
    try {
      getFsImplementation().unlinkSync(storagePath)
      return true
    } catch (e: unknown) {
      const code = getErrnoCode(e)
      if (code === 'ENOENT') {
        return true
      }
      return false
    }
  },
} satisfies SecureStorage
