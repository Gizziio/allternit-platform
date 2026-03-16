/**
 * Renderer IPC Hooks
 * 
 * React hooks for IPC communication with the main process.
 * Provides type-safe wrappers around window.electronAPI.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type {
  DialogOptions,
  DialogResult,
  NotificationOptions,
  UpdateCheckResult,
  UpdateDownloadProgress,
  UpdateInfo,
  UpdateStrategy,
  WindowBounds,
} from '../../shared/types';
import type { StoreKey, StoreSchema, ThemeMode } from '../../shared/store-schema';

/**
 * Hook to access the Electron API
 * @returns The electronAPI object from window
 */
export function useElectron() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('Electron API not available. Make sure you are running in Electron.');
  }
  return window.electronAPI;
}

/**
 * Hook for window controls
 * @returns Object with minimize, maximize, close, and fullscreen functions
 */
export function useWindowControls() {
  const electron = useElectron();

  const minimize = useCallback(() => {
    electron.window.minimize();
  }, [electron]);

  const maximize = useCallback(() => {
    electron.window.maximize();
  }, [electron]);

  const close = useCallback(() => {
    electron.window.close();
  }, [electron]);

  const setFullscreen = useCallback(
    (fullscreen: boolean) => {
      electron.window.setFullscreen(fullscreen);
    },
    [electron]
  );

  const getBounds = useCallback(async (): Promise<WindowBounds> => {
    return electron.window.getBounds();
  }, [electron]);

  const setBounds = useCallback(
    (bounds: WindowBounds) => {
      electron.window.setBounds(bounds);
    },
    [electron]
  );

  return {
    minimize,
    maximize,
    close,
    setFullscreen,
    getBounds,
    setBounds,
  };
}

/**
 * Hook for app information and controls
 * @returns Object with app version and quit function
 */
export function useAppInfo() {
  const electron = useElectron();
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    electron.app.getVersion().then(setVersion);
  }, [electron]);

  const quit = useCallback(() => {
    electron.app.quit();
  }, [electron]);

  return {
    version,
    quit,
  };
}

/**
 * Hook for electron-store with React state synchronization
 * @param key - The store key
 * @param defaultValue - Default value if key doesn't exist
 * @returns Tuple of [value, setValue, isLoading]
 */
