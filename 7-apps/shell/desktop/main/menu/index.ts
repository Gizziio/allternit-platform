/**
 * @fileoverview Menu Module Index
 * @module main/menu
 * 
 * Main entry point for the menu system. Exports all menu-related
 * functionality for use in the main process.
 * 
 * @author T3-A2: Native Menus specialist
 * @version 1.0.0
 */

// Application menu
export {
  buildApplicationMenu,
  updateWindowMenu,
} from './app-menu';

// Context menu
export {
  buildContextMenu,
  registerContextMenu,
  unregisterContextMenu,
} from './context-menu';

// Types from context menu
export type {
  ContextMenuType,
  ContextMenuOptions,
} from './context-menu';

// Shortcuts
export {
  Shortcuts,
  PlatformShortcuts,
  getShortcut,
  MenuChannels,
} from './menu-shortcuts';

export type {
  MenuChannel,
} from './menu-shortcuts';

// Roles
export {
  MenuRoles,
  createEditRoleItem,
  createWindowRoleItem,
  createStandardEditSubmenu,
  isRoleAvailable,
  createSafeRoleItem,
} from './menu-roles';

// Platform-specific
export {
  currentPlatform,
  isMac,
  isWindows,
  isLinux,
  getAppMenuLabel,
  getPlatformMenuStructure,
  createPlatformAppMenu,
  createPlatformFileMenu,
  createPlatformWindowMenu,
  createPlatformHelpMenu,
  getPlatformThemeSupport,
  getPlatformShortcutNaming,
} from './platform-menus';

export type {
  Platform,
} from './platform-menus';

/**
 * Initialize the complete menu system for the application
 * @param options - Initialization options
 * @returns {Electron.Menu} The configured application menu
 */
import { Menu } from 'electron';
import { buildApplicationMenu, updateWindowMenu } from './app-menu';

export interface MenuInitializationOptions {
  /** Whether to set as application menu immediately */
  setAsApplicationMenu?: boolean;
  /** Custom menu builder function */
  customBuilder?: () => Menu;
}

export function initializeMenus(options: MenuInitializationOptions = {}): Menu {
  const { setAsApplicationMenu = true, customBuilder } = options;

  const menu = customBuilder ? customBuilder() : buildApplicationMenu();

  if (setAsApplicationMenu) {
    Menu.setApplicationMenu(menu);
  }

  return menu;
}

/**
 * Refresh the application menu (call after window changes)
 */
export function refreshMenu(): void {
  updateWindowMenu();
}
