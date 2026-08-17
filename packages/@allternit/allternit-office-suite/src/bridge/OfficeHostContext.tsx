import React, { createContext, useContext, useMemo } from 'react';
import type { OfficeHost, OfficeStorageProvider } from './types';

const OfficeHostContext = createContext<OfficeHost | null>(null);

export interface OfficeHostProviderProps {
  host: OfficeHost;
  children: React.ReactNode;
}

/**
 * Provides the host implementation to all Allternit Office Suite components.
 */
export function OfficeHostProvider({ host, children }: OfficeHostProviderProps): React.ReactNode {
  const stableHost = useMemo(() => host, [host]);
  return <OfficeHostContext.Provider value={stableHost}>{children}</OfficeHostContext.Provider>;
}

/**
 * Read the current host from context. Returns `null` if no provider is mounted.
 */
export function useOfficeHost(): OfficeHost | null {
  return useContext(OfficeHostContext);
}

/**
 * Read the current host from context. Throws if no provider is mounted.
 * Use inside suite components that require a host.
 */
export function useOfficeHostRequired(): OfficeHost {
  const host = useContext(OfficeHostContext);
  if (!host) {
    throw new Error('useOfficeHostRequired must be used within an OfficeHostProvider');
  }
  return host;
}

/**
 * Default storage provider backed by `localStorage`. Hosts can override this
 * (e.g. platform surfaces may want to namespace keys or use a different store).
 */
export const localStorageProvider: OfficeStorageProvider = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};
