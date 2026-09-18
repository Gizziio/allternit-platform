/**
 * node:crypto shim. randomUUID is native in browsers; the vendored session
 * code uses sha256 only as a change-detection fingerprint (never security),
 * so a deterministic FNV-1a-derived 64-hex digest is a faithful stand-in.
 */

export function randomUUID(): string {
  return globalThis.crypto.randomUUID()
}

export function createHash(_algo: string) {
  let h1 = 0xcbf29ce484222325n
  let h2 = 0x9e3779b97f4a7c15n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  return {
    update(data: Uint8Array | string) {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
      for (let i = 0; i < bytes.length; i += 1) {
        h1 = ((h1 ^ BigInt(bytes[i])) * prime) & mask
        h2 = ((h2 ^ BigInt(bytes[i] ^ 0x5a)) * prime) & mask
      }
      return this
    },
    digest(_encoding?: string) {
      const a = h1.toString(16).padStart(16, '0')
      const b = h2.toString(16).padStart(16, '0')
      const c = (h1 ^ h2).toString(16).padStart(16, '0')
      const d = (h1 * 31n ^ h2).toString(16).padStart(16, '0').slice(0, 16)
      return (a + b + c + d).slice(0, 64)
    },
  }
}
