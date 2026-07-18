/**
 * Path utilities - re-export from shared
 */
export { expandPath, toRelativePath } from '../../shared/utils/path.js';
export { normalizePath } from '../../runtime/util/filesystem.js';

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../../cli/ui/ink-app/utils/path.js'