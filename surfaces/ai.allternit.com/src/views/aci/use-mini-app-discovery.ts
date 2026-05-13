"use client";

import { useEffect, useState, useCallback } from 'react';
import type { InstalledMiniApp, MiniAppManifest } from './mini-app.types';
import { getPinnedMiniApps, manifestToMiniApp, updateMiniAppStatus } from './mini-app-registry';

/** Ports the platform silently probes for /.well-known/allternit-app.json */
const KNOWN_PORTS = [18789, 18790];
const MANIFEST_PATH = '/.well-known/allternit-app.json';
const PROBE_TIMEOUT_MS = 1500;
const BUILTIN_MINI_APPS: Array<{
  port: number;
  manifest: MiniAppManifest;
}> = [
  {
    port: 18789,
    manifest: {
      id: 'openclaw',
      name: 'OpenClaw',
      description: 'Agent coding runtime and control UI.',
      version: 'local',
      category: 'runtime',
      pinnable: true,
    },
  },
  {
    port: 18790,
    manifest: {
      id: 'hermes',
      name: 'Hermes',
      description: 'Connector and messaging runtime.',
      version: 'local',
      category: 'connector',
      pinnable: true,
    },
  },
];

async function probePort(port: number): Promise<InstalledMiniApp | null> {
  const base = `http://localhost:${port}`;
  try {
    const res = await fetch(`${base}${MANIFEST_PATH}`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const manifest: MiniAppManifest = await res.json();
    return {
      ...manifestToMiniApp(manifest, base, 'discovered'),
      status: 'available',
      lastSeenAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function useMiniAppDiscovery() {
  const [discovered, setDiscovered] = useState<InstalledMiniApp[]>([]);
  const [pinned, setPinned] = useState<InstalledMiniApp[]>(getPinnedMiniApps);
  const [probing, setProbing] = useState(false);

  const probe = useCallback(async () => {
    setProbing(true);
    const results = await Promise.all(KNOWN_PORTS.map(probePort));
    const found = results.filter((r): r is InstalledMiniApp => r !== null);
    const withBuiltins = BUILTIN_MINI_APPS.map(({ port, manifest }) => {
      const base = `http://localhost:${port}`;
      const live = found.find((app) => app.id === manifest.id || app.sourceUrl === base);
      if (live) return live;
      return {
        ...manifestToMiniApp(manifest, base, 'builtin'),
        status: 'offline' as const,
      };
    });

    // Update status of pinned apps that we can now see are online/offline
    const pinnedNow = getPinnedMiniApps();
    for (const app of pinnedNow) {
      if (!app.sourceUrl) continue;
      const isOnline = withBuiltins.some((f) => f.sourceUrl === app.sourceUrl && f.status !== 'offline');
      const newStatus = isOnline ? 'running' : app.status === 'running' ? 'offline' : app.status;
      if (newStatus !== app.status) updateMiniAppStatus(app.id, newStatus);
    }

    setDiscovered(withBuiltins);
    setProbing(false);
  }, []);

  // Re-sync pinned list when registry changes
  const syncPinned = useCallback(() => {
    setPinned(getPinnedMiniApps());
  }, []);

  useEffect(() => {
    probe();
    window.addEventListener('allternit:mini-apps-changed', syncPinned);
    return () => window.removeEventListener('allternit:mini-apps-changed', syncPinned);
  }, [probe, syncPinned]);

  // All mini-apps: pinned first, then discovered-but-not-yet-pinned
  const all = [
    ...pinned,
    ...discovered.filter((d) => !pinned.some((p) => p.id === d.id)),
  ];

  return { all, discovered, pinned, probing, reprobe: probe };
}
