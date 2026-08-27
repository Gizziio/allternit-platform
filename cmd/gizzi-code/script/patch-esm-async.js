#!/usr/bin/env bun
/**
 * Post-process a Bun bundle to fix a Bun bundler bug where an async ESM
 * init wrapper is emitted as a synchronous arrow function containing
 * top-level `await` calls (syntax error at compile time).
 *
 * The patch scans every `__esm(() => { ... })` factory. If the factory body
 * contains a top-level `await` token, it rewrites the arrow as `async`.
 * This only affects modules that were already intended to be async; the
 * missing `async` keyword is the bundler defect.
 */
import { readFileSync, writeFileSync } from 'fs'

/**
 * @param {string} code
 * @returns {{ code: string, patched: number }}
 */
export function patchEsmAsyncWrappers(code) {
  const marker = '__esm(()'
  let patched = 0
  let idx = code.indexOf(marker)

  while (idx !== -1) {
    // Find the arrow start: either `=> {` or `=>{`
    let arrowIdx = code.indexOf('=>', idx + marker.length)
    if (arrowIdx === -1) break
    // Skip whitespace to the opening brace
    let bodyStart = arrowIdx + 2
    while (bodyStart < code.length && /\s/.test(code[bodyStart])) bodyStart++
    if (code[bodyStart] !== '{') {
      idx = code.indexOf(marker, idx + 1)
      continue
    }

    let depth = 1
    let pos = bodyStart + 1
    let needsAsync = false

    while (pos < code.length && depth > 0) {
      const ch = code[pos]
      if (ch === '{') {
        depth++
      } else if (ch === '}') {
        depth--
      } else if (ch === '/' && code[pos + 1] === '/') {
        // Skip single-line comment
        pos = code.indexOf('\n', pos) + 1
        if (pos === 0) pos = code.length
        continue
      } else if (ch === '/' && code[pos + 1] === '*') {
        // Skip multi-line comment
        pos = code.indexOf('*/', pos) + 2
        if (pos === 1) pos = code.length
        continue
      } else if (ch === '"' || ch === "'" || ch === '`') {
        // Skip string literal
        const quote = ch
        pos++
        while (pos < code.length) {
          const sc = code[pos]
          if (sc === '\\') {
            pos += 2
            continue
          }
          if (sc === quote) break
          pos++
        }
      } else if (depth === 1) {
        // Top-level of factory body: look for the `await` keyword.
        if (
          code.startsWith('await', pos) &&
          !/[A-Za-z0-9_$]/.test(code[pos - 1] || '') &&
          !/[A-Za-z0-9_$]/.test(code[pos + 5] || '')
        ) {
          needsAsync = true
        }
      }
      pos++
    }

    if (needsAsync) {
      // Insert `async` right after `__esm(` so `(() => { ... })` becomes `(async () => { ... })`
      const insertAt = idx + 6 // after `__esm(`
      code = code.slice(0, insertAt) + 'async ' + code.slice(insertAt)
      patched++
    }

    idx = code.indexOf(marker, idx + 1)
  }

  return { code, patched }
}

if (import.meta.main) {
  const bundlePath = process.argv[2]
  if (!bundlePath) {
    console.error('Usage: bun script/patch-esm-async.js <bundle.js>')
    process.exit(1)
  }

  const original = readFileSync(bundlePath, 'utf8')
  const { code, patched } = patchEsmAsyncWrappers(original)
  writeFileSync(bundlePath, code)
  console.log(`Patched ${patched} async ESM wrappers in ${bundlePath}`)
}
