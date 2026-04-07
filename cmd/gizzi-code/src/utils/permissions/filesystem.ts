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
