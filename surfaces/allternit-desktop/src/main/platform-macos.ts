/**
 * Allternit Desktop — macOS Platform Integration
 *
 * macOS-specific functionality: Dock menu, protocol handler,
 * auto-launch via Login Items, and native notifications.
 */

import { app, Tray, Menu, Notification, nativeImage, type NativeImage } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import log from 'electron-log';

let tray: Tray | null = null;

/**
 * Create and configure the macOS menu bar (status bar) tray icon.
 */
export function setupMacOSTray(
  handlers: {
    onShow: () => void;
    onQuit: () => void;
    onOpenSettings: () => void;
  },
): Tray {
  if (tray) return tray;

  const iconPath = resolveTrayIcon();
  tray = new Tray(iconPath);
  tray.setToolTip('Allternit Desktop');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Allternit',
      click: handlers.onShow,
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: handlers.onOpenSettings,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: handlers.onQuit,
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', handlers.onShow);

  log.info('[PlatformMacOS] Menu bar tray initialized');
  return tray;
}

/**
 * Register the allternit:// protocol handler via Electron's setAsDefaultProtocolClient.
 */
export async function registerProtocolHandler(): Promise<void> {
  const success = app.setAsDefaultProtocolClient('allternit');
  if (success) {
    log.info('[PlatformMacOS] Protocol handler registered');
  } else {
    log.warn('[PlatformMacOS] Failed to register protocol handler');
  }
}

/**
 * Add the app to macOS Login Items for auto-launch.
 */
export async function setupAutoLaunch(): Promise<void> {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
  });
  log.info('[PlatformMacOS] Auto-launch enabled via Login Items');
}

/**
 * Remove the app from macOS Login Items.
 */
export async function disableAutoLaunch(): Promise<void> {
  app.setLoginItemSettings({
    openAtLogin: false,
  });
  log.info('[PlatformMacOS] Auto-launch disabled');
}

/**
 * Show a native macOS notification.
 */
export function showMacOSNotification(title: string, body: string): void {
  if (!Notification.isSupported()) return;

  const notification = new Notification({ title, body, silent: false });
  notification.show();
}

/**
 * Returns true if the current process is running on macOS.
 */
export function isMacOSPlatform(): boolean {
  return process.platform === 'darwin';
}

/**
 * Clean up macOS-specific resources.
 */
export function cleanupMacOSPlatform(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

// ── Internal helpers ────────────────────────────────────────────────────

function resolveTrayIcon(): NativeImage {
  const iconPaths = [
    path.join(app.getAppPath(), 'build', 'iconTemplate.png'),
    path.join(app.getAppPath(), 'build', 'icon.png'),
    path.join(app.getAppPath(), 'static', 'iconTemplate.png'),
  ];

  for (const iconPath of iconPaths) {
    if (fs.existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath);
      img.setTemplateImage(true);
      return img;
    }
  }

  log.warn('[PlatformMacOS] No tray icon found');
  return nativeImage.createEmpty();
}
