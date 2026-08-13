/**
 * Allternit Extension — Keyboard Shortcuts
 *
 * Defines and manages keyboard shortcuts for the extension.
 * Chrome commands API handles the actual binding.
 */

export interface ShortcutDefinition {
  command: string
  description: string
  defaultKey: string
}

/** All keyboard shortcuts supported by the extension */
export const SHORTCUTS: ShortcutDefinition[] = [
  {
    command: 'open-sidepanel',
    description: 'Open Allternit sidepanel',
    defaultKey: 'Alt+Shift+A',
  },
  {
    command: 'capture-page',
    description: 'Capture current page for HTML→Figma',
    defaultKey: 'Alt+Shift+C',
  },
  {
    command: 'toggle-agent',
    description: 'Start/stop the current agent task',
    defaultKey: 'Alt+Shift+X',
  },
  {
    command: 'quick-task',
    description: 'Open quick task input overlay',
    defaultKey: 'Alt+Shift+T',
  },
]

/**
 * Register Chrome command listeners.
 * Call from background.ts to wire up command handling.
 */
export function registerCommandHandlers(handlers: Record<string, () => void | Promise<void>>): void {
  chrome.commands?.onCommand.addListener((command) => {
    const handler = handlers[command]
    if (handler) {
      void Promise.resolve(handler())
    }
  })
}

/** Get the currently assigned shortcut for a command (user may have customized) */
export async function getAssignedShortcut(command: string): Promise<string | null> {
  try {
    const commands = await chrome.commands.getAll()
    const match = commands.find((c) => c.name === command)
    return match?.shortcut ?? null
  } catch {
    return null
  }
}

/** Get all commands with their current key bindings */
export async function getAllShortcuts(): Promise<Array<ShortcutDefinition & { assignedKey: string | null }>> {
  try {
    const commands = await chrome.commands.getAll()
    return SHORTCUTS.map((shortcut) => {
      const chromeCmd = commands.find((c) => c.name === shortcut.command)
      return {
        ...shortcut,
        assignedKey: chromeCmd?.shortcut ?? null,
      }
    })
  } catch {
    return SHORTCUTS.map((s) => ({ ...s, assignedKey: s.defaultKey }))
  }
}
