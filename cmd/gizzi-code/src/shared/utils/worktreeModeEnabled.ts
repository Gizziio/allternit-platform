/**
 * Worktree mode is now unconditionally enabled for all users.
 *
 * Previously gated by GrowthBook flag 'tengu_worktree_mode', but the
 * CACHED_MAY_BE_STALE pattern returns the default (false) on first launch
 * before the cache is populated, silently swallowing --worktree.
 * See https://github.com/Gizziio/allternit-platform/issues/27044.
 */
export function isWorktreeModeEnabled(): boolean {
  return true
}

/**
 * Resolves whether a session should create a git worktree, combining the CLI
 * flags with the `worktree.autoCreate` settings default.
 *
 * Precedence: explicit --worktree beats everything, explicit --no-worktree
 * beats the settings default, and with both absent the setting applies.
 * autoCreate defaults to false, so behavior is unchanged unless opted in.
 */
export function resolveWorktreeEnabled(
  cliWorktree: boolean,
  cliNoWorktree: boolean,
  autoCreate: boolean | undefined,
): boolean {
  if (cliWorktree) return true
  if (cliNoWorktree) return false
  return autoCreate ?? false
}
