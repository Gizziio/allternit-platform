import type { MarketplacePlugin } from '../../../plugins/capability.types';
import JSZip from 'jszip';

export function normalizeMarketplacePluginPayload(
  payload: any,
  defaults: Partial<MarketplacePlugin> = {}
): MarketplacePlugin | null {
  if (!payload || typeof payload !== 'object') return null;

  const id = payload.id || payload.$id || defaults.id;
  if (!id) return null;

  return {
    id,
    name: payload.name || defaults.name || 'Unknown Plugin',
    description: payload.description || defaults.description || '',
    version: payload.version || defaults.version || '1.0.0',
    author: payload.author || defaults.author || 'Unknown',
    category: payload.category || defaults.category || 'other',
    icon: payload.icon || defaults.icon,
    rating: payload.rating || 0,
    installCount: payload.installCount || 0,
    sourceLabel: defaults.sourceLabel,
    sourceTrust: defaults.sourceTrust,
    sourceUrl: defaults.sourceUrl,
    sourceDescriptor: defaults.sourceDescriptor,
    ...payload,
  };
}

export function parseGitHubRepoRef(value: string): { owner: string; repo: string } | null {
  if (!value) return null;
  const match = value.match(/github\.com\/([^/]+)\/([^/]+)/) || value.match(/^([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}

export function isVersionNewer(remoteVersion: string | undefined, localVersion: string | undefined): boolean {
  if (!remoteVersion) return false;
  if (!localVersion) return true;

  const r = remoteVersion.split('.').map(Number);
  const l = localVersion.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true;
    if ((r[i] || 0) < (l[i] || 0)) return false;
  }
  return false;
}

export function isPluginBlockedByTrustPolicy(plugin: MarketplacePlugin, allowUntrusted: boolean): boolean {
  if (allowUntrusted) return false;
  if (plugin.sourceTrust === 'official' || plugin.sourceTrust === 'verified') return false;
  return true;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function extractPluginRecordsFromZip(file: File): Promise<unknown[]> {
  const zip = await JSZip.loadAsync(file);
  const records: unknown[] = [];
  
  for (const [path, entry] of Object.entries(zip.files)) {
    if (path.endsWith('plugin.json')) {
      const content = await entry.async('string');
      try {
        records.push(JSON.parse(content));
      } catch {
        // Skip invalid JSON
      }
    }
  }
  
  return records;
}
