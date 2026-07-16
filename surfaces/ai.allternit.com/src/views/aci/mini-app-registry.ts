import type { InstalledMiniApp, MiniAppManifest, MiniAppSource } from './mini-app.types';

const STORAGE_KEY = 'allternit-mini-apps';

function catalogSourceFor(source: MiniAppSource): InstalledMiniApp['catalogSource'] {
  if (source === 'connector') return 'mcp';
  if (source === 'builtin') return 'allternit';
  if (source === 'discovered') return 'local';
  return source;
}

export function getPinnedMiniApps(): InstalledMiniApp[] {
  return getInstalledMiniApps().filter((app) => app.isPinned !== false);
}

export function getInstalledMiniApps(): InstalledMiniApp[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function pinMiniApp(app: Omit<InstalledMiniApp, 'status' | 'pinnedAt'>): void {
  const installed = getInstalledMiniApps();
  const existing = installed.find((item) => item.id === app.id);
  const updated: InstalledMiniApp[] = existing
    ? installed.map((item) => item.id === app.id ? { ...item, ...app, isPinned: true, installState: app.installState || item.installState || 'installed', pinnedAt: item.pinnedAt || new Date().toISOString() } : item)
    : [...installed, { ...app, status: 'pinned', isPinned: true, installState: app.installState || 'installed', runtimeState: app.runtimeState || 'unknown', pinnedAt: new Date().toISOString() }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('allternit:mini-apps-changed'));
}

export function unpinMiniApp(id: string): void {
  const updated = getInstalledMiniApps().map((app) => app.id === id ? { ...app, isPinned: false } : app);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('allternit:mini-apps-changed'));
}

export function removeMiniApp(id: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getInstalledMiniApps().filter((app) => app.id !== id)));
  window.dispatchEvent(new CustomEvent('allternit:mini-apps-changed'));
}

export function saveMiniApp(app: InstalledMiniApp): void {
  const installed = getInstalledMiniApps();
  const updated = installed.some((item) => item.id === app.id)
    ? installed.map((item) => item.id === app.id ? { ...item, ...app } : item)
    : [...installed, app];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('allternit:mini-apps-changed'));
}

export function updateMiniAppStatus(id: string, status: InstalledMiniApp['status']): void {
  const updated = getInstalledMiniApps().map((p) =>
    p.id === id ? { ...p, status, runtimeState: status === 'running' ? 'running' as const : status === 'offline' ? 'stopped' as const : p.runtimeState, lastSeenAt: new Date().toISOString() } : p,
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
    catalogSource: catalogSourceFor(source),
    presentation: manifest.presentation,
    surface: manifest.surface,
    harness: manifest.harness,
    lifecycle: manifest.lifecycle,
    permissions: manifest.permissions,
    compatibility: manifest.compatibility,
    release: manifest.release,
  };
}

const SEED_KEY = 'allternit-mini-apps-seeded-v3';

export function seedDefaultMiniApps(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(SEED_KEY) === '1') return;
    localStorage.setItem(SEED_KEY, '1');
    const existing = getInstalledMiniApps();
    const defaults: Array<Omit<InstalledMiniApp, 'status' | 'pinnedAt'>> = [
      {
        id: 'openclaw',
        name: 'OpenClaw',
        description: 'Official OpenClaw personal-agent gateway and control UI.',
        category: 'runtime',
        source: 'builtin',
        catalogSource: 'allternit',
        verified: true,
        featured: true,
        url: 'http://localhost:18789',
        sourceUrl: 'http://localhost:18789',
        repo: 'openclaw/openclaw',
        githubUrl: 'https://github.com/openclaw/openclaw',
        downloadable: true,
        presentation: { mode: 'hybrid', uiUrl: 'http://127.0.0.1:18789', healthUrl: 'http://127.0.0.1:18789', electronPartition: 'persist:allternit-openclaw', nativeRenderer: 'openclaw', fallback: 'external-browser' },
        surface: { kind: 'embedded-web', url: 'http://127.0.0.1:18789', viewType: 'openclaw' },
        harness: { transport: 'acp', command: 'openclaw acp', model: 'openclaw' },
      },
      {
        id: 'hermes',
        name: 'Hermes',
        description: 'Nous Research self-improving agent and messaging gateway.',
        category: 'connector',
        source: 'builtin',
        catalogSource: 'allternit',
        verified: true,
        featured: true,
        url: 'http://localhost:18790',
        sourceUrl: 'http://localhost:18790',
        repo: 'NousResearch/hermes-agent',
        githubUrl: 'https://github.com/NousResearch/hermes-agent',
        downloadable: true,
        presentation: { mode: 'hybrid', uiUrl: 'http://127.0.0.1:9119', healthUrl: 'http://127.0.0.1:9119', electronPartition: 'persist:allternit-hermes', nativeRenderer: 'hermes', fallback: 'external-browser' },
        surface: { kind: 'embedded-web', url: 'http://127.0.0.1:9119', viewType: 'hermes', desktopAction: 'hermes' },
        harness: { transport: 'http', baseURL: 'http://127.0.0.1:9119/v1', model: 'hermes-agent' },
      },
      {
        id: 'oh-my-pi',
        name: 'Oh My Pi',
        description: 'Terminal coding agent with RPC, ACP, browser tools, and subagents.',
        category: 'runtime',
        source: 'builtin',
        catalogSource: 'allternit',
        verified: true,
        url: 'https://omp.sh',
        sourceUrl: 'https://omp.sh',
        repo: 'can1357/oh-my-pi',
        githubUrl: 'https://github.com/can1357/oh-my-pi',
        downloadable: true,
        presentation: { mode: 'native', nativeRenderer: 'oh-my-pi', fallback: 'native-tools' },
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
  const pinned = getInstalledMiniApps();
  const updated = pinned.map((p) =>
    p.id === id ? { ...p, installState: installStatus === 'installed' ? 'installed' as const : 'installing' as const, status: installStatus === 'installed' ? 'pinned' : p.status } : p,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('allternit:mini-apps-changed'));
}
