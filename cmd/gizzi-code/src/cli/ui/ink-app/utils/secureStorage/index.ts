import { createFallbackStorage } from './fallbackStorage'
import { macOsKeychainStorage } from './macOsKeychainStorage'
import { plainTextStorage } from './plainTextStorage'
import { windowsDpapiStorage } from './windowsDpapiStorage'
// TODO(types): './types' is a TEMPORARY SHIM exporting nothing. Local
// mirror of src/shared/utils/secureStorage/types.ts — same pattern as
// fallbackStorage.ts; remove once the shim grows the real exports.
interface SecureStorageData {
  [key: string]: unknown
}
interface SecureStorage {
  name?: string
  getItem?(key: string): Promise<string | null>
  setItem?(key: string, value: string): Promise<void>
  removeItem?(key: string): Promise<void>
  clear?(): Promise<void>
  read(key?: string): SecureStorageData | null
  update(data: SecureStorageData): { success: boolean; warning?: string }
  readAsync?(): Promise<SecureStorageData | null>
  delete(): boolean | Promise<void>
}

/**
 * Get the appropriate secure storage implementation for the current platform.
 *
 * - macOS: Keychain, with the hardened plaintext file as an explicit
 *   last-resort fallback (0o600, `insecureFallback` marker, one-time warning).
 * - Windows: DPAPI CurrentUser (ProtectedData), same plaintext fallback.
 * - Linux: no libsecret backend yet — hardened plaintext fallback.
 */
export function getSecureStorage(): SecureStorage {
  if (process.platform === 'darwin') {
    return createFallbackStorage(macOsKeychainStorage, plainTextStorage)
  }
  if (process.platform === 'win32') {
    return createFallbackStorage(windowsDpapiStorage, plainTextStorage)
  }

  return plainTextStorage
}
