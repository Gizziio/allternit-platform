import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SitePluginManifestSchema, type SitePluginManifest } from '@allternit/computer-use-protocol';

/**
 * Resolve the directory for a computer-use plugin, crossing from this package
 * into domains/computer-use/core/plugins. Follows the same pattern as
 * cmd/gizzi-code/src/runtime/tools/builtins/browser.ts: an env override first,
 * then walk up from this file looking for the monorepo layout.
 */
export function resolvePluginDir(pluginId: string): string {
  if (process.env.ALLTERNIT_PLUGINS_DIR) {
    return join(process.env.ALLTERNIT_PLUGINS_DIR, pluginId);
  }
  let cursor = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 12 && cursor !== dirname(cursor); depth += 1) {
    const candidate = join(cursor, 'domains', 'computer-use', 'core', 'plugins', pluginId);
    if (existsSync(join(candidate, 'plugin.json'))) return candidate;
    cursor = dirname(cursor);
  }
  throw new Error(
    `Cannot locate plugin '${pluginId}' under domains/computer-use/core/plugins; ` +
    'set ALLTERNIT_PLUGINS_DIR to override',
  );
}

export function loadPluginManifest(pluginId: string): SitePluginManifest {
  const raw = JSON.parse(readFileSync(join(resolvePluginDir(pluginId), 'plugin.json'), 'utf8'));
  return SitePluginManifestSchema.parse(raw);
}

export function readCookbookSection(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^## ${escaped}[ \t]*\r?\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  return match ? match[1].trim() : '';
}
