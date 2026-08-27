'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { env } from '@/lib/env';

export interface RuntimeViewModel {
  id: string;
  name: string;
  host: string;
  status: 'online' | 'offline' | 'busy';
  lastHeartbeatAt?: number;
  capabilities: string[];
}

interface CloudRuntimeDevice {
  id: string;
  name: string;
  runtimeType: string;
  hostname: string | null;
  platform: string | null;
  version: string | null;
  capabilities: string[];
  status: string;
  lastSeenAt: string | null;
}

const API_BASE_URL = env('VITE_ALLTERNIT_API_URL') ?? 'https://api.allternit.com';

// DEV BYPASS: mock runtimes for local UI iteration when Clerk is disabled.
const MOCK_RUNTIMES: RuntimeViewModel[] = [
  {
    id: 'dev-runtime-macbook',
    name: 'Joe’s MacBook Pro',
    host: 'macOS · joe-macbook-pro',
    status: 'online',
    lastHeartbeatAt: Date.now(),
    capabilities: ['shell', 'browser', 'computer-use', 'file-system'],
  },
  {
    id: 'dev-runtime-studio',
    name: 'Allternit Studio',
    host: 'Linux · allternit-studio',
    status: 'busy',
    lastHeartbeatAt: Date.now() - 120_000,
    capabilities: ['shell', 'browser', 'code-execution'],
  },
  {
    id: 'dev-runtime-windows',
    name: 'Windows Host',
    host: 'Windows · allternit-win-host',
    status: 'offline',
    lastHeartbeatAt: Date.now() - 3_600_000,
    capabilities: ['shell', 'browser'],
  },
];

function deviceToViewModel(device: CloudRuntimeDevice): RuntimeViewModel {
  return {
    id: device.id,
    name: device.name || device.hostname || 'Unnamed machine',
    host: `${device.platform ?? 'Unknown'} · ${device.hostname ?? device.runtimeType}`,
    status: device.status === 'online' ? 'online' : device.status === 'busy' ? 'busy' : 'offline',
    lastHeartbeatAt: device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : undefined,
    capabilities: device.capabilities ?? [],
  };
}

export interface UseRuntimesResult {
  runtimes: RuntimeViewModel[];
  loading: boolean;
  error: string | null;
  isMock: boolean;
  lastRefreshedAt: number | null;
  refresh: () => void;
}

export function useRuntimes(): UseRuntimesResult {
  const auth = usePlatformAuth();
  const [runtimes, setRuntimes] = useState<RuntimeViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  const fetchRuntimes = useCallback(async () => {
    try {
      const token = await auth.getToken();
      // DEV BYPASS: serve mock runtimes only when explicitly enabled in local dev.
      if (token === 'dev-token' && env('ALLTERNIT_LOCAL_DEV_BYPASS') === 'true') {
        setRuntimes(MOCK_RUNTIMES);
        setIsMock(true);
        setError(null);
        setLoading(false);
        setLastRefreshedAt(Date.now());
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/v1/runtime-devices`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setIsMock(false);
      if (!res.ok) {
        if (res.status === 401) {
          setRuntimes([]);
          setLoading(false);
          setLastRefreshedAt(Date.now());
          return;
        }
        throw new Error(`Failed to load runtimes (${res.status})`);
      }
      const data = (await res.json()) as { runtimes?: CloudRuntimeDevice[] } | CloudRuntimeDevice[];
      const devices = Array.isArray(data) ? data : data.runtimes ?? [];
      setRuntimes(devices.map(deviceToViewModel));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setLastRefreshedAt(Date.now());
    }
  }, [auth]);

  useEffect(() => {
    void fetchRuntimes();
    // MVP: short-poll for machine status. A future upgrade can replace this
    // with a server-sent event (SSE) stream from the cloud relay so online/
    // offline transitions appear instantly without polling.
    const interval = setInterval(fetchRuntimes, 10000);
    return () => clearInterval(interval);
  }, [fetchRuntimes]);

  return { runtimes, loading, error, isMock, lastRefreshedAt, refresh: fetchRuntimes };
}
