// @ts-nocheck
import { createFallbackStorage } from './fallbackStorage'
import { macOsKeychainStorage } from './macOsKeychainStorage'
import { plainTextStorage } from './plainTextStorage'
import { windowsDpapiStorage } from './windowsDpapiStorage'
import type { SecureStorage } from './types'

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
