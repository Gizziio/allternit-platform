/**
 * Tray Integration
 *
 * Manages system tray icon, context menu, and tray-related functionality.
 * Supports macOS template images and Windows GUID for taskbar pinning.
 */

import {
  app,
  Tray,
  Menu,
  BrowserWindow,
  nativeImage,
  ipcMain,
} from 'electron';
import { getWindowManager } from './window-manager';
import { getNotificationSettings, toggleDoNotDisturb } from './notifications';

let tray: Tray | null = null;
let trayTooltip = 'A2R';
let isQuitting = false;

// Windows GUID for taskbar pinning (static per app)
const WINDOWS_APP_GUID = 'A2R-Desktop-App-2024';

/**
 * Get tray icon based on platform and theme
 */
function getTrayIcon(): nativeImage {
  const isDarkMode = nativeImage.createFromNamedImage;

  if (process.platform === 'darwin') {
    const templateIcon = nativeImage.createFromNamedImage('NSImageNameActionTemplate');
    if (!templateIcon.isEmpty()) {
      templateIcon.setTemplateImage(true);
      return templateIcon.resize({ width: 16, height: 16 });
    }

    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="8" cy="8" r="3" fill="currentColor"/>
    </svg>`;
    const icon = nativeImage.createFromBuffer(Buffer.from(svgIcon));
    icon.setTemplateImage(true);
    return icon;
  }

  if (process.platform === 'win32') {
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <rect x="1" y="1" width="14" height="14" rx="3" fill="#4A90D9"/>
      <circle cx="8" cy="8" r="4" fill="white"/>
    </svg>`;
    return nativeImage.createFromBuffer(Buffer.from(svgIcon));
  }

  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <rect x="1" y="1" width="14" height="14" rx="3" fill="#4A90D9"/>
    <circle cx="8" cy="8" r="4" fill="white"/>
  </svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svgIcon));
}

/**
 * Get the current connection status
 */
function getConnectionStatus(): string {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();

  if (!mainWindow) {
    return 'Stopped';
  }

  if (mainWindow.isDestroyed()) {
    return 'Closed';
  }

  return 'Connected';
}

/**
 * Build the tray context menu
 */
function buildTrayMenu(): Menu {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();
  const isVisible = mainWindow?.isVisible() && !mainWindow?.isMinimized();
  const settings = getNotificationSettings();

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: isVisible ? 'Hide A2R' : 'Show A2R',
      click: () => {
        if (isVisible) {
          mainWindow?.hide();
        } else {
          windowManager?.focusMainWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Chat',
      click: () => {
        windowManager?.focusMainWindow();
        mainWindow?.webContents.send('tray:switchMode', 'chat');
      },
    },
    {
      label: 'Workflows',
      click: () => {
        windowManager?.focusMainWindow();
        mainWindow?.webContents.send('tray:switchMode', 'workflows');
      },
    },
    {
      label: 'Agent Mail',
      click: () => {
        windowManager?.focusMainWindow();
        mainWindow?.webContents.send('tray:switchMode', 'agent-mail');
      },
    },
    { type: 'separator' },
    {
      label: 'Do Not Disturb',
      type: 'checkbox',
      checked: settings.doNotDisturb,
      click: () => {
        toggleDoNotDisturb();
        updateTrayTooltip();
      },
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      click: () => {
        windowManager?.focusMainWindow();
        mainWindow?.webContents.send('tray:openSettings');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * Update tray tooltip with status
 */
export function updateTrayTooltip(status?: string): void {
  if (!tray) return;

  const connectionStatus = status || getConnectionStatus();
  const settings = getNotificationSettings();

  let tooltip = `A2R\nStatus: ${connectionStatus}`;

  if (settings.doNotDisturb) {
    tooltip += '\n🔕 Do Not Disturb';
  }

  trayTooltip = tooltip;
  tray.setToolTip(tooltip);
}

/**
 * Update tray menu
 */
export function updateTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
}

/**
 * Show tray notification bubble (Windows/Linux)
 */
export function showTrayBubble(
  title: string,
  content: string,
  onClick?: () => void
): void {
  if (!tray) return;

  if (process.platform === 'win32' || process.platform === 'linux') {
    tray.displayBalloon({
      iconType: 'info',
      title,
      content,
    });

    if (onClick) {
      tray.once('balloon-click', onClick);
    }
  }
}

/**
 * Create and initialize the tray icon
 */
export function createTray(): Tray {
  if (tray) {
    return tray;
  }

  const icon = getTrayIcon();
  tray = new Tray(icon);

  tray.setToolTip(trayTooltip);
  tray.setContextMenu(buildTrayMenu());

  tray.on('click', () => {
    const windowManager = getWindowManager();

    if (process.platform === 'darwin') {
      windowManager?.focusMainWindow();
    } else {
      const mainWindow = windowManager?.getMainWindow();
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        windowManager?.focusMainWindow();
      }
    }
  });

  tray.on('double-click', () => {
    getWindowManager()?.focusMainWindow();
  });

  tray.on('right-click', () => {
    tray?.popUpContextMenu(buildTrayMenu());
  });

  return tray;
}

/**
 * Destroy tray icon
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/**
 * Get tray instance
 */
export function getTray(): Tray | null {
  return tray;
}

/**
 * Set quitting state (prevents tray restoration)
 */
export function setTrayQuitting(value: boolean): void {
  isQuitting = value;
}

/**
 * Register IPC handlers for tray
 */
export function registerTrayIpcHandlers(): void {
  ipcMain.handle('tray:updateTooltip', (_, status: string) => {
    updateTrayTooltip(status);
  });

  ipcMain.handle('tray:showNotification', (_, title: string, content: string) => {
    showTrayBubble(title, content, () => {
      getWindowManager()?.focusMainWindow();
    });
  });

  ipcMain.handle('tray:updateMenu', () => {
    updateTrayMenu();
  });
}

/**
 * Get Windows app GUID for taskbar pinning
 */
export function getWindowsAppGuid(): string {
  return WINDOWS_APP_GUID;
}

/**
 * Set tray icon with badge
 */
export function setTrayIconWithBadge(count: number): void {
  if (!tray || process.platform === 'darwin') return;

  const baseIcon = getTrayIcon();

  if (count <= 0) {
    tray.setImage(baseIcon);
    return;
  }

  const badgeText = count > 99 ? '99+' : String(count);
  const size = 16;
  const badgeSize = 10;

  const svgWithBadge = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <image href="data:image/svg+xml;base64,${baseIcon.toPNG().toString('base64')}" width="${size}" height="${size}"/>
    <circle cx="${size - 4}" cy="4" r="${badgeSize / 2}" fill="#FF3B30"/>
  </svg>`;

  tray.setImage(nativeImage.createFromBuffer(Buffer.from(svgWithBadge)));
}
