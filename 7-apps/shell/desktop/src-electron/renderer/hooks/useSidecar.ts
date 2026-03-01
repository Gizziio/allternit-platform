/**
 * React hook for interacting with the API sidecar
 * 
 * Provides methods to control and monitor the Rust API server.
 * 
 * @example
 * ```tsx
 * function ApiStatus() {
 *   const { status, apiUrl, start, stop } = useSidecar();
 *   
 *   return (
 *     <div>
 *       <p>Status: {status}</p>
 *       <p>URL: {apiUrl}</p>
 *       <button onClick={start}>Start</button>
 *       <button onClick={stop}>Stop</button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';

export type SidecarStatus = 'stopped' | 'starting' | 'running' | 'error' | 'crashed';

export interface BasicAuthCredentials {
  username: string;
  password: string;
  header: string;
}

export interface PersistedConfig {
  apiUrl: string;
  password: string;
  port: number;
}

export interface UseSidecarReturn {
  /** Current status of the sidecar */
  status: SidecarStatus;
  /** API base URL (undefined if not running) */
  apiUrl: string | undefined;
  /** Authentication password for API requests */
  authPassword: string | undefined;
  /** Basic Auth credentials for API requests */
  basicAuth: BasicAuthCredentials | undefined;
  /** Whether the sidecar is currently running */
  isRunning: boolean;
  /** Start the sidecar */
  start: () => Promise<boolean>;
  /** Stop the sidecar */
  stop: () => Promise<boolean>;
  /** Restart the sidecar */
  restart: () => Promise<boolean>;
  /** Refresh the status */
  refreshStatus: () => Promise<void>;
  /** Get persisted configuration from previous session */
  getPersistedConfig: () => Promise<PersistedConfig | null>;
  /** Clear persisted configuration */
  clearPersistedConfig: () => Promise<boolean>;
}

export function useSidecar(): UseSidecarReturn {
  const [status, setStatus] = useState<SidecarStatus>('stopped');
  const [apiUrl, setApiUrl] = useState<string | undefined>(undefined);
  const [authPassword, setAuthPassword] = useState<string | undefined>(undefined);
  const [basicAuth, setBasicAuth] = useState<BasicAuthCredentials | undefined>(undefined);

  // Get the sidecar API from window
  const sidecar = typeof window !== 'undefined' ? window.a2rSidecar : undefined;

  const refreshStatus = useCallback(async () => {
    if (!sidecar) return;
    
    try {
      const [newStatus, newApiUrl, newPassword, newBasicAuth] = await Promise.all([
        sidecar.getStatus(),
        sidecar.getApiUrl(),
        sidecar.getAuthPassword(),
        sidecar.getBasicAuth(),
      ]);
      
      setStatus(newStatus);
      setApiUrl(newApiUrl);
      setAuthPassword(newPassword);
      setBasicAuth(newBasicAuth);
    } catch (error) {
      console.error('[useSidecar] Failed to refresh status:', error);
    }
  }, [sidecar]);

  const start = useCallback(async (): Promise<boolean> => {
    if (!sidecar) return false;
    
    try {
      const result = await sidecar.start();
      if (result) {
        await refreshStatus();
      }
      return result;
    } catch (error) {
      console.error('[useSidecar] Failed to start:', error);
      return false;
    }
  }, [sidecar, refreshStatus]);

  const stop = useCallback(async (): Promise<boolean> => {
    if (!sidecar) return false;
    
    try {
      const result = await sidecar.stop();
      if (result) {
        await refreshStatus();
      }
      return result;
    } catch (error) {
      console.error('[useSidecar] Failed to stop:', error);
      return false;
    }
  }, [sidecar, refreshStatus]);

  const restart = useCallback(async (): Promise<boolean> => {
    if (!sidecar) return false;
    
    try {
      const result = await sidecar.restart();
      if (result) {
        await refreshStatus();
      }
      return result;
    } catch (error) {
      console.error('[useSidecar] Failed to restart:', error);
      return false;
    }
  }, [sidecar, refreshStatus]);

  const getPersistedConfig = useCallback(async (): Promise<PersistedConfig | null> => {
    if (!sidecar) return null;
    return sidecar.getPersistedConfig();
  }, [sidecar]);

  const clearPersistedConfig = useCallback(async (): Promise<boolean> => {
    if (!sidecar) return false;
    return sidecar.clearPersistedConfig();
  }, [sidecar]);

  // Listen for status changes from main process
  useEffect(() => {
    if (!sidecar) return;

    // Initial status fetch
    refreshStatus();

    // Subscribe to status changes
    const unsubscribe = sidecar.onStatusChanged((newStatus) => {
      setStatus(newStatus as SidecarStatus);
      // Also refresh URL and password when status changes
      refreshStatus();
    });

    return () => {
      unsubscribe();
    };
  }, [sidecar, refreshStatus]);

  return {
    status,
    apiUrl,
    authPassword,
    basicAuth,
    isRunning: status === 'running',
    start,
    stop,
    restart,
    refreshStatus,
    getPersistedConfig,
    clearPersistedConfig,
  };
}

export default useSidecar;
