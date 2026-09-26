import { isEnvTruthy } from '../envUtils.js'

/**
 * Startup permission-mode resolution for the live TUI path.
 *
 * The yargs entrypoint (thread.ts) translates --yolo /
 * --dangerously-skip-permissions into env vars before spawning the worker and
 * calling tui(). Historically nothing in the ink-app read those vars, so the
 * TUI always seeded toolPermissionContext.mode = 'default' and kept prompting
 * even when the user passed the flag. tui() (app.tsx) now feeds these values
 * into initialPermissionModeFromCLI + initializeToolPermissionContext — the
 * same wirers the old commander entrypoint used.
 */
export type TuiPermissionModeEnv = {
  permissionModeCli: string | undefined
  dangerouslySkipPermissions: boolean
}

export function tuiPermissionModeEnv(env: {
  GIZZI_PERMISSION_MODE?: string | undefined
  GIZZI_DANGEROUSLY_SKIP_PERMISSIONS?: string | undefined
}): TuiPermissionModeEnv {
  const rawMode = env.GIZZI_PERMISSION_MODE
  return {
    // The runtime PermissionNext engine names this mode "yolo"; the ink-app
    // permission engine's equivalent is "bypassPermissions".
    permissionModeCli: rawMode === 'yolo' ? 'bypassPermissions' : rawMode,
    dangerouslySkipPermissions: isEnvTruthy(
      env.GIZZI_DANGEROUSLY_SKIP_PERMISSIONS,
    ),
  }
}

/**
 * Root/sudo guard for bypass mode, mirroring runtime/gizzi-core/setup.ts.
 * The live TUI path never runs setup(), so the guard must be repeated here.
 * Returns the refusal message when bypass must not proceed.
 */
export function bypassRefusedAsRootMessage(env: {
  IS_SANDBOX?: string | undefined
  GIZZI_BUBBLEWRAP?: string | undefined
}): string | undefined {
  if (
    process.platform !== 'win32' &&
    typeof process.getuid === 'function' &&
    process.getuid() === 0 &&
    env.IS_SANDBOX !== '1' &&
    !isEnvTruthy(env.GIZZI_BUBBLEWRAP)
  ) {
    return '--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons'
  }
  return undefined
}
