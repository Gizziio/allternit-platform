/**
 * File utilities - re-export from ink-app
 */

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export * from '../../cli/ui/ink-app/utils/file.js'
// Line-number helpers live in their own module to avoid a config/growthbook
// import cycle; re-export them here so existing callers keep working.
export * from '../../cli/ui/ink-app/utils/fileLineNumbers.js'