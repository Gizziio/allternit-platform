// @ts-nocheck
import type { LocalJSXCommandCall } from '../../types/command.js'

/**
 * /dashboard — mount the full-screen agent dashboard (Grok parity).
 *
 * The screen itself is REPL-owned (AppState.screen); the command just
 * flips it on. Keybindings: Ctrl+\ toggles, Esc/q/Ctrl+\ exit (gated by
 * DashboardScreen so inner views claim keys first).
 */
export const call: LocalJSXCommandCall = async (onDone, context, _args) => {
  if (context.options?.isNonInteractiveSession) {
    onDone('The agent dashboard is only available in the interactive TUI.', {
      display: 'system',
    })
    return null
  }
  context.setAppState(prev => ({
    ...prev,
    screen: 'dashboard',
  }))
  onDone(undefined, { display: 'skip' })
  return null
}
