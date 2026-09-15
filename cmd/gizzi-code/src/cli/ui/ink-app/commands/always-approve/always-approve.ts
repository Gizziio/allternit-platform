// @ts-nocheck
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import { transitionPermissionMode } from '../../utils/permissions/permissionSetup.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<null> {
  const { getAppState, setAppState } = context
  const current = getAppState().toolPermissionContext
  const turningOff = current.mode === 'bypassPermissions'
  const nextMode = turningOff ? 'default' : 'bypassPermissions'

  if (!turningOff && !current.isBypassPermissionsModeAvailable) {
    onDone(
      'Always-approve is not available in this session. Enable bypass-permissions mode in /config or start with --dangerously-skip-permissions.',
      { display: 'system' },
    )
    return null
  }

  setAppState(prev => ({
    ...prev,
    toolPermissionContext: {
      ...transitionPermissionMode(
        prev.toolPermissionContext.mode,
        nextMode,
        prev.toolPermissionContext,
      ),
      mode: nextMode,
    },
  }))

  onDone(
    turningOff
      ? 'Always-approve off. Back to asking before tools run.'
      : 'Always-approve on. Permission prompts will be skipped. Run /always-approve again to turn it off.',
    { display: 'system' },
  )
  return null
}
