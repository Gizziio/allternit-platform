/**
 * Git Utilities
 */

export async function getGitRoot(cwd?: string): Promise<string | null> {
  return null
}

export async function getBranch(cwd?: string): Promise<string | null> {
  return null
}

export async function getIsGit(cwd?: string): Promise<boolean> {
  return false
}

/** Stable project root shared by every worktree of the same repo. */
export function findCanonicalGitRoot(cwd: string): string | null {
  try {
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    const { resolve } = require('node:path') as typeof import('node:path')
    const common = execSync('git rev-parse --git-common-dir', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
    if (!common) return null
    return resolve(cwd, common, '..')
  } catch {
    return null
  }
}
