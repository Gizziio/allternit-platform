/**
 * Filesystem utilities for runtime
 * Production-quality implementation with consistent API
 */

import {
  access,
  constants,
  lstat,
  mkdir as fsMkdir,
  readFile as fsReadFile,
  readdir,
  stat,
  writeFile as fsWriteFile,
  appendFile as fsAppendFile,
  rm,
  copyFile,
} from 'fs/promises'
import { createWriteStream, watch as fsWatch } from 'fs'
import { dirname, join, resolve, relative, extname } from 'path'
import { createHash } from 'crypto'

// ─── Low-level functions (named exports) ───

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function readFile(path: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
  return fsReadFile(path, { encoding })
}

export async function readFileBinary(path: string): Promise<Buffer> {
  return fsReadFile(path)
}

export async function writeFile(path: string, content: string | Buffer, options?: { mode?: number }): Promise<void> {
  await fsMkdir(dirname(path), { recursive: true })
  await fsWriteFile(path, content, options)
}

export async function ensureDir(path: string): Promise<void> {
  await fsMkdir(path, { recursive: true })
}

export async function listDir(path: string): Promise<string[]> {
  return readdir(path)
}

export async function getFileInfo(path: string) {
  const s = await stat(path)
  return {
    size: s.size,
    isFile: s.isFile(),
    isDirectory: s.isDirectory(),
    isSymbolicLink: s.isSymbolicLink(),
    mtime: s.mtime,
    ctime: s.ctime,
    birthtime: s.birthtime,
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

export async function isFile(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isFile()
  } catch {
    return false
  }
}

export { dirname, join, resolve, relative }

export function normalizePath(path: string): string {
  return resolve(path)
}

export function getRelativePath(from: string, to: string): string {
  return relative(from, to)
}

export async function glob(pattern: string, options?: { cwd?: string; absolute?: boolean }): Promise<string[]> {
  const { glob: fastGlob } = await import('glob')
  return fastGlob(pattern, options)
}

export async function copy(src: string, dest: string): Promise<void> {
  const s = await stat(src)
  if (s.isDirectory()) {
    await fsMkdir(dest, { recursive: true })
    const entries = await readdir(src, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = join(src, entry.name)
      const destPath = join(dest, entry.name)
      if (entry.isDirectory()) {
        await copy(srcPath, destPath)
      } else {
        await copyFile(srcPath, destPath)
      }
    }
  } else {
    await fsMkdir(dirname(dest), { recursive: true })
    await copyFile(src, dest)
  }
}

export async function remove(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true })
  } catch {
    // Ignore errors for non-existent paths
  }
}

export function watchFile(path: string, callback: (event: 'change' | 'rename', filename: string) => void): { close: () => void } {
  const watcher = fsWatch(path, { recursive: true }, callback)
  return {
    close: () => watcher.close(),
  }
}

