// @ts-nocheck
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import {
  getAutoModeUnavailableReason,
  isAutoModeGateEnabled,
  transitionPermissionMode,
} from '../../utils/permissions/permissionSetup.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<null> {
  const { getAppState, setAppState } = context
  const current = getAppState().toolPermissionContext
  const turningOff = current.mode === 'auto'
  const nextMode = turningOff ? 'default' : 'auto'

  if (!turningOff) {
    if (!isAutoModeGateEnabled() || current.isAutoModeAvailable === false) {
      const reason = getAutoModeUnavailableReason()
      onDone(
        `Auto mode is not available${reason ? `: ${reason}` : '.'}`,
        { display: 'system' },
      )
      return null
    }
  }

  try {
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
  } catch (error) {
    onDone(
      error instanceof Error ? error.message : 'Could not switch to auto mode.',
      { display: 'system' },
    )
    return null
  }

  onDone(
    turningOff
      ? 'Auto mode off. Back to asking before tools run.'
      : 'Auto mode on. Safe tools are approved automatically; dangerous ones may still prompt. Run /auto again to turn it off.',
    { display: 'system' },
  )
  return null
}
