import { createFallbackStorage } from './fallbackStorage.js'
import { macOsKeychainStorage } from './macOsKeychainStorage.js'
import { plainTextStorage } from './plainTextStorage.js'
import { windowsDpapiStorage } from './windowsDpapiStorage.js'
import type { SecureStorage } from './types.js'

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
