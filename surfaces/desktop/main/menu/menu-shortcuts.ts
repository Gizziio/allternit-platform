/**
 * @fileoverview Menu Shortcuts Definitions
 * @module main/menu/menu-shortcuts
 * 
 * Centralized keyboard shortcut definitions for application menus.
 * Ensures consistency across all platforms.
 * 
 * @author T3-A2: Native Menus specialist
 * @version 1.0.0
 */

/**
 * Accelerator shortcut definitions
 * Using Electron's accelerator format: https://www.electronjs.org/docs/latest/api/accelerator
 */
export const Shortcuts = {
  // Application
  app: {
    preferences: 'CmdOrCtrl+,',
    quit: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
    hide: 'Command+H',
    hideOthers: 'Command+Shift+H',
  },

  // File
  file: {
    newChat: 'CmdOrCtrl+N',
    newWindow: 'CmdOrCtrl+Shift+N',
    open: 'CmdOrCtrl+O',
    save: 'CmdOrCtrl+S',
    saveAs: 'CmdOrCtrl+Shift+S',
    closeTab: 'CmdOrCtrl+W',
  },

  // Edit
  edit: {
    undo: 'CmdOrCtrl+Z',
    redo: 'Shift+CmdOrCtrl+Z',
    cut: 'CmdOrCtrl+X',
    copy: 'CmdOrCtrl+C',
    paste: 'CmdOrCtrl+V',
    pasteAndMatchStyle: 'CmdOrCtrl+Shift+V',
    selectAll: 'CmdOrCtrl+A',
    find: 'CmdOrCtrl+F',
    findNext: 'CmdOrCtrl+G',
    findPrevious: 'Shift+CmdOrCtrl+G',
  },

  // View
  view: {
    reload: 'CmdOrCtrl+R',
    forceReload: 'CmdOrCtrl+Shift+R',
    toggleDevTools: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
    actualSize: 'CmdOrCtrl+0',
    zoomIn: 'CmdOrCtrl+Plus',
    zoomOut: 'CmdOrCtrl+-',
    toggleFullScreen: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
  },

  // Agent
  agent: {
    newSession: 'CmdOrCtrl+Shift+A',
    stop: 'Escape',
    openPanel: 'CmdOrCtrl+Shift+P',
    viewWorkflows: 'CmdOrCtrl+Shift+W',
  },

  // Window
  window: {
    newWindow: 'CmdOrCtrl+Shift+N',
    minimize: 'CmdOrCtrl+M',
    close: 'CmdOrCtrl+W',
    switchWindow: (index: number): string | undefined => {
      return index >= 1 && index <= 9 ? `CmdOrCtrl+${index}` : undefined;
    },
  },

  // Help
  help: {
    keyboardShortcuts: 'CmdOrCtrl+/',
  },
} as const;

/**
 * Platform-specific shortcut overrides
 */
export const PlatformShortcuts = {
  darwin: {
    // macOS specific shortcuts
    app: {
      preferences: 'Cmd+,',
      quit: 'Cmd+Q',
    },
    view: {
      toggleDevTools: 'Alt+Cmd+I',
      toggleFullScreen: 'Ctrl+Cmd+F',
    },
  },
  win32: {
    // Windows specific shortcuts
    app: {
      quit: 'Alt+F4',
    },
    view: {
      toggleDevTools: 'Ctrl+Shift+I',
      toggleFullScreen: 'F11',
    },
  },
  linux: {
    // Linux specific shortcuts
    view: {
      toggleDevTools: 'Ctrl+Shift+I',
      toggleFullScreen: 'F11',
    },
  },
} as const;

/**
 * Gets the appropriate shortcut for the current platform
 * @param category - The shortcut category
 * @param action - The shortcut action
 * @returns {string | undefined} The accelerator string
 */
export function getShortcut(
  category: keyof typeof Shortcuts,
  action: string
): string | undefined {
  const platform = process.platform as 'darwin' | 'win32' | 'linux';
  const platformOverrides = PlatformShortcuts[platform];
  
  // Check for platform override first
  if (platformOverrides && category in platformOverrides) {
    const cat = platformOverrides[category as keyof typeof platformOverrides];
    if (cat && action in cat) {
      return (cat as Record<string, string>)[action];
    }
  }
  
  // Fall back to default shortcuts
  const shortcuts = Shortcuts[category];
  if (shortcuts && action in shortcuts) {
    return (shortcuts as Record<string, string>)[action];
  }
  
  return undefined;
}

/**
 * Menu action channel mapping
 * Maps menu actions to IPC channels
 */
export const MenuChannels = {
  // File
  'file:new-chat': 'file:new-chat',
  'file:open-workflow': 'file:open-workflow',
  'file:save': 'file:save',
  'file:save-as': 'file:save-as',
  'file:close-tab': 'file:close-tab',

  // Edit
  'edit:find': 'edit:find',
  'edit:find-next': 'edit:find-next',
  'edit:find-previous': 'edit:find-previous',

  // View
  'view:theme-changed': 'view:theme-changed',

  // Agent
  'agent:new-session': 'agent:new-session',
  'agent:stop': 'agent:stop',
  'agent:open-panel': 'agent:open-panel',
  'agent:view-workflows': 'agent:view-workflows',
  'agent:clear-conversation': 'agent:clear-conversation',

  // App
  'app:show-about': 'app:show-about',
  'app:open-settings': 'app:open-settings',
  'app:check-updates': 'app:check-updates',

  // Help
  'help:shortcuts': 'help:shortcuts',
} as const;

/**
 * Type for menu action channels
 */
export type MenuChannel = typeof MenuChannels[keyof typeof MenuChannels];
