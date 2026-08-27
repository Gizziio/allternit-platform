import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getVaultRoot } from './vault.js';
import { getSettings, updateSettings } from './settings.js';

/**
 * Obsidian community plugin support (PRD FR-8).
 * Plugins live in `<vault>/.obsidian/plugins/<id>/` with manifest.json + main.js
 * (+ optional styles.css), exactly like the desktop app. The server lists,
 * installs (from GitHub releases) and toggles them; the browser loads main.js
 * against the Obsidian API shim (see web/src/lib/obsidian-shim).
 */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion?: string;
  description?: string;
  author?: string;
  authorUrl?: string;
  isDesktopOnly?: boolean;
}

export interface InstalledPlugin extends PluginManifest {
  enabled: boolean;
  hasStyles: boolean;
  dir: string; // vault-relative
}

async function pluginsDir(): Promise<string> {
  const root = await getVaultRoot();
  return path.join(root, '.obsidian', 'plugins');
}

/**
 * A plugin id becomes a path segment under `.obsidian/plugins/`, both when
 * installing (taken from a *remote* manifest.json) and when serving assets
 * (taken from the URL). Reject anything that isn't a plain id so a crafted
 * `../../..` can't read or write outside the plugins directory.
 */
function assertSafeId(id: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(id) || id === '.' || id === '..') {
    throw Object.assign(new Error('Invalid plugin id'), { status: 400 });
  }
  return id;
}

export async function listInstalled(): Promise<InstalledPlugin[]> {
  const dir = await pluginsDir();
  const s = await getSettings();
  let entries: string[] = [];
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
  const out: InstalledPlugin[] = [];
  for (const id of entries) {
    try {
      const manifestRaw = await fs.readFile(path.join(dir, id, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestRaw) as PluginManifest;
      const hasStyles = await fileExists(path.join(dir, id, 'styles.css'));
      out.push({
        ...manifest,
        id: manifest.id || id,
        enabled: s.plugins.enabled.includes(manifest.id || id),
        hasStyles,
        dir: `.obsidian/plugins/${id}`,
      });
    } catch {
      /* skip invalid plugin dir */
    }
  }
  return out;
}

export async function getPluginAsset(
  id: string,
  asset: 'main.js' | 'styles.css' | 'manifest.json',
): Promise<string> {
  assertSafeId(id);
  const dir = await pluginsDir();
  return fs.readFile(path.join(dir, id, asset), 'utf8');
}

export async function setEnabled(id: string, enabled: boolean): Promise<void> {
  assertSafeId(id);
  await updateSettings((d) => {
    const set = new Set(d.plugins.enabled);
    if (enabled) set.add(id);
    else set.delete(id);
    d.plugins.enabled = [...set];
  });
}

/**
 * Install a community plugin from a GitHub repo (owner/repo). Pulls
 * manifest.json + main.js (+ styles.css) from the latest release assets.
 */
export async function installFromGithub(repo: string): Promise<InstalledPlugin> {
  const clean = repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').trim();
  const relApi = `https://api.github.com/repos/${clean}/releases/latest`;
  const res = await fetch(relApi, { headers: { 'User-Agent': 'WebObsidian' } });
  if (!res.ok) throw new Error(`GitHub release lookup failed: ${res.status}`);
  const release = (await res.json()) as { assets: { name: string; browser_download_url: string }[] };
  const assets = Object.fromEntries(release.assets.map((a) => [a.name, a.browser_download_url]));
  if (!assets['manifest.json'] || !assets['main.js']) {
    throw new Error('Release missing manifest.json or main.js');
  }

  const manifest = JSON.parse(await fetchText(assets['manifest.json'])) as PluginManifest;
  // id comes from a REMOTE manifest — validate before it becomes a path segment
  // (a crafted `../../..` would otherwise write main.js outside the plugins dir).
  const id = assertSafeId(manifest.id || clean.split('/')[1]);
  const dir = await pluginsDir();
  const target = path.join(dir, id);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(target, 'main.js'), await fetchText(assets['main.js']));
  if (assets['styles.css']) {
    await fs.writeFile(path.join(target, 'styles.css'), await fetchText(assets['styles.css']));
  }
  await updateSettings((d) => {
    if (!d.plugins.installed.includes(id)) d.plugins.installed.push(id);
  });
  const installed = await listInstalled();
  const found = installed.find((p) => p.id === id);
  if (!found) throw new Error('Install verification failed');
  return found;
}

async function fetchText(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': 'WebObsidian' } });
  if (!r.ok) throw new Error(`Download failed: ${url} (${r.status})`);
  return r.text();
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
