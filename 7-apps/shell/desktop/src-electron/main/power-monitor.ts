/**
 * Power Monitor
 *
 * Detects system suspend/resume events and manages SSE connections
 * and other time-sensitive operations during power state changes.
 */

import { powerMonitor, ipcMain, BrowserWindow } from 'electron';
import { getWindowManager } from './window-manager';

type PowerState = 'active' | 'idle' | 'locked' | 'sleeping';
type ConnectionState = 'connected' | 'paused' | 'disconnected';

interface PowerMonitorState {
  isOnBattery: boolean;
  isScreenLocked: boolean;
  systemIdleTime: number;
  connectionState: ConnectionState;
  lastWakeTime: number | null;
  lastSleepTime: number | null;
}

const state: PowerMonitorState = {
  isOnBattery: false,
  isScreenLocked: false,
  systemIdleTime: 0,
  connectionState: 'connected',
  lastWakeTime: null,
  lastSleepTime: null,
};

const listeners = {
  onSuspend: [] as Array<() => void>,
  onResume: [] as Array<() => void>,
  onBattery: [] as Array<() => void>,
  onAc: [] as Array<() => void>,
  onLock: [] as Array<() => void>,
  onUnlock: [] as Array<() => void>,
  onIdle: [] as Array<() => void>,
  onActive: [] as Array<() => void>,
};

/**
 * Get current power monitor state
 */
export function getPowerState(): Readonly<PowerMonitorState> {
  return { ...state };
}

/**
 * Check if system is on battery power
 */
export function isOnBatteryPower(): boolean {
  return powerMonitor.isOnBatteryPower();
}

/**
 * Get system idle time in seconds
 */
export function getSystemIdleTime(): number {
  return powerMonitor.getSystemIdleTime();
}

/**
 * Check if screen is locked
 */
export function isScreenLocked(): boolean {
  return state.isScreenLocked;
}

/**
 * Get connection state
 */
export function getConnectionState(): ConnectionState {
  return state.connectionState;
}

/**
 * Register event listeners
 */
export function onPowerEvent(
  event: keyof typeof listeners,
  callback: () => void
): () => void {
  listeners[event].push(callback);
  return () => {
    const index = listeners[event].indexOf(callback);
    if (index > -1) {
      listeners[event].splice(index, 1);
    }
  };
}

/**
 * Notify all listeners for an event
 */
function notifyListeners(event: keyof typeof listeners): void {
  listeners[event].forEach((callback) => {
    try {
      callback();
    } catch (error) {
      console.error(`Error in ${event} listener:`, error);
    }
  });
}

/**
 * Broadcast power state change to all windows
 */
function broadcastToWindows(channel: string, data?: unknown): void {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Handle system suspend
 */
function handleSuspend(): void {
  state.lastSleepTime = Date.now();
  state.connectionState = 'paused';

  broadcastToWindows('power:suspend', { timestamp: state.lastSleepTime });
  notifyListeners('onSuspend');

  pauseSSEConnections();
}

/**
 * Handle system resume
 */
function handleResume(): void {
  state.lastWakeTime = Date.now();
  state.connectionState = 'connected';

  broadcastToWindows('power:resume', { timestamp: state.lastWakeTime });
  notifyListeners('onResume');

  resumeSSEConnections();
}

/**
 * Handle AC power connected
 */
function handleOnAc(): void {
  state.isOnBattery = false;
  broadcastToWindows('power:ac-connected');
  notifyListeners('onAc');
}

/**
 * Handle battery power
 */
function handleOnBattery(): void {
  state.isOnBattery = true;
  broadcastToWindows('power:battery');
  notifyListeners('onBattery');
}

/**
 * Handle screen lock
 */
function handleLockScreen(): void {
  state.isScreenLocked = true;
  broadcastToWindows('power:lock');
  notifyListeners('onLock');
}

/**
 * Handle screen unlock
 */
function handleUnlockScreen(): void {
  state.isScreenLocked = false;
  broadcastToWindows('power:unlock');
  notifyListeners('onUnlock');
}

/**
 * Handle system idle
 */
function handleIdle(): void {
  broadcastToWindows('power:idle');
  notifyListeners('onIdle');
}

/**
 * Handle system active
 */
function handleActive(): void {
  broadcastToWindows('power:active');
  notifyListeners('onActive');
}

/**
 * Pause SSE connections
 */
function pauseSSEConnections(): void {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sse:pause');
  }

  const windows = windowManager?.getSecondaryWindows();
  if (windows) {
    for (const window of windows.values()) {
      if (!window.isDestroyed()) {
        window.webContents.send('sse:pause');
      }
    }
  }
}

