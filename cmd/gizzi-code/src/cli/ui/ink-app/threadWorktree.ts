import {
  isWorktreeModeEnabled,
  resolveWorktreeEnabled,
} from './utils/worktreeModeEnabled'

/**
 * Worktree resolution for the live session path (thread.ts TuiThreadCommand).
 *
 * yargs maps --worktree / --no-worktree onto a single boolean|undefined
 * `worktree` value (boolean negation is on by default); this adapts that
 * value onto the W2 resolver's (cliWorktree, cliNoWorktree) pair. The caller
 * supplies the worktree.autoCreate settings default — mirroring the commander
 * path, which reads getInitialSettings().worktree?.autoCreate at its
 * resolution call site (main-gizzi.tsx / ink-app/main.tsx).
 */
export function resolveSessionWorktreeEnabled(
  worktreeFlag: boolean | undefined,
  autoCreate: boolean | undefined,
): boolean {
  return (
    isWorktreeModeEnabled() &&
    resolveWorktreeEnabled(worktreeFlag === true, worktreeFlag === false, autoCreate)
  )
}
