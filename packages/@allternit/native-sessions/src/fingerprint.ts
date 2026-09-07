import { createHash } from "node:crypto"
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

export function fingerprintPath(target: string): string {
  const hash = createHash("sha256")
  addPath(hash, target)
  return hash.digest("hex")
}

export function fingerprintPaths(targets: string[]): string {
  const hash = createHash("sha256")
  for (const target of targets) addPath(hash, target)
  return hash.digest("hex")
}

function addPath(hash: ReturnType<typeof createHash>, target: string) {
  hash.update(target)
  hash.update("\0")
  if (!existsSync(target)) {
    hash.update("missing")
    return
  }
  const st = statSync(target)
  hash.update(String(st.size))
  hash.update("\0")
  hash.update(String(Math.trunc(st.mtimeMs)))
  hash.update("\0")
  hash.update(String(st.ino ?? 0))
  if (st.isDirectory()) {
    const names = readdirSync(target).sort()
    for (const name of names) {
      if (name.endsWith(".lock") || name.endsWith("-shm") || name.endsWith("-wal")) continue
      const child = join(target, name)
      try {
        const childSt = statSync(child)
        hash.update(name)
        hash.update("\0")
        hash.update(String(childSt.size))
        hash.update("\0")
        hash.update(String(Math.trunc(childSt.mtimeMs)))
        hash.update("\0")
      } catch {
        hash.update(name)
        hash.update("\0missing")
      }
    }
  }
}

export function divergenceOf(snapshotHash: string, nativeHash: string | undefined, fetchedHash?: string): "clean" | "native_ahead" | "missing" {
  if (!nativeHash || nativeHash.endsWith("missing") || nativeHash === fingerprintPath("__missing__")) {
    if (!nativeHash) return "missing"
  }
  if (!nativeHash) return "missing"
  if (nativeHash === snapshotHash) return "clean"
  if (fetchedHash && nativeHash === fetchedHash) return "clean"
  return "native_ahead"
}
