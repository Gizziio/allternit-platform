// @ts-nocheck
/**
 * Filesystem permissions - re-export from shared
 */
export { checkReadPermissionForTool, checkWritePermissionForTool } from '../../../shared/utils/permissions/filesystem.js'

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../../../cli/ui/ink-app/utils/permissions/filesystem.js'