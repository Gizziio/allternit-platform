import type { InstalledMiniApp, MiniAppManifest, MiniAppSource } from './mini-app.types';

const STORAGE_KEY = 'allternit-mini-apps';

export function getPinnedMiniApps(): InstalledMiniApp[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function pinMiniApp(app: Omit<InstalledMiniApp, 'status' | 'pinnedAt'>): void {
  const pinned = getPinnedMiniApps();
  if (pinned.some((p) => p.id === app.id)) return;
  const updated: InstalledMiniApp[] = [
    ...pinned,
    { ...app, status: 'pinned', pinnedAt: new Date().toISOString() },
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('allternit:mini-apps-changed'));
}

export function unpinMiniApp(id: string): void {
  const updated = getPinnedMiniApps().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('allternit:mini-apps-changed'));
}

export function updateMiniAppStatus(id: string, status: InstalledMiniApp['status']): void {
  const updated = getPinnedMiniApps().map((p) =>
    p.id === id ? { ...p, status, lastSeenAt: new Date().toISOString() } : p,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('allternit:mini-apps-changed'));
}

export function manifestToMiniApp(
  manifest: MiniAppManifest,
  url: string,
  source: MiniAppSource,
): Omit<InstalledMiniApp, 'status' | 'pinnedAt'> {
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    icon: manifest.icon,
    category: manifest.category,
    source,
    url,
    sourceUrl: url,
    repo: manifest.repo,
    githubUrl: manifest.githubUrl,
    downloadable: manifest.downloadable,
  };
}

const SEED_KEY = 'allternit-mini-apps-seeded';

export function seedDefaultMiniApps(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(SEED_KEY) === '1') return;
    localStorage.setItem(SEED_KEY, '1');
    const existing = getPinnedMiniApps();
    if (existing.length > 0) return;
    const defaults: Array<Omit<InstalledMiniApp, 'status' | 'pinnedAt'>> = [
      {
        id: 'openclaw',
        name: 'OpenClaw',
        description: 'Agent coding runtime and control UI.',
        category: 'runtime',
        source: 'builtin',
        url: 'http://localhost:18789',
        sourceUrl: 'http://localhost:18789',
        repo: 'openclaw-sh/openclaw',
        githubUrl: 'https://github.com/openclaw-sh/openclaw',
        downloadable: true,
      },
      {
        id: 'hermes',
        name: 'Hermes',
        description: 'Connector and messaging runtime.',
        category: 'connector',
        source: 'builtin',
        url: 'http://localhost:18790',
        sourceUrl: 'http://localhost:18790',
        repo: 'allternit/hermes',
        githubUrl: 'https://github.com/allternit/hermes',
        downloadable: true,
      },
    ];
    for (const app of defaults) pinMiniApp(app);
  } catch {
    // private mode / localStorage unavailable
  }
}

export function updateMiniAppInstallStatus(id: string, installStatus: 'installing' | 'installed'): void {
  const pinned = getPinnedMiniApps();
  const updated = pinned.map((p) =>
    p.id === id ? { ...p, status: installStatus === 'installed' ? 'pinned' : p.status } : p,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('allternit:mini-apps-changed'));
}
