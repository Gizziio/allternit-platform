/**
 * Allternit Extension — Connection Status Manager
 *
 * Tracks the connection state between the extension, the Allternit Desktop
 * app (native messaging), and the cloud API (WebSocket).
 */

export type ConnectionMode = 'native' | 'cloud' | 'none'

export interface ConnectionStatus {
  mode: ConnectionMode
  connected: boolean
  desktopVersion?: string
  cloudEndpoint?: string
  lastChecked: number
  error?: string
}

const STORAGE_KEY = 'allternit-connection-status'

let cachedStatus: ConnectionStatus = {
  mode: 'none',
  connected: false,
  lastChecked: 0,
}

const listeners = new Set<(status: ConnectionStatus) => void>()

function notify(): void {
  for (const listener of listeners) {
    listener(cachedStatus)
  }
}

/** Check if the native host (Allternit Desktop) is connected */
export async function checkNativeHost(): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'NATIVE_HOST_STATUS' })
    return response?.ok === true
  } catch {
    return false
  }
}

/** Refresh the connection status by probing native host and cloud */
export async function refreshConnectionStatus(): Promise<ConnectionStatus> {
  const nativeOk = await checkNativeHost()

  if (nativeOk) {
    cachedStatus = {
      mode: 'native',
      connected: true,
      lastChecked: Date.now(),
    }
  } else {
    cachedStatus = {
      mode: 'none',
      connected: false,
      lastChecked: Date.now(),
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: cachedStatus })
  notify()
  return cachedStatus
}

/** Get the current cached connection status */
export async function getConnectionStatus(): Promise<ConnectionStatus> {
  if (cachedStatus.lastChecked === 0) {
    const stored = await chrome.storage.local.get(STORAGE_KEY)
    if (stored[STORAGE_KEY]) {
      cachedStatus = stored[STORAGE_KEY] as ConnectionStatus
    }
  }
  return cachedStatus
}

/** Subscribe to connection status changes */
export function onConnectionStatusChange(
  callback: (status: ConnectionStatus) => void,
): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

/**
 * Periodic connection monitor — call from background to keep status fresh.
 * Returns a cleanup function that stops the monitor.
 */
export function startConnectionMonitor(intervalMs = 30_000): () => void {
  const timer = setInterval(() => {
    void refreshConnectionStatus()
  }, intervalMs)

  void refreshConnectionStatus()

  return () => {
    clearInterval(timer)
    listeners.clear()
  }
}
