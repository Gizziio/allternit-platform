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
    surface: manifest.surface,
    harness: manifest.harness,
    lifecycle: manifest.lifecycle,
  };
}

const SEED_KEY = 'allternit-mini-apps-seeded-v2';

export function seedDefaultMiniApps(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(SEED_KEY) === '1') return;
    localStorage.setItem(SEED_KEY, '1');
    const existing = getPinnedMiniApps();
    const defaults: Array<Omit<InstalledMiniApp, 'status' | 'pinnedAt'>> = [
      {
        id: 'openclaw',
        name: 'OpenClaw',
        description: 'Official OpenClaw personal-agent gateway and control UI.',
        category: 'runtime',
        source: 'builtin',
        url: 'http://localhost:18789',
        sourceUrl: 'http://localhost:18789',
        repo: 'openclaw/openclaw',
        githubUrl: 'https://github.com/openclaw/openclaw',
        downloadable: true,
        surface: { kind: 'embedded-web', url: 'http://127.0.0.1:18789', viewType: 'openclaw' },
        harness: { transport: 'acp', command: 'openclaw acp', model: 'openclaw' },
      },
      {
        id: 'hermes',
        name: 'Hermes',
        description: 'Nous Research self-improving agent and messaging gateway.',
        category: 'connector',
        source: 'builtin',
        url: 'http://localhost:18790',
        sourceUrl: 'http://localhost:18790',
        repo: 'NousResearch/hermes-agent',
        githubUrl: 'https://github.com/NousResearch/hermes-agent',
        downloadable: true,
        surface: { kind: 'embedded-web', url: 'http://127.0.0.1:9119', viewType: 'hermes', desktopAction: 'hermes' },
        harness: { transport: 'http', baseURL: 'http://127.0.0.1:9119/v1', model: 'hermes-agent' },
      },
      {
        id: 'oh-my-pi',
        name: 'Oh My Pi',
        description: 'Terminal coding agent with RPC, ACP, browser tools, and subagents.',
        category: 'runtime',
        source: 'builtin',
        url: 'https://omp.sh',
        sourceUrl: 'https://omp.sh',
        repo: 'can1357/oh-my-pi',
        githubUrl: 'https://github.com/can1357/oh-my-pi',
        downloadable: true,
        surface: { kind: 'allternit-native', viewType: 'oh-my-pi' },
        harness: { transport: 'acp', command: 'omp acp', model: 'omp' },
      },
    ];
    const correctedIds = new Set(defaults.map((app) => app.id));
    const corrected = existing.filter((app) => !correctedIds.has(app.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corrected));
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
