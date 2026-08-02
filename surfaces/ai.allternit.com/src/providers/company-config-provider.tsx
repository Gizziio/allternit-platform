'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { setupApi, type CompanyConfig } from '@/services/setup-api';
import { isSelfHosted } from '@/lib/env';

interface CompanyConfigContextValue {
  config: CompanyConfig | null;
  isLoading: boolean;
  error: Error | null;
}

const CompanyConfigContext = createContext<CompanyConfigContextValue>({
  config: null,
  isLoading: true,
  error: null,
});

export function CompanyConfigProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // /api/onboarding/config is served by a local allternit-api instance —
    // real on desktop/self-hosted builds (backend-manager.ts points
    // VITE_ALLTERNIT_API_URL at 127.0.0.1:8013), but there is no backend at
    // all behind a hosted static deployment like ai.allternit.com. Calling
    // it there always resolves to the SPA's own index.html (200, wrong
    // content-type) instead of a real config response or a clean 404.
    // Skip the call entirely when not self-hosted; Clerk and everything
    // else already falls back to build-time env vars when config is null.
    if (!isSelfHosted()) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setupApi
      .getConfig()
      .then((data) => {
        if (!cancelled) {
          setConfig(data.company);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CompanyConfigContext.Provider value={{ config, isLoading, error }}>
      {children}
    </CompanyConfigContext.Provider>
  );
}

export function useCompanyConfig(): CompanyConfigContextValue {
  return useContext(CompanyConfigContext);
}
