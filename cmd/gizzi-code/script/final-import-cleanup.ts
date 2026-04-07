#!/usr/bin/env bun
/**
 * Final comprehensive import cleanup script
 * Fixes all broken imports to use proper paths
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { resolve, dirname, relative } from 'path'

const ROOT = resolve(process.cwd())
const SRC_DIR = resolve(ROOT, 'src/cli/ui/ink-app')

// Patterns to fix and their replacements
const FIXES: Array<{ pattern: RegExp; replacement: string }> = [
  // Fix mcp-sdk relative imports to use @modelcontextprotocol/sdk
  {
    pattern: /from ['"](?:\.\.\/)*mcp-sdk\/([^'"]+)['"]/g,
    replacement: "from '@modelcontextprotocol/sdk/$1'"
  },
  // Fix vendor imports to use @modelcontextprotocol/sdk
  {
    pattern: /from ['"](?:\.\.\/)*vendor\/\@modelcontextprotocol\/sdk\/dist\/esm\/([^'"]+)['"]/g,
    replacement: "from '@modelcontextprotocol/sdk/$1'"
  },
  // Fix @anthropic-ai/sandbox-runtime to use package import
  {
    pattern: /from ['"](?:\.\.\/)*vendor\/\@anthropic-ai\/sandbox-runtime['"]/g,
    replacement: "from '@anthropic-ai/sandbox-runtime'"
  },
]

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory() && 
        !entry.name.startsWith('.') && 
        entry.name !== 'node_modules' && 
        entry.name !== 'vendor') {
      yield* walkDir(path)
    } else if (entry.isFile() && 
               (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      yield path
    }
  }
}

async function fixFile(filePath: string) {
  let content = await readFile(filePath, 'utf-8')
  let modified = false
  
  for (const { pattern, replacement } of FIXES) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement)
      modified = true
    }
  }
  
  if (modified) {
    await writeFile(filePath, content)
    console.log(`  Fixed: ${relative(ROOT, filePath)}`)
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('Final Import Cleanup')
  console.log('='.repeat(60))
  
  let count = 0
  for await (const filePath of walkDir(SRC_DIR)) {
    await fixFile(filePath)
    count++
  }
  
  console.log(`\nProcessed ${count} files`)
  console.log('='.repeat(60))
}

main().catch(console.error)
