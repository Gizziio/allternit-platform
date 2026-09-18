/**
 * Archive fingerprint — a fast, deterministic content hash used to identify
 * the original package bytes. This is an integrity fingerprint, not a
 * security primitive: FNV-1a (64-bit) is sufficient and works identically in
 * Node and the browser (the previous SHA-256 via node:crypto broke browser
 * bundles).
 */
export function fingerprintBytes(bytes: Uint8Array): string {
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < bytes.length; i += 1) {
    hash = ((hash ^ BigInt(bytes[i])) * prime) & mask
  }
  return hash.toString(16).padStart(16, '0')
}
