"use client"

import React, { useEffect } from 'react';
import { installFetchInterceptor } from "./fetch-interceptor"
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { env } from '@/lib/env';

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
      const base = env('NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL', 'https://allternit-cloud-api.fly.dev')!.replace(/\/$/, '');
      const response = await fetch(`${base}/api/v1/runtime-devices`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok) return;
      const payload = await response.json() as { runtimes?: Array<{ id: string; status: string }> };
      const runtimes = payload.runtimes || [];
      const selected = localStorage.getItem('allternit.active-runtime-id');
      if (selected && runtimes.some((runtime) => runtime.id === selected && runtime.status === 'online')) return;
      const online = runtimes.find((runtime) => runtime.status === 'online');
      if (online) localStorage.setItem('allternit.active-runtime-id', online.id);
      else localStorage.removeItem('allternit.active-runtime-id');
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