export function useStore<K extends StoreKey>(
  key: K,
  defaultValue: StoreSchema[K]
): [StoreSchema[K], (value: StoreSchema[K]) => Promise<void>, boolean, string | null] {
  const electron = useElectron();
  const [value, setValueState] = useState<StoreSchema[K]>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial value
  useEffect(() => {
    let mounted = true;

    async function loadValue() {
      try {
        setIsLoading(true);
        setError(null);
        const storedValue = await electron.store.get(key);
        if (mounted) {
          setValueState(storedValue ?? defaultValue);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load store value');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadValue();

    return () => {
      mounted = false;
    };
  }, [electron, key, defaultValue]);

  // Setter function
  const setValue = useCallback(
    async (newValue: StoreSchema[K]) => {
      try {
        setError(null);
        await electron.store.set(key, newValue);
        setValueState(newValue);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save store value');
        throw err;
      }
    },
    [electron, key]
  );

  return [value, setValue, isLoading, error];
}

/**
 * Hook for window bounds with persistence
 * Automatically saves and restores window bounds
 */
export function useWindowBounds() {
  const electron = useElectron();
  const [bounds, setBounds, isLoading, error] = useStore('window.bounds', {
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
  });

  const applyBounds = useCallback(async () => {
    if (!isLoading && bounds) {
      electron.window.setBounds(bounds);
    }
  }, [electron, bounds, isLoading]);

  const saveCurrentBounds = useCallback(async () => {
    const currentBounds = await electron.window.getBounds();
    setBounds(currentBounds);
  }, [electron, setBounds]);

  return {
    bounds,
    setBounds,
    applyBounds,
    saveCurrentBounds,
    isLoading,
    error,
  };
}

/**
 * Hook for theme mode management
 * @returns Tuple of [theme, setTheme, isLoading]
 */
export function useTheme() {
  return useStore('app.theme', 'system' as ThemeMode);
}

/**
 * Hook for notifications
 * @returns Object with show notification function
 */
export function useNotification() {
  const electron = useElectron();

  const show = useCallback(
    (options: NotificationOptions) => {
      electron.notification.show(options);
    },
    [electron]
  );

  const showError = useCallback(
    (title: string, message?: string) => {
      show({
        title,
        body: message,
        silent: false,
      });
    },
    [show]
  );

  const showSuccess = useCallback(
    (title: string, message?: string) => {
      show({
        title,
        body: message,
        silent: true,
      });
    },
    [show]
  );

  return {
    show,
    showError,
    showSuccess,
  };
}

/**
 * Hook for dialog operations
 * @returns Object with showSaveDialog and showOpenDialog functions
 */
export function useDialog() {
  const electron = useElectron();

  const showSaveDialog = useCallback(
    async (options?: DialogOptions): Promise<DialogResult> => {
      return electron.dialog.showSave(options);
    },
    [electron]
  );

  const showOpenDialog = useCallback(
    async (options?: DialogOptions): Promise<DialogResult> => {
      return electron.dialog.showOpen(options);
    },
    [electron]
  );

  return {
    showSaveDialog,
    showOpenDialog,
  };
}

/**
 * Hook for opening external links
 * @returns Function to open external URLs
 */
export function useExternalLink() {
  const electron = useElectron();

  const openExternal = useCallback(
    async (url: string): Promise<boolean> => {
      return electron.shell.openExternal(url);
    },
    [electron]
  );

  return openExternal;
}

/**
 * Hook for auto-updater
 * @returns Object with update check, download, install functions and state
 */
export function useUpdater() {
  const electron = useElectron();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateStrategy, setUpdateStrategy] = useState<UpdateStrategy>('prompt');
  const [downloadProgress, setDownloadProgress] = useState<UpdateDownloadProgress | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for update events from main process
  useEffect(() => {
    const unsubscribeAvailable = electron.updater.onUpdateAvailable((data) => {
      setUpdateAvailable(true);
      setUpdateInfo(data.info);
      setUpdateStrategy(data.strategy);
    });

    const unsubscribeProgress = electron.updater.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
      setIsDownloading(progress.percent < 100);
    });

    const unsubscribeDownloaded = electron.updater.onUpdateDownloaded((info) => {
      setUpdateDownloaded(true);
      setIsDownloading(false);
      setUpdateInfo(info);
    });

    const unsubscribeError = electron.updater.onUpdateError((err) => {
      setError(err.message);
      setIsDownloading(false);
    });

    return () => {
      unsubscribeAvailable();
      unsubscribeProgress();
      unsubscribeDownloaded();
      unsubscribeError();
    };
  }, [electron]);

  const checkForUpdates = useCallback(async (): Promise<UpdateCheckResult> => {
    try {
      setIsChecking(true);
      setError(null);
      const result = await electron.updater.check();
      if (result.updateAvailable) {
        setUpdateAvailable(true);
        setUpdateInfo(result.info || null);
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update check failed');
      throw err;
    } finally {
      setIsChecking(false);
    }
  }, [electron]);

  const downloadUpdate = useCallback(async (): Promise<boolean> => {
    try {
      setIsDownloading(true);
      setError(null);
      const result = await electron.updater.download();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update download failed');
      throw err;
    } finally {
      setIsDownloading(false);
    }
  }, [electron]);

  const installUpdate = useCallback(() => {
    electron.updater.install();
  }, [electron]);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return {
    updateAvailable,
    updateInfo,
    updateStrategy,
    downloadProgress,
    isChecking,
    isDownloading,
    updateDownloaded,
    error,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
  };
}

/**
 * Hook for user preferences
 * @returns Tuple of [preferences, setPreferences, isLoading]
 */
export function useUserPreferences() {
  return useStore('user.preferences', {});
}

/**
 * Hook for notification settings
 */
export function useNotificationSettings() {
  const [enabled, setEnabled] = useStore('notifications.enabled', true);
  const [soundEnabled, setSoundEnabled] = useStore('notifications.soundEnabled', true);

  return {
    enabled,
    setEnabled,
    soundEnabled,
    setSoundEnabled,
  };
}

/**
 * Hook for update settings
 */
export function useUpdateSettings() {
  const [autoCheck, setAutoCheck] = useStore('updates.autoCheck', true);
  const [autoDownload, setAutoDownload] = useStore('updates.autoDownload', false);

  return {
    autoCheck,
    setAutoCheck,
    autoDownload,
    setAutoDownload,
  };
}

/**
 * Hook to get and set the last session ID
 */
export function useLastSession() {
  return useStore('app.lastSessionId', null as string | null);
}

/**
 * Hook for app launch count
 * Increments on first mount
 */
export function useLaunchCount() {
  const [count, setCount, isLoading] = useStore('app.launchCount', 0);

  useEffect(() => {
    if (!isLoading) {
      setCount((count || 0) + 1);
    }
  }, [isLoading]);

  return count;
}
