// @ts-nocheck
/**
 * Path-in-working-path check and helpers.
 *
 * Extracted from permissions/filesystem.ts so modules that only need this
 * check (e.g. gizzimd.ts) can import it without pulling in the full
 * permission system and its circular dependencies.
 */
import { posix } from 'path'
import { containsPathTraversal, expandPath } from '../path.js'
import { getPlatform } from '../platform.js'
import { windowsPathToPosixPath } from '../windowsPaths.js'

/**
 * Converts a path to POSIX format for pattern matching.
 * Handles Windows path conversion internally.
 */
export function toPosixPath(path: string): string {
  if (getPlatform() === 'windows') {
    return windowsPathToPosixPath(path)
  }
  return path
}

/**
 * Normalizes a path for case-insensitive comparison.
 * This prevents bypassing security checks using mixed-case paths on case-insensitive
 * filesystems (macOS/Windows) like `.cLauDe/Settings.locaL.json`.
 *
 * We always normalize to lowercase regardless of platform for consistent security.
 */
export function normalizeCaseForComparison(path: string): string {
  return path.toLowerCase()
}

/**
 * Cross-platform relative path calculation that returns POSIX-style paths.
 * Handles Windows path conversion internally.
 */
export function relativePath(from: string, to: string): string {
  if (getPlatform() === 'windows') {
    // Convert Windows paths to POSIX for consistent comparison
    const posixFrom = windowsPathToPosixPath(from)
    const posixTo = windowsPathToPosixPath(to)
    return posix.relative(posixFrom, posixTo)
  }
  // Use POSIX paths directly
  return posix.relative(from, to)
}

/**
 * Returns true when `path` is inside `workingPath`.
 * Handles macOS /private symlinks and case-insensitive filesystems.
 */
export function pathInWorkingPath(path: string, workingPath: string): boolean {
  const absolutePath = expandPath(path)
  const absoluteWorkingPath = expandPath(workingPath)

  // On macOS, handle common symlink issues:
  // - /var -> /private/var
  // - /tmp -> /private/tmp
  const normalizedPath = absolutePath
    .replace(/^\/private\/var\//, '/var/')
    .replace(/^\/private\/tmp(\/|$)/, '/tmp$1')
  const normalizedWorkingPath = absoluteWorkingPath
    .replace(/^\/private\/var\//, '/var/')
    .replace(/^\/private\/tmp(\/|$)/, '/tmp$1')

  // Normalize case for case-insensitive comparison to prevent bypassing security
  // checks on case-insensitive filesystems (macOS/Windows) like .cLauDe/CoMmAnDs
  const caseNormalizedPath = normalizeCaseForComparison(normalizedPath)
  const caseNormalizedWorkingPath = normalizeCaseForComparison(
    normalizedWorkingPath,
  )

  // Use cross-platform relative path helper
  const relative = relativePath(caseNormalizedWorkingPath, caseNormalizedPath)

  // Same path
  if (relative === '') {
    return true
  }

  if (containsPathTraversal(relative)) {
    return false
  }

  // Path is inside (relative path that doesn't go up)
  return !posix.isAbsolute(relative)
}
