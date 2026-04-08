/**
 * Notification Manager
 *
 * Manages native desktop notifications with category-based handling,
 * click actions, badge counters, and do-not-disturb mode.
 */

import {
  app,
  Notification,
  nativeImage,
  ipcMain,
} from 'electron';
import Store from 'electron-store';
import { getWindowManager } from './window-manager';
import type { NotificationSettings } from '../shared/store-schema';

/**
 * Notification category types
 */
export type NotificationCategory =
  | 'message'
  | 'workflow'
  | 'agent-mail'
  | 'system'
  | 'update';

/**
 * Extended notification options with Allternit-specific metadata
 */
export interface AllternitNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
  category: NotificationCategory;
  data?: {
    sessionId?: string;
    workflowId?: string;
    messageId?: string;
    threadId?: string;
    mode?: string;
    url?: string;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  doNotDisturb: false,
  categorySettings: {
    message: true,
    workflow: true,
    'agent-mail': true,
    system: true,
    update: true,
  },
};

interface NotificationStore {
  'notifications.enabled': boolean;
  'notifications.soundEnabled': boolean;
  'notifications.doNotDisturb': boolean;
  'notifications.categorySettings': NotificationSettings['categorySettings'];
}

const store = new Store<NotificationStore>({
  name: 'notification-settings',
  defaults: {
    'notifications.enabled': DEFAULT_SETTINGS.enabled,
    'notifications.soundEnabled': DEFAULT_SETTINGS.soundEnabled,
    'notifications.doNotDisturb': DEFAULT_SETTINGS.doNotDisturb,
    'notifications.categorySettings': DEFAULT_SETTINGS.categorySettings,
  },
});

let badgeCount = 0;
const notificationQueue: AllternitNotificationOptions[] = [];
let isProcessingQueue = false;

/**
 * Get notification settings from store
 */
export function getNotificationSettings(): NotificationSettings {
  return {
    enabled: store.get('notifications.enabled'),
    soundEnabled: store.get('notifications.soundEnabled'),
    doNotDisturb: store.get('notifications.doNotDisturb'),
    categorySettings: store.get('notifications.categorySettings'),
  };
}

/**
 * Update notification settings in store
 */
export function updateNotificationSettings(
  settings: Partial<NotificationSettings>
): void {
  if (settings.enabled !== undefined) {
    store.set('notifications.enabled', settings.enabled);
  }
  if (settings.soundEnabled !== undefined) {
    store.set('notifications.soundEnabled', settings.soundEnabled);
  }
  if (settings.doNotDisturb !== undefined) {
    store.set('notifications.doNotDisturb', settings.doNotDisturb);
  }
  if (settings.categorySettings !== undefined) {
    store.set('notifications.categorySettings', settings.categorySettings);
  }
}

/**
 * Check if do-not-disturb mode is enabled
 */
export function isDoNotDisturb(): boolean {
  return store.get('notifications.doNotDisturb');
}

/**
 * Toggle do-not-disturb mode
 */
export function toggleDoNotDisturb(): boolean {
  const current = store.get('notifications.doNotDisturb');
  const newValue = !current;
  store.set('notifications.doNotDisturb', newValue);

  if (!newValue) {
    processNotificationQueue();
  }

  return newValue;
}

/**
 * Check if notifications are enabled for a category
 */
export function isCategoryEnabled(category: NotificationCategory): boolean {
  if (!store.get('notifications.enabled')) return false;
  return store.get('notifications.categorySettings')[category] ?? true;
}

/**
 * Set category enabled state
 */
export function setCategoryEnabled(
  category: NotificationCategory,
  enabled: boolean
): void {
  const settings = store.get('notifications.categorySettings');
  settings[category] = enabled;
  store.set('notifications.categorySettings', settings);
}

/**
 * Get the appropriate icon for a notification category
 */
