import { Buffer } from 'buffer'

/**
 * In-memory filesystem shim for the vendored slides main process.
 * The session layer uses paths for bookkeeping (recents, autosave, media
 * staging); in the browser there is no disk, so everything lands in a Map.
 * File contents are kept as Uint8Array; enough of node:fs is emulated for
 * the vendored code paths.
 */

const files = new Map<string, Uint8Array>()
const dirs = new Set<string>(['/virtual'])

function normalize(p: string): string {
  return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
}

function ensureDir(path: string): void {
  const parts = normalize(path).split('/').filter(Boolean)
  let cur = ''
  for (const part of parts) {
    cur += '/' + part
    dirs.add(cur)
  }
}

function parentDir(path: string): string {
  const n = normalize(path)
  const idx = n.lastIndexOf('/')
  return idx <= 0 ? '/' : n.slice(0, idx)
}

export function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (typeof data === 'string') return new TextEncoder().encode(data)
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  return new TextEncoder().encode(String(data))
}

// ── async API (node:fs/promises subset) ─────────────────────────────────────

export function readFile(path: string, encoding: 'utf8' | 'utf-8'): Promise<string>
export function readFile(path: string, encoding?: string): Promise<Buffer>
export async function readFile(path: string, encoding?: string): Promise<Buffer | string> {
  const data = files.get(normalize(path))
  if (!data) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' })
  return encoding ? new TextDecoder().decode(data) : Buffer.from(data)
}

export async function writeFile(path: string, data: unknown, _encoding?: string): Promise<void> {
  const p = normalize(path)
  ensureDir(parentDir(p))
  files.set(p, toBytes(data))
}

export async function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
  const p = normalize(path)
  if (!files.delete(p) && !options?.force) {
    if (!dirs.delete(p) && !options?.force) {
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
    }
  }
  if (options?.recursive) {
    for (const key of [...files.keys()]) {
      if (key.startsWith(p + '/')) files.delete(key)
    }
    for (const dir of [...dirs]) {
      if (dir.startsWith(p + '/')) dirs.delete(dir)
    }
  }
}

export async function stat(path: string) {
  const p = normalize(path)
  const data = files.get(p)
  if (!data) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
  return { size: data.byteLength, isFile: () => true, isDirectory: () => false, mtimeMs: Date.now() }
}

export async function mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
  const p = normalize(path)
  if (options?.recursive) ensureDir(p)
  else dirs.add(p)
}

export async function rename(from: string, to: string): Promise<void> {
  const data = files.get(normalize(from))
  if (!data) throw Object.assign(new Error(`ENOENT: ${from}`), { code: 'ENOENT' })
  await writeFile(to, data)
  files.delete(normalize(from))
}

/** Minimal FileHandle used by the vendored save path. */
export async function open(path: string, _flags?: string) {
  return {
    write: async (data: Uint8Array) => {
      const existing = files.get(normalize(path))
      const next = existing ? new Uint8Array([...existing, ...data]) : data
      await writeFile(path, next)
      return { bytesWritten: data.byteLength }
    },
    writeFile: async (data: unknown) => writeFile(path, data),
    read: async (buffer: Uint8Array, offset: number, length: number, position: number) => {
      const data = files.get(normalize(path)) ?? new Uint8Array()
      const slice = data.subarray(position, position + length)
      buffer.set(slice, offset)
      return { bytesRead: slice.byteLength, buffer }
    },
    truncate: async () => undefined,
    close: async () => undefined,
  }
}

let tmpCounter = 0
export async function mkdtemp(prefix: string): Promise<string> {
  const dir = `${prefix}${Date.now().toString(36)}${(tmpCounter++).toString(36)}`
  dirs.add(normalize(dir))
  return dir
}

// ── sync API (node:fs subset) ────────────────────────────────────────────────

export function existsSync(path: string): boolean {
  const p = normalize(path)
  return files.has(p) || dirs.has(p)
}

export function mkdirSync(path: string, options?: { recursive?: boolean }): void {
  const p = normalize(path)
  if (options?.recursive) ensureDir(p)
  else dirs.add(p)
}

export function readFileSync(path: string, encoding: 'utf8' | 'utf-8'): string
export function readFileSync(path: string, encoding?: string): Buffer
export function readFileSync(path: string, encoding?: string): Buffer | string {
  const data = files.get(normalize(path))
  if (!data) throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' })
  return encoding ? new TextDecoder().decode(data) : Buffer.from(data)
}

export function writeFileSync(path: string, data: unknown): void {
  const p = normalize(path)
  ensureDir(parentDir(p))
  files.set(p, toBytes(data))
}

export function readdirSync(path: string): string[] {
  const p = normalize(path)
  const out = new Set<string>()
  for (const key of files.keys()) {
    if (key.startsWith(p + '/')) {
      const rest = key.slice(p.length + 1)
      out.add(rest.split('/')[0])
    }
  }
  for (const dir of dirs) {
    if (dir.startsWith(p + '/')) {
      const rest = dir.slice(p.length + 1)
      if (rest) out.add(rest.split('/')[0])
    }
  }
  return [...out]
}

export function statSync(path: string) {
  const p = normalize(path)
  const data = files.get(p)
  if (!data) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' })
  return { size: data.byteLength, isFile: () => true, isDirectory: () => false, mtimeMs: Date.now() }
}

/** test/debug helper */
export function __memfsDump(): ReadonlyMap<string, Uint8Array> {
  return files
}
