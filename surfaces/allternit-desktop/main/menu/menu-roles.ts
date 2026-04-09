/**
 * @fileoverview Menu Roles Definitions
 * @module main/menu/menu-roles
 * 
 * Role-based menu items for native platform behavior.
 * These map to Electron's built-in roles for native OS integration.
 * 
 * @author T3-A2: Native Menus specialist
 * @version 1.0.0
 * 
 * @see https://www.electronjs.org/docs/latest/api/menu-item#roles
 */

import { MenuItemConstructorOptions } from 'electron';

/**
 * Native menu roles supported by Electron
 * Using roles ensures native behavior and automatic localization
 */
export const MenuRoles = {
  // macOS App Menu roles
  appMenu: {
    about: 'about' as const,
    hide: 'hide' as const,
    hideOthers: 'hideOthers' as const,
    unhide: 'unhide' as const,
    quit: 'quit' as const,
    services: 'services' as const,
  },

  // Edit Menu roles
  edit: {
    undo: 'undo' as const,
    redo: 'redo' as const,
    cut: 'cut' as const,
    copy: 'copy' as const,
    paste: 'paste' as const,
    pasteAndMatchStyle: 'pasteAndMatchStyle' as const,
    delete: 'delete' as const,
    selectAll: 'selectAll' as const,
  },

  // Window Menu roles
  window: {
    minimize: 'minimize' as const,
    close: 'close' as const,
    zoom: 'zoom' as const,
    front: 'front' as const,
    window: 'window' as const,
    help: 'help' as const,
  },

  // Full screen (available on all platforms)
  fullScreen: 'togglefullscreen' as const,
} as const;

/**
 * Creates a standard edit menu item with proper role
 * @param role - The edit role to use
 * @param accelerator - Optional accelerator override
 * @returns {MenuItemConstructorOptions} Menu item configuration
 */
export function createEditRoleItem(
  role: keyof typeof MenuRoles.edit,
  accelerator?: string
): MenuItemConstructorOptions {
  const roles = MenuRoles.edit;
  const labelMap: Record<keyof typeof roles, string> = {
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    pasteAndMatchStyle: 'Paste and Match Style',
    delete: 'Delete',
    selectAll: 'Select All',
  };

  return {
    label: labelMap[role],
    role: roles[role],
    accelerator,
  };
}

/**
 * Creates a standard window menu item with proper role
 * @param role - The window role to use
 * @param accelerator - Optional accelerator override
 * @returns {MenuItemConstructorOptions} Menu item configuration
 */
export function createWindowRoleItem(
  role: keyof typeof MenuRoles.window,
  accelerator?: string
): MenuItemConstructorOptions {
  const roles = MenuRoles.window;
  const labelMap: Record<keyof typeof roles, string> = {
    minimize: 'Minimize',
    close: 'Close',
    zoom: 'Zoom',
    front: 'Bring All to Front',
    window: 'Window',
    help: 'Help',
  };

  return {
    label: labelMap[role],
    role: roles[role],
    accelerator,
  };
}

/**
 * Creates the standard edit submenu with all edit roles
 * @returns {MenuItemConstructorOptions[]} Array of edit menu items
 */
export function createStandardEditSubmenu(): MenuItemConstructorOptions[] {
  return [
    createEditRoleItem('undo', 'CmdOrCtrl+Z'),
    createEditRoleItem('redo', 'Shift+CmdOrCtrl+Z'),
    { type: 'separator' },
    createEditRoleItem('cut', 'CmdOrCtrl+X'),
    createEditRoleItem('copy', 'CmdOrCtrl+C'),
    createEditRoleItem('paste', 'CmdOrCtrl+V'),
    createEditRoleItem('pasteAndMatchStyle', 'CmdOrCtrl+Shift+V'),
    createEditRoleItem('delete'),
    createEditRoleItem('selectAll', 'CmdOrCtrl+A'),
  ];
}

/**
 * Platform-specific role availability
 * Some roles behave differently or are only available on certain platforms
 */
export const PlatformRoleAvailability = {
  darwin: {
    // macOS specific roles
    services: true,
    hide: true,
    hideOthers: true,
    unhide: true,
    front: true,
    zoom: true,
    // All standard edit roles work on macOS
    ...Object.keys(MenuRoles.edit).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
  },
  win32: {
    // Windows specific role behavior
    services: false,
    hide: false,
    hideOthers: false,
    unhide: false,
    front: false,
    zoom: false,
    // Edit roles work on Windows
    ...Object.keys(MenuRoles.edit).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
  },
  linux: {
    // Linux specific role behavior
    services: false,
    hide: false,
    hideOthers: false,
    unhide: false,
    front: false,
    zoom: false,
    // Edit roles work on Linux
    ...Object.keys(MenuRoles.edit).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
  },
} as const;

/**
 * Checks if a role is available on the current platform
 * @param role - The role to check
 * @returns {boolean} Whether the role is available
 */
export function isRoleAvailable(role: string): boolean {
  const platform = process.platform as 'darwin' | 'win32' | 'linux';
  const availability = PlatformRoleAvailability[platform];
  return Boolean((availability as Record<string, boolean | undefined>)[role]);
}

/**
 * Creates a safe menu item that falls back to click handler if role unavailable
 * @param role - The desired role
 * @param label - Menu item label
 * @param fallbackClick - Click handler for platforms without role support
 * @param accelerator - Optional accelerator
 * @returns {MenuItemConstructorOptions} Safe menu item configuration
 */
export function createSafeRoleItem(
  role: string,
  label: string,
  fallbackClick: () => void,
  accelerator?: string
): MenuItemConstructorOptions {
  if (isRoleAvailable(role)) {
    return {
      label,
      role: role as any,
      accelerator,
    };
  }

  return {
    label,
    accelerator,
    click: fallbackClick,
  };
}
