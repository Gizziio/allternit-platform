export { CURATED_MARKETPLACE_SOURCES } from '../../../plugins/marketplaceApi';

export const THEME = {
  bg: '#0c0a09',
  bgDeep: '#080706',
  bgElevated: '#1c1917',
  bgGlass: 'rgba(28, 25, 23, 0.85)',
  paneSurface: 'rgba(21, 18, 16, 0.82)',
  paneSurfaceStrong: 'rgba(16, 14, 12, 0.84)',
  accent: '#d4b08c',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
  accentGlow: 'rgba(212, 176, 140, 0.3)',
  textPrimary: '#e7e5e4',
  textSecondary: '#a8a29e',
  textTertiary: '#78716c',
  border: 'rgba(212, 176, 140, 0.1)',
  borderStrong: 'rgba(212, 176, 140, 0.2)',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
};

export const ENABLED_OVERRIDES_STORAGE_KEY = 'a2r:plugin-manager:enabled-overrides:v1';
export const CUSTOM_CAPABILITIES_STORAGE_KEY = 'a2r:plugin-manager:custom-capabilities:v1';
export const MARKETPLACE_INSTALLS_STORAGE_KEY = 'a2r:plugin-manager:marketplace-installs:v1';
export const PERSONAL_MARKETPLACE_STORAGE_KEY = 'a2r:plugin-manager:personal-marketplaces:v1';
export const CONNECTOR_CONNECTIONS_STORAGE_KEY = 'a2r:plugin-manager:connector-connections:v1';
export const CURATED_SOURCE_SETTINGS_STORAGE_KEY = 'a2r:plugin-manager:curated-source-settings:v1';
export const ALLOW_UNTRUSTED_MARKETPLACE_STORAGE_KEY = 'a2r:plugin-manager:allow-untrusted-marketplace:v1';

export const PLUGIN_MANAGER_STATE_DIR = '.a2r/plugin-manager';
export const PLUGIN_MANAGER_STATE_FILE = 'ui-state.json';
export const PLUGIN_MANAGER_STATE_VERSION = 1;

export const SKILL_IMPORT_DIR = '.a2r/skills';
export const LEFT_PANE_TOP_OFFSET = 98;

export const CONNECTOR_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Type' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'development', label: 'Development' },
  { value: 'data', label: 'Data' },
  { value: 'business', label: 'Business' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
];

export const PLUGIN_CATEGORIES_PUBLISH = [
  'Development',
  'Productivity',
  'Data',
  'Design',
  'Communication',
  'Search',
  'Cloud',
  'AI',
];

export const PLUGIN_TYPE_OPTIONS = [
  {
    value: 'command',
    label: 'Command',
    description: 'Slash command with a TypeScript entrypoint.',
  },
  {
    value: 'skill',
    label: 'Skill',
    description: 'Markdown-driven reusable skill instructions.',
  },
  {
    value: 'mcp',
    label: 'MCP Server',
    description: 'Model Context Protocol server scaffold.',
  },
  {
    value: 'webhook',
    label: 'Webhook',
    description: 'Inbound HTTP handler for external triggers.',
  },
  {
    value: 'full',
    label: 'Full Plugin',
    description: 'Multi-surface plugin with commands and skills.',
  },
] as const;
