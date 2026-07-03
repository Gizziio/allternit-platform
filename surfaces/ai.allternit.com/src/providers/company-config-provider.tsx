'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { setupApi, type CompanyConfig } from '@/services/setup-api';

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
