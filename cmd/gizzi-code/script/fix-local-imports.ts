#!/usr/bin/env bun
/**
 * Fix incorrectly rewritten local imports
 * Maps types back to their correct local source files
 */

import { readFile, writeFile, readdir } from 'fs/promises'
import { resolve } from 'path'

const ROOT = resolve(process.cwd(), 'src/cli/ui/ink-app')

// Mapping of import paths to their correct local sources
// Key: the incorrect @modelcontextprotocol/sdk/types import
// Value: the correct local import path
const IMPORT_FIXES: Record<string, string> = {
  // Keybinding types
  'keybindings/match': 'keybindings/types',
  'keybindings/KeybindingProviderSetup': 'keybindings/types',
  'keybindings/loadUserBindings': 'keybindings/types',
  'keybindings/KeybindingContext': 'keybindings/types',
  'keybindings/shortcutFormat': 'keybindings/types',
  'keybindings/template': 'keybindings/types',
  'keybindings/resolver': 'keybindings/types',
  'keybindings/validate': 'keybindings/types',
  'keybindings/parser': 'keybindings/types',
  'keybindings/defaultBindings': 'keybindings/types',
  'keybindings/useShortcutDisplay': 'keybindings/types',
  'keybindings/useKeybinding': 'keybindings/types',
  
  // Bridge types
  'bridge/bridgeApi': 'bridge/types',
  'bridge/bridgeUI': 'bridge/types',
  'bridge/sessionRunner': 'bridge/types',
  'bridge/bridgeDebug': 'bridge/types',
  'bridge/replBridge': 'bridge/types',
  'bridge/initReplBridge': 'bridge/types',
  'bridge/bridgeMain': 'bridge/types',
  'bridge/workSecret': 'bridge/types',
  
  // Task types
  'tasks/InProcessTeammateTask/InProcessTeammateTask': 'tasks/InProcessTeammateTask/types',
  'tasks/pillLabel': 'tasks/types',
  
  // Tool types
  'tools/FileEditTool/utils': 'tools/FileEditTool/types',
  'tools/FileEditTool/FileEditTool': 'tools/FileEditTool/types',
  'tools/FileEditTool/UI': 'tools/FileEditTool/types',
  
  // Ink/termio types
  'ink/termio/esc': 'ink/termio/types',
  'ink/termio/osc': 'ink/termio/types',
}

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
               (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
               !entry.name.endsWith('.bak')) {
      yield path
    }
  }
}

async function fixFile(filePath: string) {
  let content = await readFile(filePath, 'utf-8')
  let modified = false
  
  // Check if this file has incorrect @modelcontextprotocol/sdk/types imports
  if (content.includes("from '@modelcontextprotocol/sdk/types'")) {
    // Determine the correct local import source based on the file path
    const relativePath = filePath.replace(ROOT + '/', '')
    
    // Extract the directory path (e.g., "keybindings/parser" from "keybindings/parser.ts")
    const dirMatch = relativePath.match(/^([^/]+\/[^/]+)\//)
    if (dirMatch) {
      const dirPrefix = dirMatch[1]
      
      // Check if we have a mapping for this directory
      if (IMPORT_FIXES[dirPrefix]) {
        // Calculate relative path from this file to the types file
        const fileDir = relativePath.substring(0, relativePath.lastIndexOf('/'))
        const typesPath = IMPORT_FIXES[dirPrefix]
        
        // Count directory levels
        const levels = fileDir.split('/').length
        const relativeImport = '../'.repeat(levels) + typesPath
        
        // Replace the import
        const original = content
        content = content.replace(
          /from '@modelcontextprotocol\/sdk\/types'/g,
          `from '${relativeImport}'`
        )
        
        if (content !== original) {
          modified = true
        }
      }
    }
  }
  
  if (modified) {
    await writeFile(filePath, content)
    console.log(`  Fixed: ${relativePath}`)
  }
}

async function main() {
  console.log('Fixing local imports...')
  
  for await (const filePath of walkDir(ROOT)) {
    await fixFile(filePath)
  }
  
  console.log('Done!')
}

main().catch(console.error)
