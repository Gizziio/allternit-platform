#!/usr/bin/env bun
/**
 * Pre-build script to fix MCP SDK imports
 * Replaces @modelcontextprotocol/sdk/* imports with relative paths to mcp-sdk
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { resolve, dirname, relative } from 'path'

// Import subpaths we need to fix
const importSubpaths = [
  'client/index',
  'client/sse',
  'client/stdio',
  'client/streamableHttp',
  'client/auth',
  'server/index',
  'server/auth/errors',
  'shared/index',
  'shared/auth',
  'types',
]

// Calculate the relative path from a source file to mcp-sdk
function getMcpSdkPath(sourceFile: string): string {
  const sourceDir = dirname(sourceFile)
  const mcpSdkDir = resolve(process.cwd(), 'src/cli/ui/ink-app/mcp-sdk')
  const relPath = relative(sourceDir, mcpSdkDir)
  return relPath.startsWith('.') ? relPath : './' + relPath
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'mcp-sdk') {
      yield* walkDir(path)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      yield path
    }
  }
}

async function fixImports(filePath: string) {
  let content = await readFile(filePath, 'utf-8')
  let modified = false
  
  // Get the correct relative path from this file to mcp-sdk
  const mcpSdkBase = getMcpSdkPath(filePath)
  
  // Fix original SDK imports (@modelcontextprotocol/sdk/...)
  for (const subpath of importSubpaths) {
    const pattern = new RegExp(`from ['"]@modelcontextprotocol/sdk/${subpath}['"]`, 'g')
    const newImport = `from '${mcpSdkBase}/${subpath}'`
    if (pattern.test(content)) {
      content = content.replace(pattern, newImport)
      modified = true
    }
  }
  
  // Fix vendor imports (various relative paths to vendor)
  const vendorPattern = /from ['"](?:\.\.\/)*vendor\/@modelcontextprotocol\/sdk\/[^'"]+['"]/g
  if (vendorPattern.test(content)) {
    content = content.replace(vendorPattern, (match) => {
      // Extract the subpath after sdk/
      const subpathMatch = match.match(/sdk\/(dist\/esm\/)?([^'"]+)/)
      if (subpathMatch) {
        const subpath = subpathMatch[2].replace(/\.ts$/, '')
        return `from '${mcpSdkBase}/${subpath}'`
      }
      return match
    })
    modified = true
  }
  
  if (modified) {
    await writeFile(filePath, content)
    console.log(`Fixed imports in: ${filePath}`)
  }
}

async function main() {
  const srcDir = resolve(process.cwd(), 'src/cli/ui/ink-app')
  
  console.log('Fixing MCP SDK imports...')
  
  for await (const filePath of walkDir(srcDir)) {
    await fixImports(filePath)
  }
  
  console.log('Done!')
}

main().catch(console.error)
