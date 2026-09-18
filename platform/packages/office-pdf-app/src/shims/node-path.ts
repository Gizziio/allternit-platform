/** POSIX path shim for the browser (node:path subset used by the vendored main). */

export function join(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
}

export function dirname(path: string): string {
  const n = path.replace(/\/+$/, '')
  const idx = n.lastIndexOf('/')
  if (idx < 0) return '.'
  return idx === 0 ? '/' : n.slice(0, idx)
}

export function basename(path: string, ext?: string): string {
  const base = path.split('/').pop() ?? ''
  if (ext && base.endsWith(ext)) return base.slice(0, -ext.length)
  return base
}

export function extname(path: string): string {
  const base = basename(path)
  const idx = base.lastIndexOf('.')
  return idx > 0 ? base.slice(idx) : ''
}

export function resolve(...parts: string[]): string {
  let out = ''
  for (const part of parts) {
    if (part.startsWith('/')) out = part
    else out = out ? `${out}/${part}` : part
  }
  // collapse . and ..
  const segments: string[] = []
  for (const seg of out.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') segments.pop()
    else segments.push(seg)
  }
  return '/' + segments.join('/')
}

export function normalize(path: string): string {
  return resolve(path)
}

export const sep = '/'
export const delimiter = ':'
