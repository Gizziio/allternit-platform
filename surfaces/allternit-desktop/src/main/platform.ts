/**
 * Allternit Desktop — Platform Abstraction Layer
 *
 * Delegates to platform-specific modules based on the current OS.
 * Import this module from unified-main.ts instead of platform-specific files.
 */

import { Tray } from 'electron';
import log from 'electron-log';

import {
  setupWindowsTray,
  registerProtocolHandler as winRegisterProtocol,
  setupAutoLaunch as winAutoLaunch,
  disableAutoLaunch as winDisableAutoLaunch,
  requestFirewallException,
  showWindowsNotification,
  cleanupWindowsPlatform,
  isWindowsPlatform,
} from './platform-windows.js';

import {
  setupMacOSTray,
  registerProtocolHandler as macRegisterProtocol,
  setupAutoLaunch as macAutoLaunch,
  disableAutoLaunch as macDisableAutoLaunch,
  showMacOSNotification,
  cleanupMacOSPlatform,
  isMacOSPlatform,
} from './platform-macos.js';

import {
  setupLinuxTray,
  registerProtocolHandler as linuxRegisterProtocol,
  setupAutoLaunch as linuxAutoLaunch,
  disableAutoLaunch as linuxDisableAutoLaunch,
  showLinuxNotification,
  cleanupLinuxPlatform,
  isLinuxPlatform,
} from './platform-linux.js';

export type PlatformName = 'windows' | 'macos' | 'linux' | 'unknown';

interface TrayHandlers {
  onShow: () => void;
  onQuit: () => void;
  onOpenSettings: () => void;
}

/**
 * Get the current platform name.
 */
export function getPlatformName(): PlatformName {
  if (isWindowsPlatform()) return 'windows';
  if (isMacOSPlatform()) return 'macos';
  if (isLinuxPlatform()) return 'linux';
  return 'unknown';
}

/**
 * Set up the platform-specific system tray icon.
 */
export function setupPlatformTray(handlers: TrayHandlers): Tray {
  const platform = getPlatformName();
  log.info(`[Platform] Setting up tray for ${platform}`);

  switch (platform) {
    case 'windows':
      return setupWindowsTray(handlers);
    case 'macos':
      return setupMacOSTray(handlers);
    case 'linux':
      return setupLinuxTray(handlers);
    default:
      log.warn('[Platform] No tray support for this platform');
      return null as unknown as Tray;
  }
}

/**
 * Register the allternit:// protocol handler for the current platform.
 */
export async function registerProtocolHandler(): Promise<void> {
  const platform = getPlatformName();
  log.info(`[Platform] Registering protocol handler for ${platform}`);

  switch (platform) {
    case 'windows':
      return winRegisterProtocol();
    case 'macos':
      return macRegisterProtocol();
    case 'linux':
      return linuxRegisterProtocol();
    default:
      log.warn('[Platform] No protocol handler support for this platform');
  }
}

/**
 * Enable auto-launch at system startup.
 */
export async function setupAutoLaunch(): Promise<void> {
  switch (getPlatformName()) {
    case 'windows':
      return winAutoLaunch();
    case 'macos':
      return macAutoLaunch();
    case 'linux':
      return linuxAutoLaunch();
    default:
      log.warn('[Platform] No auto-launch support for this platform');
  }
}

/**
 * Disable auto-launch at system startup.
 */
export async function disableAutoLaunch(): Promise<void> {
  switch (getPlatformName()) {
    case 'windows':
      return winDisableAutoLaunch();
    case 'macos':
      return macDisableAutoLaunch();
    case 'linux':
      return linuxDisableAutoLaunch();
    default:
      log.warn('[Platform] No auto-launch support for this platform');
  }
}

/**
 * Show a native desktop notification.
 */
export function showNotification(title: string, body: string): void {
  switch (getPlatformName()) {
    case 'windows':
      showWindowsNotification(title, body);
      break;
    case 'macos':
      showMacOSNotification(title, body);
      break;
    case 'linux':
      showLinuxNotification(title, body);
      break;
    default:
      log.warn('[Platform] No notification support for this platform');
  }
}

/**
 * Request platform-specific permissions (e.g. Windows Firewall exception).
 */
export async function requestPlatformPermissions(): Promise<boolean> {
  if (getPlatformName() === 'windows') {
    return requestFirewallException();
  }
  return true;
}

/**
 * Clean up all platform-specific resources.
 */
export function cleanupPlatform(): void {
  switch (getPlatformName()) {
    case 'windows':
      cleanupWindowsPlatform();
      break;
    case 'macos':
      cleanupMacOSPlatform();
      break;
    case 'linux':
      cleanupLinuxPlatform();
      break;
  }
}
