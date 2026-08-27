// @ts-nocheck
import { homedir } from 'os'

/**
 * Expands tilde (~) at the start of a path to the user's home directory.
 * Note: ~username expansion is not supported for security reasons.
 */
export function expandTilde(path: string): string {
  if (
    path === '~' ||
    path.startsWith('~/') ||
    (process.platform === 'win32' && path.startsWith('~\\'))
  ) {
    return homedir() + path.slice(1)
  }
  return path
}