export async function createTempDir(prefix?: string): Promise<string> {
  const os = await import('os')
  const tmpDir = os.tmpdir()
  const name = `${prefix || 'tmp'}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const fullPath = join(tmpDir, name)
  await fsMkdir(fullPath, { recursive: true })
  return fullPath
}

export async function createTempFile(prefix?: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await createTempDir(prefix)
  const filePath = join(dir, 'file')
  await fsWriteFile(filePath, '')
  return {
    path: filePath,
    cleanup: async () => remove(dir),
  }
}

export async function isBinaryFile(path: string): Promise<boolean> {
  const buffer = await readFileBinary(path)
  return buffer.slice(0, 8192).includes(0)
}

export async function safeReadFile(path: string, defaultContent = ''): Promise<string> {
  try {
    return await readFile(path)
  } catch {
    return defaultContent
  }
}

// ─── Filesystem namespace (the API that importers actually use) ───

export namespace Filesystem {
  /** Check if a path exists */
  export async function exists(path: string): Promise<boolean> {
    return fileExists(path)
  }

  /** Read file contents as text */
  export async function readText(path: string): Promise<string> {
    return fsReadFile(path, 'utf8')
  }

  /** Read file contents as bytes */
  export async function readBytes(path: string): Promise<Buffer> {
    return fsReadFile(path)
  }

  /** Read file as ArrayBuffer */
  export async function readArrayBuffer(path: string): Promise<ArrayBuffer> {
    const buf = await fsReadFile(path)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }

  /** Read and parse JSON file */
  export async function readJson<T = unknown>(path: string): Promise<T> {
    const content = await fsReadFile(path, 'utf8')
    return JSON.parse(content) as T
  }

  /** Write text or binary content to a file */
  export async function write(path: string, content: string | Buffer | Uint8Array): Promise<void> {
    await fsMkdir(dirname(path), { recursive: true })
    await fsWriteFile(path, content)
  }

  /** Write object as formatted JSON */
  export async function writeJson(path: string, data: unknown): Promise<void> {
    await fsMkdir(dirname(path), { recursive: true })
    await fsWriteFile(path, JSON.stringify(data, null, 2) + '\n', 'utf8')
  }

  /** Append content to a file */
  export async function append(path: string, content: string | Buffer): Promise<void> {
    await fsMkdir(dirname(path), { recursive: true })
    await fsAppendFile(path, content)
  }

  /** Create directory (recursive) */
  export async function mkdir(path: string): Promise<void> {
    await fsMkdir(path, { recursive: true })
  }

  /** Get file/directory stats */
  export async function stat(path: string): Promise<{
    size: number
    isFile: boolean
    isDirectory: boolean
    isSymbolicLink: boolean
    mtime: Date
    ctime: Date
  }> {
    const s = await stat(path)
    return {
      size: s.size,
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      isSymbolicLink: s.isSymbolicLink(),
      mtime: s.mtime,
      ctime: s.ctime,
    }
  }

  /** Check if path is a directory */
  export async function isDir(path: string): Promise<boolean> {
    try {
      const s = await stat(path)
      return s.isDirectory()
    } catch {
      return false
    }
  }

  /** Check if path is a file */
  export async function isFile(path: string): Promise<boolean> {
    try {
      const s = await stat(path)
      return s.isFile()
    } catch {
      return false
    }
  }

  /** List directory contents */
  export async function list(path: string): Promise<string[]> {
    return readdir(path)
  }

  /** Remove file or directory */
  export async function remove(path: string): Promise<void> {
    try {
      await rm(path, { recursive: true, force: true })
    } catch {
      // Ignore
    }
  }

  /** Copy file or directory */
  export async function copy(src: string, dest: string): Promise<void> {
    const s = await stat(src)
    if (s.isDirectory()) {
      await fsMkdir(dest, { recursive: true })
      const entries = await readdir(src, { withFileTypes: true })
      for (const entry of entries) {
        await copy(join(src, entry.name), join(dest, entry.name))
      }
    } else {
      await fsMkdir(dirname(dest), { recursive: true })
      await copyFile(src, dest)
    }
  }

  /** Walk up directory tree until predicate matches or root reached */
  export async function findUp(
    start: string,
    predicate: (path: string) => Promise<boolean> | boolean,
  ): Promise<string | null> {
    let current = resolve(start)
    while (true) {
      if (await predicate(current)) return current
      const parent = dirname(current)
      if (parent === current) return null
      current = parent
    }
  }

  /** Get parent directory */
  export function up(path: string): string {
    return dirname(path)
  }

  /** Normalize path */
  export function normalizePath(path: string): string {
    return resolve(path)
  }

  /** Get MIME type from filename */
  export function mimeType(path: string): string {
    const ext = extname(path).toLowerCase()
    const types: Record<string, string> = {
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    }
    return types[ext] || 'application/octet-stream'
  }

  /** Glob pattern search */
  export async function glob(pattern: string, options?: { cwd?: string }): Promise<string[]> {
    const { glob: fastGlob } = await import('glob')
    return fastGlob(pattern, options)
  }

  /** Glob search starting from directory, walking up */
  export async function globUp(start: string, pattern: string): Promise<string[]> {
    const results: string[] = []
    let current = resolve(start)
    while (true) {
      const matches = await glob(pattern, { cwd: current, absolute: true })
      results.push(...matches)
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return results
  }

  /** Create write stream */
  export function writeStream(path: string): ReturnType<typeof createWriteStream> {
    return createWriteStream(path)
  }

  /** Ensure directory exists */
  export async function ensureDir(path: string): Promise<void> {
    await fsMkdir(path, { recursive: true })
  }

  /** Compute SHA-256 hash of file */
  export async function hash(path: string): Promise<string> {
    const content = await fsReadFile(path)
    return createHash('sha256').update(content).digest('hex')
  }
}

// Default export
export default {
  fileExists,
  readFile,
  readFileBinary,
  writeFile,
  ensureDir,
  listDir,
  getFileInfo,
  isDirectory,
  isFile,
  glob,
  copy,
  remove,
  dirname,
  join,
  resolve,
  relative,
  normalizePath,
  getRelativePath,
  watchFile,
  createTempDir,
  createTempFile,
  isBinaryFile,
  safeReadFile,
  Filesystem,
}
