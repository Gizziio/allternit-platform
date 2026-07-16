"use client";

import { useEffect, useState, useCallback } from 'react';
import type { InstalledMiniApp, MiniAppManifest } from './mini-app.types';
import { getInstalledMiniApps, manifestToMiniApp, updateMiniAppStatus } from './mini-app-registry';

/** Ports the platform silently probes for /.well-known/allternit-app.json */
const KNOWN_PORTS = [18789];
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
      description: 'Official OpenClaw personal-agent gateway and control UI.',
      version: 'local',
      category: 'runtime',
      pinnable: true,
      repo: 'openclaw/openclaw',
      githubUrl: 'https://github.com/openclaw/openclaw',
      downloadable: true,
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

// Reachability check for apps that don't serve the JSON manifest (e.g. OpenClaw
// serves its own SPA at all routes). Uses no-cors so CORS headers are irrelevant.
async function checkReachable(port: number): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}/`, {
      mode: 'no-cors',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return true;
  } catch {
    return false;
  }
}

export function useMiniAppDiscovery() {
  const [discovered, setDiscovered] = useState<InstalledMiniApp[]>([]);
  const [installed, setInstalled] = useState<InstalledMiniApp[]>(getInstalledMiniApps);
  const [probing, setProbing] = useState(false);

  const probe = useCallback(async () => {
    setProbing(true);
    const [manifestResults, reachable] = await Promise.all([
      Promise.all(KNOWN_PORTS.map(probePort)),
      Promise.all(KNOWN_PORTS.map(checkReachable)),
    ]);
    const found = manifestResults.filter((r): r is InstalledMiniApp => r !== null);
    const withBuiltins = BUILTIN_MINI_APPS.map(({ port, manifest }) => {
      const base = `http://localhost:${port}`;
      const portIdx = KNOWN_PORTS.indexOf(port);
      // Prefer a full manifest response; fall back to reachability for apps
      // (like OpenClaw) that serve their own SPA at all routes.
      const live = found.find((app) => app.id === manifest.id || app.sourceUrl === base);
      if (live) return live;
      const isUp = portIdx >= 0 && reachable[portIdx];
      return {
        ...manifestToMiniApp(manifest, base, 'builtin'),
        status: isUp ? 'available' as const : 'offline' as const,
      };
    });

    // Update status of pinned apps that we can now see are online/offline
    const pinnedNow = getInstalledMiniApps();
    for (const app of pinnedNow) {
      const desktopStatus = window.allternit?.miniApps
        ? await window.allternit.miniApps.getStatus(app.id).catch(() => null)
        : null;
      const isOnline = desktopStatus?.running ?? withBuiltins.some((f) => f.id === app.id && f.status !== 'offline');
      const newStatus = isOnline ? 'running' : 'offline';
      if (newStatus !== app.status) updateMiniAppStatus(app.id, newStatus);
    }

    setDiscovered(withBuiltins);
    setProbing(false);
  }, []);

  // Re-sync pinned list when registry changes
  const syncPinned = useCallback(() => {
    setInstalled(getInstalledMiniApps());
  }, []);

  useEffect(() => {
    probe();
    window.addEventListener('allternit:mini-apps-changed', syncPinned);
    return () => window.removeEventListener('allternit:mini-apps-changed', syncPinned);
  }, [probe, syncPinned]);

  // All mini-apps: pinned first, then discovered-but-not-yet-pinned
  const all = [
    ...installed,
    ...discovered.filter((d) => !installed.some((p) => p.id === d.id)),
  ];

  return { all, discovered, installed, pinned: installed, probing, reprobe: probe };
}
