/**
 * Feature Plugin System
 *
 * Shell-level feature plugins that can be toggled on/off.
 * These are UI/capability plugins, distinct from the telemetry provider plugins.
 */

/**
 * FeatureDefinition - Normalized plugin definition used by the feature registry.
 * Similar to FeaturePlugin but with a standardized shape for registry storage.
 */
export interface FeatureDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  category: PluginCategory;
  author?: string;
  accentColor?: string;
  views: PluginViewEntry[];
  enabledByDefault?: boolean;
  tags?: string[];
  builtin?: boolean;
}

export type PluginCategory =
  // Core Development
  | 'dev-tools'
  | 'code-quality'
  | 'debugging'
  | 'testing'
  | 'build-tools'
  | 'version-control'
  // AI & ML
  | 'ai'
  | 'ai-agents'
  | 'ai-code-assistant'
  // Data
  | 'database'
  | 'data-visualization'
  // Infrastructure
  | 'infrastructure'
  | 'containers'
  | 'cloud'
  // Security & Observability
  | 'security'
  | 'observability'
  // Productivity
  | 'productivity'
  | 'collaboration'
  | 'documentation'
  // Experimental
  | 'experimental';

export type RailSection =
  | 'core'
  | 'agents'
  | 'workspace'
  | 'ai_vision'
  | 'infrastructure'
  | 'security'
  | 'execution'
  | 'observability';

export interface PluginViewEntry {
  /** ViewType string to register */
  viewType: string;
  /** Label shown in sidebar rail */
  label: string;
  /** Which rail section to inject into */
  railSection: RailSection;
  /** Phosphor icon name (e.g. "Flask", "Code", "TreeStructure") */
  railIconName: string;
}

export interface FeaturePlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  /** Phosphor icon name for the plugin card */
  icon: string;
  category: PluginCategory;
  author?: string;
  /** Accent/brand color for the plugin card */
  accentColor?: string;
  /** Views this plugin contributes to the shell */
  views: PluginViewEntry[];
  /** Whether enabled by default on first install */
  enabledByDefault?: boolean;
  /** Tags for search/filter */
  tags?: string[];
  /** Whether this plugin is built-in vs installable */
  builtin?: boolean;
}
