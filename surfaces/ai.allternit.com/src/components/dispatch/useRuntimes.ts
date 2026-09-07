'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { env } from '@/lib/env';
import { allternitCloudOrigin } from '@/lib/cloud-api';
import { buildAuthHeaders } from '@/lib/agents/api-config';

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

async function thisDesktopRuntime(): Promise<RuntimeViewModel | null> {
  try {
    const session = await window.allternit?.auth?.getSession?.();
    if (!session?.runtimeId) return null;
    return {
      id: session.runtimeId,
      name: 'This desktop',
      host: `${navigator.platform || 'Desktop'} · Allternit Desktop`,
      status: 'online',
      lastHeartbeatAt: Date.now(),
      capabilities: session.capabilities ?? [],
    };
  } catch {
    return null;
  }
}

function mergeRuntimes(devices: RuntimeViewModel[], local: RuntimeViewModel | null): RuntimeViewModel[] {
  if (!local) return devices;
  if (devices.some((device) => device.id === local.id)) {
    return devices.map((device) => (device.id === local.id ? { ...device, ...local, status: 'online' } : device));
  }
  return [local, ...devices];
}

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

// Cloud-api flips status to offline 2 minutes after last_seen, but Desktop
// heartbeats every 5 minutes. Treat a recent heartbeat as online so the
// PWA does not flap between heartbeats.
const HEARTBEAT_ONLINE_GRACE_MS = 10 * 60 * 1000;

function deviceStatus(device: CloudRuntimeDevice): RuntimeViewModel['status'] {
  if (device.status === 'busy') return 'busy';
  if (device.status === 'online') return 'online';
  const seen = device.lastSeenAt ? Date.now() - new Date(device.lastSeenAt).getTime() : NaN;
  if (Number.isFinite(seen) && seen >= 0 && seen < HEARTBEAT_ONLINE_GRACE_MS) return 'online';
  return 'offline';
}

function deviceToViewModel(device: CloudRuntimeDevice): RuntimeViewModel {
  return {
    id: device.id,
    name: device.name || device.hostname || 'Unnamed machine',
    host: `${device.platform ?? 'Unknown'} · ${device.hostname ?? device.runtimeType}`,
    status: deviceStatus(device),
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
    const local = await thisDesktopRuntime();
    const done = (next?: RuntimeViewModel[]) => {
      if (next) setRuntimes(next);
      setError(null);
      setLoading(false);
      setLastRefreshedAt(Date.now());
    };
    try {
      if (!auth.isSignedIn) {
        done(local ? [local] : []);
        return;
      }
      const token = await auth.getToken();
      // DEV BYPASS: serve mock runtimes only when explicitly enabled in local dev.
      if (token === 'dev-token' && env('ALLTERNIT_LOCAL_DEV_BYPASS') === 'true') {
        setIsMock(true);
        done(mergeRuntimes(MOCK_RUNTIMES, local));
        return;
      }
      if (!token) {
        return;
      }
      const headers = await buildAuthHeaders();
      headers.Authorization = `Bearer ${token}`;
      const cloudOrigin = allternitCloudOrigin();
      const res = await fetch(`${cloudOrigin}/api/v1/runtime-devices`, { headers });
      setIsMock(false);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return;
        }
        if (res.status === 404) {
          done(local ? [local] : []);
          return;
        }
        throw new Error(`Failed to load runtimes (${res.status})`);
      }
      const data = (await res.json()) as { runtimes?: CloudRuntimeDevice[] } | CloudRuntimeDevice[];
      const devices = Array.isArray(data) ? data : data.runtimes ?? [];
      done(mergeRuntimes(devices.map(deviceToViewModel), local));
    } catch (err) {
      if (local) {
        done([local]);
      } else {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
        setLastRefreshedAt(Date.now());
      }
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
