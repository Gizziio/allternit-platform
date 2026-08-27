/**
 * Allternit Extension — Notification Service
 *
 * Manages browser notifications for task completion, errors,
 * and connection status changes.
 */

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface ExtensionNotification {
  id: string
  level: NotificationLevel
  title: string
  message: string
  timestamp: number
  read: boolean
  action?: {
    label: string
    type: 'open-sidepanel' | 'open-url' | 'retry-task'
    payload?: string
  }
}

const STORAGE_KEY = 'allternit-notifications'
const MAX_NOTIFICATIONS = 50
const listeners = new Set<(notifications: ExtensionNotification[]) => void>()

function notify(): void {
  void getNotifications().then((list) => {
    for (const listener of listeners) {
      listener(list)
    }
  })
}

/** Get all stored notifications */
export async function getNotifications(): Promise<ExtensionNotification[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as ExtensionNotification[]) ?? []
}

/** Add a new notification */
export async function addNotification(
  notification: Omit<ExtensionNotification, 'id' | 'timestamp' | 'read'>,
): Promise<ExtensionNotification> {
  const entry: ExtensionNotification = {
    ...notification,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    read: false,
  }

  const notifications = await getNotifications()
  notifications.unshift(entry)

  while (notifications.length > MAX_NOTIFICATIONS) {
    notifications.pop()
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: notifications })

  showBrowserNotification(entry)
  notify()

  return entry
}

/** Mark a notification as read */
export async function markRead(id: string): Promise<void> {
  const notifications = await getNotifications()
  const target = notifications.find((n) => n.id === id)
  if (target) {
    target.read = true
    await chrome.storage.local.set({ [STORAGE_KEY]: notifications })
    notify()
  }
}

/** Mark all notifications as read */
export async function markAllRead(): Promise<void> {
  const notifications = await getNotifications()
  for (const n of notifications) {
    n.read = true
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: notifications })
  notify()
}

/** Clear all notifications */
export async function clearNotifications(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] })
  notify()
}

/** Subscribe to notification changes */
export function onNotificationsChange(
  callback: (notifications: ExtensionNotification[]) => void,
): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

/** Get unread count */
export async function getUnreadCount(): Promise<number> {
  const notifications = await getNotifications()
  return notifications.filter((n) => !n.read).length
}

// ── Convenience creators ────────────────────────────────────────────────

export function notifyTaskComplete(task: string): Promise<ExtensionNotification> {
  return addNotification({
    level: 'success',
    title: 'Task completed',
    message: task.length > 80 ? `${task.slice(0, 80)}…` : task,
    action: { label: 'View result', type: 'open-sidepanel' },
  })
}

export function notifyTaskError(task: string, error: string): Promise<ExtensionNotification> {
  return addNotification({
    level: 'error',
    title: 'Task failed',
    message: `${task.length > 60 ? `${task.slice(0, 60)}…` : task} — ${error}`,
    action: { label: 'Retry', type: 'retry-task', payload: task },
  })
}

export function notifyConnectionLost(): Promise<ExtensionNotification> {
  return addNotification({
    level: 'warning',
    title: 'Connection lost',
    message: 'Lost connection to Allternit Desktop. Reconnect to continue.',
    action: { label: 'Reconnect', type: 'open-sidepanel' },
  })
}

export function notifyConnectionRestored(): Promise<ExtensionNotification> {
  return addNotification({
    level: 'info',
    title: 'Connection restored',
    message: 'Reconnected to Allternit Desktop.',
  })
}

// ── Internal ────────────────────────────────────────────────────────────

function showBrowserNotification(notification: ExtensionNotification): void {
  chrome.notifications?.create(notification.id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon/128.png'),
    title: notification.title,
    message: notification.message,
    priority: notification.level === 'error' ? 2 : notification.level === 'warning' ? 1 : 0,
  })
}
