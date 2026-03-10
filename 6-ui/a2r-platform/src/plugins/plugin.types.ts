/**
 * Plugin System Types
 * 
 * A Plugin is a PACKAGE containing:
 * - Commands (slash commands like /brief)
 * - Skills (agent capabilities)
 * - Connectors (external integrations)
 * - MCP servers
 * - Webhooks
 * 
 * This is the correct Claude Code-style plugin architecture.
 */

// ============================================================================
// Plugin Metadata
// ============================================================================

export interface PluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface PluginSource {
  type: 'marketplace' | 'github' | 'gitlab' | 'local' | 'builtin';
  url?: string;
  marketplace?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: PluginAuthor;
  source: PluginSource;
  icon?: string;
  tags: string[];
  category: PluginCategory;
  
  // Stats
  installCount?: number;
  rating?: number;
  
  // Flags
  enabled: boolean;
  builtin?: boolean;
  
  // Timestamps
  installedAt?: string;
  updatedAt?: string;
}

export type PluginCategory =
  | 'legal'
  | 'productivity'
  | 'enterprise-search'
  | 'sales'
  | 'finance'
  | 'data'
  | 'marketing'
  | 'customer-support'
  | 'product-management'
  | 'engineering'
  | 'security'
  | 'dev-tools'
  | 'ai'
  | 'internal';

// ============================================================================
// Plugin Components (what a plugin contains)
// ============================================================================

export interface PluginCommand {
  id: string;
  name: string;
  description: string;
  trigger: string; // e.g., "/brief"
  icon?: string;
  pluginId: string;
}

export interface PluginSkill {
  id: string;
  name: string;
  description: string;
  content: string; // Markdown content
  icon?: string;
  pluginId: string;
  filePath?: string;
}

export interface PluginConnector {
  id: string;
  name: string;
  description: string;
  appName: string;
  appUrl?: string;
  authType: 'oauth' | 'apikey' | 'token' | 'none';
  icon?: string;
  installed: boolean;
  pluginId: string;
}

export interface PluginMcp {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  pluginId: string;
}

export interface PluginWebhook {
  id: string;
  name: string;
  description: string;
  path: string;
  eventType: string;
  pluginId: string;
}

// ============================================================================
// Complete Plugin (package with all its contents)
// ============================================================================

export interface Plugin extends PluginManifest {
  commands: PluginCommand[];
  skills: PluginSkill[];
  connectors: PluginConnector[];
  mcps: PluginMcp[];
  webhooks: PluginWebhook[];
}

// ============================================================================
// Tab Types for Plugin Detail View
// ============================================================================

export type PluginTab = 'commands' | 'skills' | 'connectors' | 'mcps' | 'webhooks';

export const PLUGIN_TAB_LABELS: Record<PluginTab, string> = {
  commands: 'Commands',
  skills: 'Skills',
  connectors: 'Connectors',
  mcps: 'MCPs',
  webhooks: 'Webhooks',
};

// ============================================================================
// Marketplace Plugin (for browse overlay)
// ============================================================================

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: PluginAuthor;
  icon?: string;
  category: PluginCategory;
  tags: string[];
  rating?: number;
  installCount?: number;
  source: PluginSource;
  installed?: boolean;
  dependencies?: Record<string, string>;
}

// ============================================================================
// File Node for nested file browser
// ============================================================================

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  content?: string; // For files
  language?: string; // For syntax highlighting
  children?: FileNode[]; // For directories
  expanded?: boolean;
}
