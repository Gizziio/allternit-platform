#!/usr/bin/env node
/**
 * Copies plugin skill files from the platform app into the add-in's public/
 * directory so they are bundled and served alongside the add-in.
 *
 * Run automatically via npm prebuild / predev.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const SOURCE_DIR = join(__dirname, '../../../ai.allternit.com/src/plugins/built-in')
const DEST_DIR = join(__dirname, '../public/plugins')

const PLUGINS = ['office-excel', 'office-word', 'office-powerpoint']

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function copyRecursive(src, dest) {
  const stat = statSync(src)
  if (stat.isDirectory()) {
    ensureDir(dest)
    for (const entry of readdirSync(src)) {
      copyRecursive(join(src, entry), join(dest, entry))
    }
  } else {
    copyFileSync(src, dest)
  }
}

let copied = 0

for (const plugin of PLUGINS) {
  const src = join(SOURCE_DIR, plugin)
  const dest = join(DEST_DIR, plugin)

  if (!existsSync(src)) {
    console.warn(`[copy-plugin-skills] Source not found: ${relative(__dirname, src)}`)
    continue
  }

  ensureDir(dest)
  copyRecursive(src, dest)
  copied++
}

console.log(`[copy-plugin-skills] Copied ${copied} plugin(s) to public/plugins/`)
