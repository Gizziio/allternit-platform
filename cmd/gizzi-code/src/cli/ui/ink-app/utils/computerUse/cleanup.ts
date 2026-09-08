import type { ToolUseContext } from '../../Tool.js'

import { isLockHeldLocally, releaseComputerUseLock } from './computerUseLock.js'

/**
 * Turn-end cleanup for the chicago MCP surface: release the cross-session
 * lock (with an exit notification) when this session held it.
 *
 * The native backend also unhid apps that `prepareForAction` hid and
 * unregistered a CGEventTap Esc hotkey; the engine backend never hides host
 * apps and has no local event tap, so there is nothing to unhide and no tap
 * to unregister — the hiddenDuringTurn AppState field stays unset.
 *
 * Called from three sites: natural turn end (`stopHooks.ts`), abort during
 * streaming (`query.ts` aborted_streaming), abort during tool execution
 * (`query.ts` aborted_tools). All three reach this via dynamic import gated
 * on `feature('CHICAGO_MCP')`.
 *
 * No-ops cheaply on non-CU turns: the gate check is zero-syscall.
 */
export async function cleanupComputerUseAfterTurn(
  ctx: Pick<ToolUseContext, 'sendOSNotification'>,
): Promise<void> {
  // Zero-syscall pre-check so non-CU turns don't touch disk. Release is
  // idempotent (returns false if already released or owned by another
  // session).
  if (!isLockHeldLocally()) return

  if (await releaseComputerUseLock()) {
    ctx.sendOSNotification?.({
      message: 'Gizzi is done using your computer',
      notificationType: 'computer_use_exit',
    })
  }
}
