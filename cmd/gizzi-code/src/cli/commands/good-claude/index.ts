/**
 * good-claude command
 * Utility for acknowledging helpful AI interactions
 * Can be integrated with feedback/reward systems
 */

import { log } from '../../utils/log.js'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const GOOD_CLAUDES_DIR = join(homedir(), '.config', 'gizzi', 'good-claudes')

export interface GoodClaudeEntry {
  id: string
  timestamp: number
  context: string
  message?: string
  sessionId?: string
}

/**
 * Record a "good claude" interaction
 */
export async function recordGoodClaude(
  context: string,
  message?: string,
  sessionId?: string
): Promise<GoodClaudeEntry> {
  // Ensure directory exists
  if (!existsSync(GOOD_CLAUDES_DIR)) {
    mkdirSync(GOOD_CLAUDES_DIR, { recursive: true })
  }
  
  const entry: GoodClaudeEntry = {
    id: `gc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    context,
    message,
    sessionId,
  }
  
  const filePath = join(GOOD_CLAUDES_DIR, `${entry.id}.json`)
  writeFileSync(filePath, JSON.stringify(entry, null, 2))
  
  return entry
}

/**
 * Get recent good claude entries
 */
export async function getRecentEntries(limit = 10): Promise<GoodClaudeEntry[]> {
  const { readdirSync, readFileSync } = await import('fs')
  
  if (!existsSync(GOOD_CLAUDES_DIR)) {
    return []
  }
  
  const files = readdirSync(GOOD_CLAUDES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      time: parseInt(f.split('-')[1]) || 0,
    }))
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
  
  const entries: GoodClaudeEntry[] = []
  for (const file of files) {
    try {
      const content = readFileSync(join(GOOD_CLAUDES_DIR, file.name), 'utf-8')
      entries.push(JSON.parse(content))
    } catch {
      // Skip invalid files
    }
  }
  
  return entries
}

/**
 * Show usage help
 */
function showHelp(): void {
  console.log(`
good-claude - Record helpful AI interactions

Usage:
  gizzi good-claude                    Record a good interaction
  gizzi good-claude --message "..."    Add a message
  gizzi good-claude --context "..."    Specify context
  gizzi good-claude --recent           Show recent entries
  gizzi good-claude --stats            Show statistics

Options:
  -m, --message <text>    Add a descriptive message
  -c, --context <text>    Specify the context (e.g., "code-review", "debugging")
  -r, --recent            Show recent entries
  -s, --stats             Show statistics
  -h, --help              Show this help

Examples:
  gizzi good-claude --context debugging --message "Helped fix a tricky race condition"
  gizzi good-claude --recent
`)
}

/**
 * Show recent entries
 */
async function showRecent(): Promise<void> {
  const entries = await getRecentEntries(10)
  
  if (entries.length === 0) {
    log('info', 'No good claude entries yet')
    log('info', 'Use `gizzi good-claude` to record one')
    return
  }
  
  console.log('Recent good claude interactions:')
  console.log('')
  
  for (const entry of entries) {
    const date = new Date(entry.timestamp).toLocaleString()
    console.log(`  ${date}`)
    console.log(`    Context: ${entry.context}`)
    if (entry.message) {
      console.log(`    Message: ${entry.message}`)
    }
    console.log('')
  }
}

/**
 * Show statistics
 */
async function showStats(): Promise<void> {
  const { readdirSync } = await import('fs')
  
  if (!existsSync(GOOD_CLAUDES_DIR)) {
    log('info', 'No good claude entries yet')
    return
  }
  
  const files = readdirSync(GOOD_CLAUDES_DIR).filter(f => f.endsWith('.json'))
  
  // Count by context
  const contextCounts: Record<string, number> = {}
  const entries: GoodClaudeEntry[] = []
  
  for (const file of files) {
    try {
      const { readFileSync } = await import('fs')
      const content = readFileSync(join(GOOD_CLAUDES_DIR, file), 'utf-8')
      const entry: GoodClaudeEntry = JSON.parse(content)
      entries.push(entry)
      contextCounts[entry.context] = (contextCounts[entry.context] || 0) + 1
    } catch {
      // Skip invalid files
    }
  }
  
  // Find date range
  const timestamps = entries.map(e => e.timestamp).sort((a, b) => a - b)
  const firstDate = timestamps.length > 0 ? new Date(timestamps[0]) : null
  const lastDate = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]) : null
  
  console.log('Good Claude Statistics')
  console.log('═══════════════════════')
  console.log('')
  console.log(`Total entries: ${files.length}`)
  
  if (firstDate && lastDate) {
    console.log(`First entry: ${firstDate.toLocaleDateString()}`)
    console.log(`Last entry: ${lastDate.toLocaleDateString()}`)
  }
  
  if (Object.keys(contextCounts).length > 0) {
    console.log('')
    console.log('By context:')
    for (const [context, count] of Object.entries(contextCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${context}: ${count}`)
    }
  }
}

/**
 * Execute good-claude command
 */
export default async function goodClaudeCommand(args: string[] = []): Promise<void> {
  // Parse arguments
  const help = args.includes('--help') || args.includes('-h')
  const recent = args.includes('--recent') || args.includes('-r')
  const stats = args.includes('--stats') || args.includes('-s')
  
  if (help) {
    showHelp()
    return
  }
  
  if (recent) {
    await showRecent()
    return
  }
  
  if (stats) {
    await showStats()
    return
  }
  
  // Extract message and context
  let message: string | undefined
  let context = 'general'
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if ((arg === '--message' || arg === '-m') && i + 1 < args.length) {
      message = args[++i]
    } else if ((arg === '--context' || arg === '-c') && i + 1 < args.length) {
      context = args[++i]
    }
  }
  
  // Record the entry
  const entry = await recordGoodClaude(context, message)
  
  log('success', 'Recorded good claude interaction ✓')
  log('info', `ID: ${entry.id}`)
  log('info', `Context: ${entry.context}`)
  if (entry.message) {
    log('info', `Message: ${entry.message}`)
  }
}

export { recordGoodClaude, getRecentEntries }
