/**
 * Chrome Extension Feature Plugin
 *
 * Registers the Allternit Chrome extension plugin into the platform
 * feature registry. Surfaces in the shell marketplace and rail.
 *
 * Plugin content (commands, skills, .mcp.json, CONNECTORS.md) lives
 * co-located with the extension at:
 *   surfaces/extensions/allternit-extension/plugins/chrome/
 *
 * This file holds only the platform-side metadata needed for the
 * shell UI — it does NOT duplicate or import the extension content.
 */

import type { FeaturePlugin } from './feature.types';

export const CHROME_PLUGIN: FeaturePlugin = {
  id: 'allternit-chrome',
  name: 'Allternit for Chrome',
  version: '1.0.0',
  description:
    'AI-powered browser companion — summarize pages, extract structured data, research across tabs, automate repetitive tasks, and save content to your connected tools.',
  icon: 'Globe',
  category: 'productivity',
  author: 'Allternit',
  accentColor: '#B08D6E',
  views: [],
  enabledByDefault: false,
  builtin: false,
  tags: ['chrome', 'browser', 'web', 'summarize', 'extract', 'research', 'automation'],
};
