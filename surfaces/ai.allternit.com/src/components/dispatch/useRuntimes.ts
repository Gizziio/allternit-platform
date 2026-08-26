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
  refresh: () => void;
}

export function useRuntimes(): UseRuntimesResult {
  const auth = usePlatformAuth();
  const [runtimes, setRuntimes] = useState<RuntimeViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuntimes = useCallback(async () => {
    try {
      const token = await auth.getToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/runtime-devices`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        if (res.status === 401) {
          setRuntimes([]);
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
    }
  }, [auth]);

  useEffect(() => {
    void fetchRuntimes();
    const interval = setInterval(fetchRuntimes, 10000);
    return () => clearInterval(interval);
  }, [fetchRuntimes]);

  return { runtimes, loading, error, refresh: fetchRuntimes };
}
