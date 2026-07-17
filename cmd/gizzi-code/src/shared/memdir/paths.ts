// Auto-generated shim to satisfy TypeScript imports
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Base directory for persistent agent memory. */
export function getMemoryBaseDir(): string {
  return join(homedir(), '.config', 'gizzi', 'memory')
}

/** Auto-memory directory for the current project context. */
export function getAutoMemPath(): string {
  return join(getMemoryBaseDir(), 'auto')
}

/** True when the given path lives under the auto-memory dir. */
export function isAutoMemPath(path: string): boolean {
  return path.startsWith(getAutoMemPath())
}

/** Entrypoint memory file loaded into context. */
export function getAutoMemEntrypoint(): string {
  return join(getAutoMemPath(), 'MEMORY.md')
}

/** Feature flag for automatic memory capture. */
export function isAutoMemoryEnabled(): boolean {
  return true
}
