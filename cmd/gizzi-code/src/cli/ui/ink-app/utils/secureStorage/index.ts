// @ts-nocheck
import { createFallbackStorage } from './fallbackStorage'
import { macOsKeychainStorage } from './macOsKeychainStorage'
import { plainTextStorage } from './plainTextStorage'
import type { SecureStorage } from './types'

/**
 * Get the appropriate secure storage implementation for the current platform.
 *
 * - macOS: Keychain, with the hardened plaintext file as an explicit
 *   last-resort fallback (0o600, `insecureFallback` marker, one-time warning).
 * - Linux / Windows: no OS backend wired yet (libsecret / Credential Manager
 *   are TODO), so the hardened plaintext fallback is the only option; it
 *   warns on first write and logs a deprecation path.
 */
export function getSecureStorage(): SecureStorage {
  if (process.platform === 'darwin') {
    return createFallbackStorage(macOsKeychainStorage, plainTextStorage)
  }

  // TODO: add libsecret (Linux) and Credential Manager (Windows) backends.

  return plainTextStorage
}
