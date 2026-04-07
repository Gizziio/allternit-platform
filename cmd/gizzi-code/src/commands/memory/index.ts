/**
 * Memory Command
 * Production-quality memory management for conversations
 */

import { readFile, writeFile, access, constants, unlink } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { log } from '../../cli/utils/log.js'

export interface MemoryEntry {
  id: string
  timestamp: number
  content: string
  tags?: string[]
  importance?: 'low' | 'medium' | 'high'
}

export interface MemoryFile {
  version: string
  entries: MemoryEntry[]
  lastModified: number
}

const MEMORY_VERSION = '1.0'

/**
 * Get memory file path
 */
function getMemoryPath(): string {
  return join(homedir(), '.config', 'gizzi', 'memory.json')
}

/**
 * Load memory from file
 */
export async function loadMemory(): Promise<MemoryFile> {
  try {
    const data = await readFile(getMemoryPath(), 'utf8')
    const memory: MemoryFile = JSON.parse(data)
    return memory
  } catch {
    // Return empty memory
    return {
      version: MEMORY_VERSION,
      entries: [],
      lastModified: Date.now(),
    }
  }
}

/**
 * Save memory to file
 */
export async function saveMemory(memory: MemoryFile): Promise<void> {
  memory.lastModified = Date.now()
  await writeFile(getMemoryPath(), JSON.stringify(memory, null, 2))
}

/**
 * Add a memory entry
 */
export async function addMemory(
  content: string,
  options: { tags?: string[]; importance?: MemoryEntry['importance'] } = {}
): Promise<MemoryEntry> {
  const memory = await loadMemory()
  
  const entry: MemoryEntry = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    content,
    tags: options.tags || [],
    importance: options.importance || 'medium',
  }
  
  memory.entries.push(entry)
  
  // Sort by importance and timestamp
  memory.entries.sort((a, b) => {
    const importanceOrder = { high: 0, medium: 1, low: 2 }
    const impDiff = importanceOrder[a.importance || 'medium'] - importanceOrder[b.importance || 'medium']
    if (impDiff !== 0) return impDiff
    return b.timestamp - a.timestamp
  })
  
  // Keep only last 1000 entries
  if (memory.entries.length > 1000) {
    memory.entries = memory.entries.slice(0, 1000)
  }
  
  await saveMemory(memory)
  return entry
}

/**
 * Search memory entries
 */
export async function searchMemory(query: string): Promise<MemoryEntry[]> {
  const memory = await loadMemory()
  const lowerQuery = query.toLowerCase()
  
  return memory.entries.filter(entry => {
    return (
      entry.content.toLowerCase().includes(lowerQuery) ||
      entry.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  })
}

/**
 * Delete a memory entry
 */
export async function deleteMemory(id: string): Promise<boolean> {
  const memory = await loadMemory()
  const initialLength = memory.entries.length
  
  memory.entries = memory.entries.filter(entry => entry.id !== id)
  
  if (memory.entries.length < initialLength) {
    await saveMemory(memory)
    return true
  }
  
  return false
}

/**
 * Clear all memory
 */
export async function clearMemory(): Promise<void> {
  const memory: MemoryFile = {
    version: MEMORY_VERSION,
    entries: [],
    lastModified: Date.now(),
  }
  await saveMemory(memory)
}

/**
 * Get memory stats
 */
export async function getMemoryStats(): Promise<{
  total: number
  byImportance: Record<string, number>
  byTag: Record<string, number>
}> {
  const memory = await loadMemory()
  
  const byImportance: Record<string, number> = {}
  const byTag: Record<string, number> = {}
  
  for (const entry of memory.entries) {
    const imp = entry.importance || 'medium'
    byImportance[imp] = (byImportance[imp] || 0) + 1
    
    for (const tag of entry.tags || []) {
      byTag[tag] = (byTag[tag] || 0) + 1
    }
  }
  
  return {
    total: memory.entries.length,
    byImportance,
    byTag,
  }
}

/**
 * Execute memory command
 */
export default async function memoryCommand(args: string[]): Promise<void> {
  const subcommand = args[0] || 'list'
  
  try {
    switch (subcommand) {
      case 'list':
      case 'show': {
        const memory = await loadMemory()
        const limit = parseInt(args[1]) || 10
        
        if (memory.entries.length === 0) {
          log('info', 'No memories stored')
          return
        }
        
        log('info', `Showing last ${Math.min(limit, memory.entries.length)} memories:`)
        for (const entry of memory.entries.slice(0, limit)) {
          const date = new Date(entry.timestamp).toLocaleDateString()
          const tags = entry.tags?.length ? ` [${entry.tags.join(', ')}]` : ''
          log('info', `[${date}]${tags} ${entry.content.substring(0, 100)}...`)
        }
        break
      }
      
      case 'add': {
        const content = args.slice(1).join(' ')
        if (!content) {
          log('error', 'Please provide content to remember')
          return
        }
        const entry = await addMemory(content)
        log('success', `Added memory: ${entry.id}`)
        break
      }
      
      case 'search': {
        const query = args.slice(1).join(' ')
        if (!query) {
          log('error', 'Please provide a search query')
          return
        }
        const results = await searchMemory(query)
        if (results.length === 0) {
          log('info', 'No memories found')
          return
        }
        log('info', `Found ${results.length} memories:`)
        for (const entry of results) {
          log('info', `- ${entry.content.substring(0, 100)}...`)
        }
        break
      }
      
      case 'delete': {
        const id = args[1]
        if (!id) {
          log('error', 'Please provide a memory ID')
          return
        }
        const deleted = await deleteMemory(id)
        if (deleted) {
          log('success', `Deleted memory: ${id}`)
        } else {
          log('error', `Memory not found: ${id}`)
        }
        break
      }
      
      case 'clear': {
        await clearMemory()
        log('success', 'All memories cleared')
        break
      }
      
      case 'stats': {
        const stats = await getMemoryStats()
        log('info', `Total memories: ${stats.total}`)
        log('info', 'By importance:', stats.byImportance)
        log('info', 'By tag:', stats.byTag)
        break
      }
      
      default:
        log('error', `Unknown subcommand: ${subcommand}`)
        log('info', 'Available: list, add, search, delete, clear, stats')
    }
  } catch (error) {
    if (error instanceof Error) {
      log('error', `Memory command failed: ${error.message}`)
    } else {
      log('error', 'Memory command failed with unknown error')
    }
  }
}

export { loadMemory, saveMemory, addMemory, searchMemory, deleteMemory, clearMemory, getMemoryStats }
