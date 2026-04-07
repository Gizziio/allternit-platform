#!/usr/bin/env bun
/**
 * Production-quality MCP SDK vendoring script
 * 
 * This script:
 * 1. Copies @modelcontextprotocol/sdk from node_modules to vendor/
 * 2. Updates all imports to use the vendored path
 * 3. Updates tsconfig.json with proper path mappings
 */

import { readdir, readFile, writeFile, copyFile, mkdir, rm } from 'fs/promises'
import { resolve, dirname, relative, join } from 'path'

const ROOT = resolve(process.cwd())
const SRC_DIR = resolve(ROOT, 'src/cli/ui/ink-app')
const VENDOR_DIR = resolve(SRC_DIR, 'vendor/@modelcontextprotocol/sdk')
const NODE_MODULES_SDK = resolve(ROOT, 'node_modules/@modelcontextprotocol/sdk')

// SDK subpath imports that need to be rewritten
const SDK_IMPORTS = [
  '@modelcontextprotocol/sdk/client',
  '@modelcontextprotocol/sdk/client/sse',
  '@modelcontextprotocol/sdk/client/stdio',
  '@modelcontextprotocol/sdk/client/streamableHttp',
  '@modelcontextprotocol/sdk/client/auth',
  '@modelcontextprotocol/sdk/server',
  '@modelcontextprotocol/sdk/server/auth/errors',
  '@modelcontextprotocol/sdk/shared',
  '@modelcontextprotocol/sdk/shared/auth',
  '@modelcontextprotocol/sdk/types',
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

function getRelativePath(fromFile: string, toFile: string): string {
  const fromDir = dirname(fromFile)
  let relPath = relative(fromDir, toFile)
  
  // Ensure it starts with ./ or ../
  if (!relPath.startsWith('.')) {
    relPath = './' + relPath
  }
  
  // Remove .ts extension for imports
  relPath = relPath.replace(/\.ts$/, '')
  
  return relPath
}

async function copySdk() {
  console.log('Copying MCP SDK to vendor directory...')
  
  // Clean and recreate vendor directory
  await rm(VENDOR_DIR, { recursive: true, force: true })
  await mkdir(VENDOR_DIR, { recursive: true })
  
  // Copy only the ESM dist files we need
  const copyRecursive = async (src: string, dest: string) => {
    const entries = await readdir(src, { withFileTypes: true })
    await mkdir(dest, { recursive: true })
    
    for (const entry of entries) {
      const srcPath = join(src, entry.name)
      const destPath = join(dest, entry.name)
      
      if (entry.isDirectory()) {
        await copyRecursive(srcPath, destPath)
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.json')) {
        await copyFile(srcPath, destPath)
      }
    }
  }
  
  // Copy dist/esm and package.json
  await copyRecursive(resolve(NODE_MODULES_SDK, 'dist/esm'), resolve(VENDOR_DIR, 'dist/esm'))
  await copyFile(resolve(NODE_MODULES_SDK, 'package.json'), resolve(VENDOR_DIR, 'package.json'))
  
  console.log('SDK copied successfully')
}

async function fixImportsInFile(filePath: string) {
  let content = await readFile(filePath, 'utf-8')
  let modified = false
  
  for (const importPath of SDK_IMPORTS) {
    // Create regex that matches the import (with or without .js extension)
    const escapedPath = importPath.replace(/\//g, '\\/')
    const pattern = new RegExp(
      `from ['"]${escapedPath}(?:\.js)?['"]`,
      'g'
    )
    
    if (pattern.test(content)) {
      // Map to vendored path
      const subpath = importPath.replace('@modelcontextprotocol/sdk/', '')
      const vendoredFile = resolve(VENDOR_DIR, 'dist/esm', subpath + '.ts')
      const relativePath = getRelativePath(filePath, vendoredFile)
      
      content = content.replace(pattern, `from '${relativePath}'`)
      modified = true
    }
  }
  
  if (modified) {
    await writeFile(filePath, content)
    console.log(`  Fixed: ${relative(ROOT, filePath)}`)
  }
}

async function updateTsConfig() {
  console.log('\nUpdating tsconfig.json...')
  
  const tsconfigPath = resolve(SRC_DIR, 'tsconfig.json')
  const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf-8'))
  
  // Add path mappings for the vendored SDK
  tsconfig.compilerOptions = tsconfig.compilerOptions || {}
  tsconfig.compilerOptions.paths = {
    ...tsconfig.compilerOptions.paths,
    "@modelcontextprotocol/sdk/*": ["./vendor/@modelcontextprotocol/sdk/dist/esm/*"]
  }
  
  await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2))
  console.log('tsconfig.json updated')
}

async function fixSdkInternalImports() {
  console.log('\nFixing SDK internal imports...')
  
  // The vendored SDK uses .js extensions in imports, change to .ts
  for await (const filePath of walkDir(VENDOR_DIR)) {
    let content = await readFile(filePath, 'utf-8')
    
    // Replace .js imports with .ts (but not for external packages)
    const original = content
    content = content.replace(/from ['"](\.\/[^'"]+)\.js['"]/g, "from '$1'")
    content = content.replace(/from ['"](\.\.\/[^'"]+)\.js['"]/g, "from '$1'")
    
    if (content !== original) {
      await writeFile(filePath, content)
    }
  }
  
  console.log('SDK internal imports fixed')
}

async function main() {
  console.log('='.repeat(60))
  console.log('Vendoring @modelcontextprotocol/sdk')
  console.log('='.repeat(60))
  
  await copySdk()
  await fixSdkInternalImports()
  
  console.log('\nFixing imports in source files...')
  let count = 0
  for await (const filePath of walkDir(SRC_DIR)) {
    await fixImportsInFile(filePath)
    count++
  }
  console.log(`  Processed ${count} files`)
  
  await updateTsConfig()
  
  console.log('\n' + '='.repeat(60))
  console.log('Done! MCP SDK vendored successfully.')
  console.log('='.repeat(60))
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
