/**
 * Device Fingerprint Utilities
 */

export async function getFingerprint(): Promise<string> {
  return 'default-fingerprint'
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../shared/utils/fingerprint.js'
