/**
 * Unified mention targets for the chat composer's "@" picker.
 *
 * Merges plugins (unified registry: Allternit built-ins + Claude-native + Codex
 * workflow plugins) and connectors (owned catalog) into a single,
 * undifferentiated list — like Codex's platform, where plugins and connectors
 * are the same kind of thing.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Code,
  Database,
  FlowArrow,
  Globe,
  Hammer,
  Image,
  Lightning,
  MagnifyingGlass,
  MicrosoftWordLogo,
  PaintBrush,
  Presentation,
  PuzzlePiece,
  Sparkle,
  UsersThree,
  Video,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useUnifiedPlugins } from '@/lib/plugins/unified-registry';
import type { UnifiedPlugin } from '@/lib/plugins/unified-registry';
import type { PluginCategory } from '@/lib/plugins/marketplace';
import { listOwnedConnectors } from '@/lib/design/owned-connector';
import { getConnectorLogoUrl } from '@/lib/design/connector-logo';

export interface PluginMentionTarget {
  kind: 'plugin' | 'connector';
  id: string;
  name: string;
  description?: string;
  iconUrl?: string | null;    // connector favicon
  accentColor?: string;       // plugin category color
  category?: string;
  tags?: string[];
  connected?: boolean;        // connector auth state
}

/** Map a plugin to a Phosphor icon for the picker/chip (plugins have no image icons). */
export function pluginCategoryIcon(plugin: { category?: string; tags?: string[] }): PhosphorIcon {
  if (plugin.tags?.includes('claude-native')) return Sparkle;
  switch (plugin.category as PluginCategory | 'claude') {
    case 'create': return PaintBrush;
    case 'analyze': return MagnifyingGlass;
    case 'build': return Hammer;
    case 'automate': return Lightning;
    case 'cowork': return UsersThree;
    case 'productivity': return MicrosoftWordLogo;
    default: return PuzzlePiece;
  }
}

// Kept for richer per-id overrides (built-in agent-mode plugins).
const PLUGIN_ID_ICONS: Record<string, PhosphorIcon> = {
  image: Image,
  video: Video,
  slides: Presentation,
  website: Globe,
  research: MagnifyingGlass,
  data: Database,
  code: Code,
  swarms: UsersThree,
  flow: FlowArrow,
};

export function iconForPlugin(plugin: UnifiedPlugin): PhosphorIcon {
  return PLUGIN_ID_ICONS[plugin.id] ?? pluginCategoryIcon(plugin);
}

// ── Connectors: module-level cached fetch (the catalog is ~181 entries and
// rarely changes during a session) ────────────────────────────────────────────

let connectorCache: Promise<PluginMentionTarget[]> | null = null;

function fetchConnectorTargets(): Promise<PluginMentionTarget[]> {
  if (!connectorCache) {
    connectorCache = listOwnedConnectors()
      .then((connectors) =>
        connectors.map((c) => ({
          kind: 'connector' as const,
          id: c.id,
          name: c.name,
          description: c.description,
          iconUrl: getConnectorLogoUrl(c.base_url),
          category: c.category,
          connected: c.connection?.status === 'connected',
        })),
      )
      .catch(() => {
        connectorCache = null; // allow retry on next mount
        return [] as PluginMentionTarget[];
      });
  }
  return connectorCache;
}

export function usePluginMentionTargets(): PluginMentionTarget[] {
  const { plugins } = useUnifiedPlugins();
  const [connectors, setConnectors] = useState<PluginMentionTarget[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchConnectorTargets().then((targets) => {
      if (!cancelled) setConnectors(targets);
    });
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    const pluginTargets: PluginMentionTarget[] = plugins
      .filter((p) => p.status === 'enabled' || p.status === 'installed')
      .map((p) => ({
        kind: 'plugin' as const,
        id: p.id,
        name: p.name,
        description: p.description,
        accentColor: p.accentColor,
        category: p.category,
        tags: p.tags,
        connected: true,
      }));

    const sortedConnectors = [...connectors].sort((a, b) => {
      if (!!a.connected !== !!b.connected) return a.connected ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return [...pluginTargets, ...sortedConnectors];
  }, [plugins, connectors]);
}
