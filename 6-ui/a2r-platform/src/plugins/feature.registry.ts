/**
 * Feature Plugin Registry
 *
 * Static list of all available feature plugins.
 * Add new plugins here to make them available in the Plugin Manager.
 */

import type { FeaturePlugin } from './feature.types';

export const FEATURE_PLUGIN_REGISTRY: FeaturePlugin[] = [
  // ─── Playground ──────────────────────────────────────────────────────────
  {
    id: 'playground',
    name: 'Playground',
    version: '1.0.0',
    description:
      'Live-rendering AI artifact workbench. Write prompts, stream responses, and see generated HTML, React, SVG, and Mermaid artifacts rendered instantly in a split-pane preview.',
    icon: 'Flask',
    category: 'dev-tools',
    accentColor: '#d4b08c',
    author: 'A2R',
    builtin: true,
    tags: ['html', 'artifacts', 'preview', 'prompt-testing', 'live'],
    views: [
      {
        viewType: 'playground',
        label: 'Playground',
        railSection: 'core',
        railIconName: 'Flask',
      },
    ],
    enabledByDefault: false,
  },

  // ─── DAG Visualizer ──────────────────────────────────────────────────────
  {
    id: 'dag-visualizer',
    name: 'DAG Visualizer',
    version: '1.0.0',
    description:
      'Interactive directed-acyclic-graph inspector for agent task chains. Visualize, debug, and replay DAG execution graphs.',
    icon: 'TreeStructure',
    category: 'dev-tools',
    accentColor: '#818cf8',
    author: 'A2R',
    builtin: true,
    tags: ['dag', 'agents', 'graph', 'debug'],
    views: [
      {
        viewType: 'dag',
        label: 'DAG Inspector',
        railSection: 'infrastructure',
        railIconName: 'TreeStructure',
      },
    ],
    enabledByDefault: false,
  },

  // ─── Canvas Protocol ─────────────────────────────────────────────────────
  {
    id: 'canvas',
    name: 'Canvas',
    version: '1.0.0',
    description:
      'Infinite canvas for spatial AI collaboration. Arrange prompts, artifacts, and agent outputs as nodes on a shared canvas.',
    icon: 'SquaresFour',
    category: 'ai',
    accentColor: '#34d399',
    author: 'A2R',
    builtin: true,
    tags: ['canvas', 'spatial', 'collaboration', 'visual'],
    views: [
      {
        viewType: 'canvas',
        label: 'Canvas',
        railSection: 'workspace',
        railIconName: 'SquaresFour',
      },
    ],
    enabledByDefault: false,
  },

  // ─── Evaluation Suite ─────────────────────────────────────────────────────
  {
    id: 'evaluation',
    name: 'Eval Suite',
    version: '1.0.0',
    description:
      'Run structured evaluations against prompts and models. Compare outputs, score quality, and track regression across versions.',
    icon: 'ChartBar',
    category: 'dev-tools',
    accentColor: '#f59e0b',
    author: 'A2R',
    builtin: true,
    tags: ['eval', 'testing', 'quality', 'benchmarks'],
    views: [
      {
        viewType: 'evaluation',
        label: 'Eval Suite',
        railSection: 'infrastructure',
        railIconName: 'ChartBar',
      },
    ],
    enabledByDefault: false,
  },

  // ─── Rive Playground ──────────────────────────────────────────────────────
  {
    id: 'rive-playground',
    name: 'Rive Playground',
    version: '0.9.0',
    description:
      'Experimental: Generate and preview Rive interactive animations from natural language prompts. Create animated UI components in seconds.',
    icon: 'Sparkle',
    category: 'experimental',
    accentColor: '#a855f7',
    author: 'A2R',
    builtin: true,
    tags: ['rive', 'animation', 'generative', 'ui'],
    views: [],
    enabledByDefault: false,
  },
];

/** Look up a plugin by its id */
export function getFeaturePlugin(id: string): FeaturePlugin | undefined {
  return FEATURE_PLUGIN_REGISTRY.find((p) => p.id === id);
}
