#!/usr/bin/env bun
/**
 * Pre-build script to inline MCP SDK into source files
 * This copies the vendor MCP SDK files and updates imports to use them
 */

import { readdir, readFile, writeFile, copyFile, mkdir } from 'fs/promises'
import { resolve, dirname, relative } from 'path'

const VENDOR_DIR = resolve(process.cwd(), 'src/cli/ui/ink-app/vendor/@modelcontextprotocol/sdk/dist/esm')
const OUTPUT_DIR = resolve(process.cwd(), 'src/cli/ui/ink-app/mcp-sdk')

// Calculate the relative path from a source file to the mcp-sdk directory
function getMcpSdkPath(sourceFile: string): string {
  const sourceDir = dirname(sourceFile)
  const relPath = relative(sourceDir, OUTPUT_DIR)
  return relPath.startsWith('.') ? relPath : './' + relPath
}

// Import names to their subpaths
const importSubpaths: Record<string, string> = {
  'client/index': 'client/index.ts',
  'client/sse': 'client/sse.ts',
  'client/stdio': 'client/stdio.ts',
  'client/streamableHttp': 'client/streamableHttp.ts',
  'client/auth': 'client/auth.ts',
  'server/index': 'server/index.ts',
  'server/auth/errors': 'server/auth/errors.ts',
  'shared/index': 'shared/index.ts',
  'shared/auth': 'shared/auth.ts',
  'types': 'types.ts',
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'mcp-sdk' && entry.name !== 'vendor') {
      yield* walkDir(path)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      yield path
    }
  }
}

async function inlineImports(filePath: string) {
  let content = await readFile(filePath, 'utf-8')
  let modified = false
  
  // Get the correct relative path from this file to mcp-sdk
  const mcpSdkBase = getMcpSdkPath(filePath)
  
  // Replace vendor imports with correct relative paths
  for (const [importName, subpath] of Object.entries(importSubpaths)) {
    // Match various patterns of vendor imports
    const patterns = [
      new RegExp(`from ['"](?:.*?/)?vendor/@modelcontextprotocol/sdk/dist/esm/${importName.replace(/\//g, '\\/')}(?:\.ts)?['"]`, 'g'),
      new RegExp(`from ['"]\\./${importName}['"]`, 'g'),
    ]
    
    const newImport = `${mcpSdkBase}/${subpath.replace(/\.ts$/, '')}`
    
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, `from '${newImport}'`)
        modified = true
      }
    }
  }
  
  if (modified) {
    await writeFile(filePath, content)
    console.log(`Updated imports in: ${filePath}`)
  }
}

async function copyMcpSdk() {
  // Create output directory structure
  for (const subpath of Object.values(importSubpaths)) {
    const dir = dirname(resolve(OUTPUT_DIR, subpath))
    await mkdir(dir, { recursive: true })
  }
  
  // Copy all files
  for (const [importName, subpath] of Object.entries(importSubpaths)) {
    const src = resolve(VENDOR_DIR, subpath)
    const dest = resolve(OUTPUT_DIR, subpath)
    try {
      await copyFile(src, dest)
      console.log(`Copied: ${subpath}`)
    } catch (e) {
      console.error(`Failed to copy ${subpath}: ${e}`)
    }
  }
}

async function main() {
  const srcDir = resolve(process.cwd(), 'src/cli/ui/ink-app')
  
  console.log('Copying MCP SDK...')
  await copyMcpSdk()
  
  console.log('\nInlining MCP SDK imports...')
  for await (const filePath of walkDir(srcDir)) {
    await inlineImports(filePath)
  }
  
  console.log('\nDone!')
}

main().catch(console.error)
