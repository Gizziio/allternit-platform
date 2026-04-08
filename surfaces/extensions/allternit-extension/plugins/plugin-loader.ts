/**
 * Chrome Extension Plugin Loader
 *
 * Auto-loads all plugins registered in plugin-registry.json at extension boot.
 * Plugins stay co-located with this file — no separate plugins/built-in/ directory.
 *
 * To add a new plugin:
 *   1. Create plugins/<name>/.claude-plugin/plugin.json
 *   2. Add an entry to plugins/plugin-registry.json
 *   Done — this loader picks it up automatically.
 */

import registry from './plugin-registry.json';

// Static imports of each plugin manifest — Vite/WXT resolves these at build time.
// Add one import per entry in plugin-registry.json.
import chromeManifest from './chrome/.claude-plugin/plugin.json';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LoadedPlugin {
  id: string;
  manifest: Record<string, unknown>;
  /** Absolute path to the plugin directory within the extension bundle */
  basePath: string;
}

// ── Manifest map ─────────────────────────────────────────────────────────────
// Keyed by plugin id as declared in plugin-registry.json.

const BUNDLED_MANIFESTS: Record<string, Record<string, unknown>> = {
  'allternit-chrome': chromeManifest as Record<string, unknown>,
};

// ── Loader ───────────────────────────────────────────────────────────────────

/**
 * Returns all plugins registered in plugin-registry.json, merged with
 * their bundled manifests. Called once at extension boot.
 */
export function loadPlugins(): LoadedPlugin[] {
  return registry.plugins
    .filter((entry) => BUNDLED_MANIFESTS[entry.id] !== undefined)
    .map((entry) => ({
      id: entry.id,
      manifest: BUNDLED_MANIFESTS[entry.id],
      basePath: entry.path,
    }));
}

/**
 * Returns the single active plugin for this Chrome extension.
 * There is currently one plugin (allternit-chrome), but the loader
 * supports multiple for future expansion.
 */
export function getActivePlugin(): LoadedPlugin | null {
  const plugins = loadPlugins();
  return plugins[0] ?? null;
}
