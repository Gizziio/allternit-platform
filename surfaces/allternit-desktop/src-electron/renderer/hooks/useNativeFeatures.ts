/**
 * Native Features React Hooks
 *
 * React hooks for interacting with Electron native features.
 * Provides type-safe wrappers around the Electron API.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import type {
  NotificationOptions,
  NotificationSettings,
  NotificationCategory,
  PowerState,
  IdleState,
  ParsedDeepLink,
  RecentSession,
} from '../../shared/types';

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
 * Hook for notifications with badge count
 */
export function useNotifications() {
  const electron = useElectron();
  const [badgeCount, setBadgeCount] = useState(0);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    electron.notification.getBadgeCount().then(setBadgeCount);
    electron.notification.getSettings().then((s) => {
      setSettings(s);
      setIsLoading(false);
    });
  }, [electron]);

  const show = useCallback(
    async (options: NotificationOptions) => {
      await electron.notification.show(options);
      const count = await electron.notification.getBadgeCount();
      setBadgeCount(count);
    },
    [electron]
  );

  const showWithCategory = useCallback(
    async (
      title: string,
      body: string,
      category: NotificationCategory,
      data?: NotificationOptions['data']
    ) => {
      await show({ title, body, category, data });
    },
    [show]
  );

  const clearBadge = useCallback(async () => {
    await electron.notification.clearBadge();
    setBadgeCount(0);
  }, [electron]);

  const toggleDoNotDisturb = useCallback(async () => {
    const newValue = await electron.notification.toggleDoNotDisturb();
    setSettings((prev) => (prev ? { ...prev, doNotDisturb: newValue } : null));
    return newValue;
  }, [electron]);

  const setCategoryEnabled = useCallback(
    async (category: NotificationCategory, enabled: boolean) => {
      await electron.notification.setCategoryEnabled(category, enabled);
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              categorySettings: { ...prev.categorySettings, [category]: enabled },
            }
          : null
      );
    },
    [electron]
  );

  const updateSettings = useCallback(
    async (newSettings: Partial<NotificationSettings>) => {
      await electron.notification.updateSettings(newSettings);
      setSettings((prev) => (prev ? { ...prev, ...newSettings } : null));
    },
    [electron]
  );

  return {
    show,
    showWithCategory,
    showMessage: (title: string, body: string, data?: NotificationOptions['data']) =>
      showWithCategory(title, body, 'message', data),
    showWorkflow: (title: string, body: string, data?: NotificationOptions['data']) =>
      showWithCategory(title, body, 'workflow', data),
    showAgentMail: (title: string, body: string, data?: NotificationOptions['data']) =>
      showWithCategory(title, body, 'agent-mail', data),
    showSystem: (title: string, body: string, data?: NotificationOptions['data']) =>
      showWithCategory(title, body, 'system', data),
    showUpdate: (title: string, body: string, data?: NotificationOptions['data']) =>
      showWithCategory(title, body, 'update', data),
    badgeCount,
    clearBadge,
    settings,
    isLoading,
    toggleDoNotDisturb,
    setCategoryEnabled,
    updateSettings,
    isDoNotDisturb: settings?.doNotDisturb ?? false,
  };
}

/**
 * Hook for power monitoring
 */
export function usePowerMonitor() {
  const electron = useElectron();
  const [state, setState] = useState<PowerState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    electron.power.getState().then((s) => {
      setState(s);
      setIsLoading(false);
    });
  }, [electron]);

  useEffect(() => {
    const unsubscribeSuspend = electron.power.onSuspend(() => {
      setState((prev) => (prev ? { ...prev, connectionState: 'paused' } : null));
    });

    const unsubscribeResume = electron.power.onResume(() => {
      electron.power.getState().then(setState);
    });

    return () => {
      unsubscribeSuspend();
      unsubscribeResume();
    };
  }, [electron]);

  const refreshState = useCallback(async () => {
    const newState = await electron.power.getState();
    setState(newState);
    return newState;
  }, [electron]);

  const isOnBattery = useCallback(async () => {
    return electron.power.isOnBattery();
  }, [electron]);

  const getIdleState = useCallback(async () => {
    return electron.power.getIdleState();
  }, [electron]);

  return {
    state,
    isLoading,
    refreshState,
    isOnBattery,
    getIdleState,
    isConnected: state?.connectionState === 'connected',
    isPaused: state?.connectionState === 'paused',
    isOnBatteryPower: state?.isOnBattery ?? false,
    isScreenLocked: state?.isScreenLocked ?? false,
  };
}

/**
 * Hook for SSE connection management based on power state
 */