/**
 * Resume SSE connections
 */
function resumeSSEConnections(): void {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sse:resume');
  }

  const windows = windowManager?.getSecondaryWindows();
  if (windows) {
    for (const window of windows.values()) {
      if (!window.isDestroyed()) {
        window.webContents.send('sse:resume');
      }
    }
  }
}

/**
 * Manually pause SSE connections (e.g., before sleep)
 */
export function manuallyPauseConnections(): void {
  state.connectionState = 'paused';
  pauseSSEConnections();
}

/**
 * Manually resume SSE connections
 */
export function manuallyResumeConnections(): void {
  state.connectionState = 'connected';
  resumeSSEConnections();
}

/**
 * Check if should throttle background activity
 */
export function shouldThrottleBackgroundActivity(): boolean {
  return state.isOnBattery || state.isScreenLocked;
}

/**
 * Get idle state information
 */
export function getIdleState(): {
  idleTime: number;
  idleThreshold: number;
  isIdle: boolean;
} {
  const idleTime = powerMonitor.getSystemIdleTime();
  const idleThreshold = 60;

  return {
    idleTime,
    idleThreshold,
    isIdle: idleTime > idleThreshold,
  };
}

/**
 * Initialize power monitor
 */
export function initializePowerMonitor(): void {
  if (!powerMonitor.isReady()) {
    powerMonitor.once('ready', () => {
      setupPowerListeners();
    });
  } else {
    setupPowerListeners();
  }
}

/**
 * Setup all power event listeners
 */
function setupPowerListeners(): void {
  powerMonitor.on('suspend', handleSuspend);
  powerMonitor.on('resume', handleResume);
  powerMonitor.on('on-ac', handleOnAc);
  powerMonitor.on('on-battery', handleOnBattery);
  powerMonitor.on('lock-screen', handleLockScreen);
  powerMonitor.on('unlock-screen', handleUnlockScreen);
  powerMonitor.on('idle', handleIdle);
  powerMonitor.on('active', handleActive);

  state.isOnBattery = powerMonitor.isOnBatteryPower();
}

/**
 * Cleanup power monitor
 */
export function cleanupPowerMonitor(): void {
  powerMonitor.removeAllListeners();

  listeners.onSuspend.length = 0;
  listeners.onResume.length = 0;
  listeners.onBattery.length = 0;
  listeners.onAc.length = 0;
  listeners.onLock.length = 0;
  listeners.onUnlock.length = 0;
  listeners.onIdle.length = 0;
  listeners.onActive.length = 0;
}

/**
 * Register IPC handlers for power monitor
 */
export function registerPowerMonitorIpcHandlers(): void {
  ipcMain.handle('power:getState', () => {
    return getPowerState();
  });

  ipcMain.handle('power:isOnBattery', () => {
    return isOnBatteryPower();
  });

  ipcMain.handle('power:getIdleTime', () => {
    return getSystemIdleTime();
  });

  ipcMain.handle('power:isScreenLocked', () => {
    return isScreenLocked();
  });

  ipcMain.handle('power:getIdleState', () => {
    return getIdleState();
  });

  ipcMain.handle('power:pauseConnections', () => {
    manuallyPauseConnections();
  });

  ipcMain.handle('power:resumeConnections', () => {
    manuallyResumeConnections();
  });
}
