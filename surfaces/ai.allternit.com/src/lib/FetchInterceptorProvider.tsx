"use client"

import React, { useEffect } from 'react';
import { installFetchInterceptor } from "./fetch-interceptor"
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { allternitCloudOrigin } from '@/lib/cloud-api';
import {
  ACTIVE_RUNTIME_ID_KEY,
  applyRuntimeIdFromSearch,
  getRuntimeExecutionTarget,
} from '@/lib/runtime-target';

// Install the fetch patch at module scope so it is in place BEFORE any child
// component's effects run. Mounting it in useEffect let first-mount fetches
// escape interception and hit the SPA catch-all (a real HTML 200). Until the
// auth effect below supplies the Clerk token getter, the interceptor falls
// back to localStorage for the bearer token.
// installFetchInterceptor is idempotent (guarded by
// __allternitFetchInterceptorInstalled), so StrictMode double-render and
// repeated calls only refresh the token getter.
if (typeof window !== 'undefined') {
  applyRuntimeIdFromSearch();
  installFetchInterceptor();
}

export function FetchInterceptorProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = usePlatformAuth();

  useEffect(() => {
    installFetchInterceptor(getToken)
  }, [getToken])

  useEffect(() => {
    const isDesktop = typeof window !== 'undefined' && Boolean(window.allternitSidecar);
    if (!isLoaded || !isSignedIn || isDesktop) return;
    const controller = new AbortController();
    const refresh = async () => {
      const token = await getToken();
      if (!token || controller.signal.aborted) return;
      const base = allternitCloudOrigin();
      const response = await fetch(`${base}/api/v1/runtime-devices`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok) return;
      const payload = await response.json() as { runtimes?: Array<{ id: string; status: string }> };
      const runtimes = payload.runtimes || [];
      const selected = localStorage.getItem(ACTIVE_RUNTIME_ID_KEY);
      if (selected && runtimes.some((runtime) => runtime.id === selected && runtime.status === 'online')) return;
      const online = runtimes.find((runtime) => runtime.status === 'online');
      if (online) localStorage.setItem(ACTIVE_RUNTIME_ID_KEY, online.id);
      else if (getRuntimeExecutionTarget() === 'cloud') localStorage.removeItem(ACTIVE_RUNTIME_ID_KEY);
    };
    void refresh().catch(() => {});
    const interval = window.setInterval(() => void refresh().catch(() => {}), 30_000);
    const onFocus = () => void refresh().catch(() => {});
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [getToken, isLoaded, isSignedIn])

  return <>{children}</>
}