export function useSSEWithPowerManagement() {
  const electron = useElectron();
  const [isPaused, setIsPaused] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const unsubscribeSuspend = electron.power.onSuspend(() => {
      setIsPaused(true);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    });

    const unsubscribeResume = electron.power.onResume(() => {
      setIsPaused(false);
    });

    return () => {
      unsubscribeSuspend();
      unsubscribeResume();
    };
  }, [electron]);

  const connect = useCallback(
    (url: string, onMessage: (data: unknown) => void) => {
      if (isPaused) return null;

      const es = new EventSource(url);
      es.onmessage = (event) => {
        try {
          onMessage(JSON.parse(event.data));
        } catch {
          onMessage(event.data);
        }
      };
      eventSourceRef.current = es;
      return es;
    },
    [isPaused]
  );

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return {
    connect,
    disconnect,
    isPaused,
  };
}

/**
 * Hook for protocol/deep link handling
 */
export function useProtocol() {
  const electron = useElectron();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = electron.protocol.onOpenUrl((url: string) => {
      setPendingUrl(url);
    });

    return unsubscribe;
  }, [electron]);

  const buildUrl = useCallback(
    async (path: string, params?: Record<string, string>) => {
      return electron.protocol.buildUrl(path, params);
    },
    [electron]
  );

  const open = useCallback(
    async (url: string) => {
      return electron.protocol.open(url);
    },
    [electron]
  );

  const parse = useCallback(
    async (url: string) => {
      return electron.protocol.parse(url);
    },
    [electron]
  );

  const isRegistered = useCallback(async () => {
    return electron.protocol.isRegistered();
  }, [electron]);

  const clearPending = useCallback(() => {
    setPendingUrl(null);
  }, []);

  return {
    buildUrl,
    open,
    parse,
    isRegistered,
    pendingUrl,
    clearPending,
  };
}

/**
 * Hook for recent sessions
 */
export function useRecentSessions() {
  const electron = useElectron();
  const [sessions, setSessions] = useState<RecentSession[]>([]);

  useEffect(() => {
    // Listen for menu events to update recent sessions
    const unsubscribe = electron.on('menu:recentSessionsUpdated', (sessions: RecentSession[]) => {
      setSessions(sessions);
    });

    return unsubscribe;
  }, [electron]);

  const add = useCallback(
    async (sessionId: string, sessionName: string) => {
      await electron.invoke('menu:addRecentSession', sessionId, sessionName);
    },
    [electron]
  );

  const clear = useCallback(async () => {
    await electron.invoke('menu:clearRecentSessions');
    setSessions([]);
  }, [electron]);

  return {
    sessions,
    add,
    clear,
  };
}

/**
 * Hook for tray menu mode switching
 */
export function useTrayModeSwitching(onSwitchMode: (mode: string) => void) {
  const electron = useElectron();

  useEffect(() => {
    const unsubscribe = electron.on('tray:switchMode', (mode: string) => {
      onSwitchMode(mode);
    });

    return unsubscribe;
  }, [electron, onSwitchMode]);
}

/**
 * Hook for notification click navigation
 */
export function useNotificationNavigation(
  onNavigate: (data: {
    mode?: string;
    sessionId?: string;
    workflowId?: string;
    threadId?: string;
  }) => void
) {
  const electron = useElectron();

  useEffect(() => {
    const unsubscribe = electron.on(
      'notification:navigate',
      (data: { mode?: string; sessionId?: string; workflowId?: string; threadId?: string }) => {
        onNavigate(data);
      }
    );

    return unsubscribe;
  }, [electron, onNavigate]);
}

/**
 * Hook for menu events
 */
export function useMenuEvents(handlers: {
  onSwitchMode?: (mode: string) => void;
  onOpenSettings?: () => void;
  onNewSession?: () => void;
  onOpenSession?: (sessionId: string) => void;
  onShowKeyboardShortcuts?: () => void;
}) {
  const electron = useElectron();

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    if (handlers.onSwitchMode) {
      unsubscribes.push(
        electron.on('menu:switchMode', (mode: string) => handlers.onSwitchMode!(mode))
      );
    }

    if (handlers.onOpenSettings) {
      unsubscribes.push(
        electron.on('menu:openSettings', () => handlers.onOpenSettings!())
      );
    }

    if (handlers.onNewSession) {
      unsubscribes.push(
        electron.on('menu:newSession', () => handlers.onNewSession!())
      );
    }

    if (handlers.onOpenSession) {
      unsubscribes.push(
        electron.on('menu:openSession', (sessionId: string) =>
          handlers.onOpenSession!(sessionId)
        )
      );
    }

    if (handlers.onShowKeyboardShortcuts) {
      unsubscribes.push(
        electron.on('menu:showKeyboardShortcuts', () => handlers.onShowKeyboardShortcuts!())
      );
    }

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [electron, handlers]);
}

/**
 * Combined hook for all native features
 */
export function useNativeFeatures() {
  return {
    notifications: useNotifications(),
    power: usePowerMonitor(),
    sse: useSSEWithPowerManagement(),
    protocol: useProtocol(),
    recentSessions: useRecentSessions(),
  };
}

export default useNativeFeatures;
