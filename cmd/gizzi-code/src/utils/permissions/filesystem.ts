/**
 * Filesystem Permission Utilities
 */

import type { PermissionResult } from './PermissionResult.js'

export async function checkFilesystemPermission(
  path: string,
  operation: 'read' | 'write' | 'execute'
): Promise<PermissionResult> {
  return { type: 'allowed' }
}

import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Whether scratchpad isolation is active for tool execution. */
export function isScratchpadEnabled(): boolean {
  return true
}

/** Per-user scratchpad root for sandboxed tool output. */
export function getScratchpadDir(): string {
  return join(tmpdir(), `gizzi-${process.getuid?.() ?? 'user'}`)
}

/** Legacy name for the per-user temp dir used by tool output. */
export function getClaudeTempDir(): string {
  return getScratchpadDir()
}

/** Directory where session-scoped memory is persisted for this user. */
export function getSessionMemoryDir(): string {
  return join(getScratchpadDir(), 'session-memory')
}

/** Path where session-scoped memory is persisted for this user. */
export function getSessionMemoryPath(): string {
  return join(getScratchpadDir(), 'session-memory')
}
