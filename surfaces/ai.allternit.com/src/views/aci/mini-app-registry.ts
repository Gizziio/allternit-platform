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
  };
}