function getCategoryIcon(category: NotificationCategory): nativeImage | undefined {
  const iconMap: Record<NotificationCategory, string> = {
    message: '💬',
    workflow: '⚙️',
    'agent-mail': '📧',
    system: '🔔',
    update: '⬆️',
  };

  try {
    const iconText = iconMap[category] || '🔔';
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
      <text x="50%" y="55%" font-size="48" text-anchor="middle" dominant-baseline="middle">${iconText}</text>
    </svg>`;
    return nativeImage.createFromBuffer(Buffer.from(svgIcon));
  } catch {
    return undefined;
  }
}

/**
 * Update the dock/badge count
 */
export function updateBadgeCount(count: number): void {
  badgeCount = Math.max(0, count);

  if (process.platform === 'darwin') {
    app.dock?.setBadge(badgeCount > 0 ? String(badgeCount) : '');
  } else if (process.platform === 'win32') {
    const windowManager = getWindowManager();
    const mainWindow = windowManager?.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOverlayIcon(
        badgeCount > 0 ? createBadgeOverlay(badgeCount) : null,
        badgeCount > 0 ? `${badgeCount} notifications` : ''
      );
    }
  }
}

/**
 * Create a badge overlay icon for Windows
 */
function createBadgeOverlay(count: number): nativeImage {
  const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
    <circle cx="8" cy="8" r="8" fill="#FF3B30"/>
    <text x="8" y="12" font-size="10" fill="white" text-anchor="middle" font-family="Arial">${Math.min(count, 99)}</text>
  </svg>`;
  return nativeImage.createFromBuffer(Buffer.from(canvas));
}

/**
 * Increment badge count
 */
export function incrementBadgeCount(amount = 1): void {
  updateBadgeCount(badgeCount + amount);
}

/**
 * Clear badge count
 */
export function clearBadgeCount(): void {
  updateBadgeCount(0);
}

/**
 * Get current badge count
 */
export function getBadgeCount(): number {
  return badgeCount;
}

/**
 * Handle notification click - focus window and navigate
 */
function handleNotificationClick(options: AllternitNotificationOptions): void {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    mainWindow.show();

    if (options.data?.mode) {
      mainWindow.webContents.send('notification:navigate', {
        mode: options.data.mode,
        sessionId: options.data.sessionId,
        workflowId: options.data.workflowId,
        threadId: options.data.threadId,
        messageId: options.data.messageId,
      });
    }

    if (options.data?.url) {
      mainWindow.webContents.send('notification:open-url', options.data.url);
    }
  }

  decrementBadgeCount();
}

/**
 * Decrement badge count
 */
function decrementBadgeCount(): void {
  updateBadgeCount(Math.max(0, badgeCount - 1));
}

/**
 * Show a notification
 */
export function showNotification(options: AllternitNotificationOptions): void {
  if (!store.get('notifications.enabled') || store.get('notifications.doNotDisturb')) {
    queueNotification(options);
    return;
  }

  if (!isCategoryEnabled(options.category)) {
    return;
  }

  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: options.icon ? nativeImage.createFromPath(options.icon) : getCategoryIcon(options.category),
    silent: options.silent ?? !store.get('notifications.soundEnabled'),
    timeoutType: 'default',
  });

  notification.on('click', () => {
    handleNotificationClick(options);
    notification.close();
  });

  notification.on('close', () => {
    decrementBadgeCount();
  });

  incrementBadgeCount();
  notification.show();
}

/**
 * Queue a notification for later display (during DnD)
 */
function queueNotification(options: AllternitNotificationOptions): void {
  if (options.category === 'system' || options.category === 'update') {
    notificationQueue.push(options);
  }
}

/**
 * Process queued notifications when DnD is turned off
 */
export function processNotificationQueue(): void {
  if (isProcessingQueue || store.get('notifications.doNotDisturb')) {
    return;
  }

  isProcessingQueue = true;

  while (notificationQueue.length > 0) {
    const options = notificationQueue.shift();
    if (options) {
      showNotification(options);
    }
  }

  isProcessingQueue = false;
}

/**
 * Clear all queued notifications
 */
export function clearNotificationQueue(): void {
  notificationQueue.length = 0;
}

/**
 * Register IPC handlers for notifications
 */
export function registerNotificationIpcHandlers(): void {
  ipcMain.handle('notification:show', (_, options: AllternitNotificationOptions) => {
    showNotification(options);
  });

  ipcMain.handle('notification:getSettings', () => {
    return getNotificationSettings();
  });

  ipcMain.handle('notification:updateSettings', (_, settings: Partial<NotificationSettings>) => {
    updateNotificationSettings(settings);
    if (!settings.doNotDisturb) {
      processNotificationQueue();
    }
  });

  ipcMain.handle('notification:toggleDoNotDisturb', () => {
    return toggleDoNotDisturb();
  });

  ipcMain.handle('notification:setCategoryEnabled', (_, category: NotificationCategory, enabled: boolean) => {
    setCategoryEnabled(category, enabled);
  });

  ipcMain.handle('notification:clearBadge', () => {
    clearBadgeCount();
  });

  ipcMain.handle('notification:getBadgeCount', () => {
    return getBadgeCount();
  });
}

/**
 * Notify with specific category helper functions
 */
export const notify = {
  message: (title: string, body: string, data?: AllternitNotificationOptions['data']) =>
    showNotification({ title, body, category: 'message', data: { ...data, mode: 'chat' } }),

  workflow: (title: string, body: string, data?: AllternitNotificationOptions['data']) =>
    showNotification({ title, body, category: 'workflow', data: { ...data, mode: 'workflows' } }),

  agentMail: (title: string, body: string, data?: AllternitNotificationOptions['data']) =>
    showNotification({ title, body, category: 'agent-mail', data: { ...data, mode: 'agent-mail' } }),

  system: (title: string, body: string, data?: AllternitNotificationOptions['data']) =>
    showNotification({ title, body, category: 'system', data }),

  update: (title: string, body: string, data?: AllternitNotificationOptions['data']) =>
    showNotification({ title, body, category: 'update', data }),
};
