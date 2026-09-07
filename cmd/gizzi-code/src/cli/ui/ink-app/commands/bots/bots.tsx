// @ts-nocheck
import type { LocalJSXCommandCall } from '../../types/command.js'

/**
 * /bots — mount the full-screen bots roster pane (Phase B5).
 *
 * The screen itself is REPL-owned (AppState.screen), same as /dashboard;
 * the command just flips it on. Keys: ↑/↓ select, Enter open canonical
 * chat, n create, d delete (inline y/n), r refresh, q/Esc back.
 */
export const call: LocalJSXCommandCall = async (onDone, context, _args) => {
  if (context.options?.isNonInteractiveSession) {
    onDone('The bots pane is only available in the interactive TUI.', {
      display: 'system',
    })
    return null
  }
  context.setAppState(prev => ({
    ...prev,
    screen: 'bots',
  }))
  onDone(undefined, { display: 'skip' })
  return null
}
