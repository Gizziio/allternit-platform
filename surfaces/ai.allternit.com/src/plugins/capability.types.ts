/**
 * Capability Types
 * Shared types for capabilities across the system
 */

// ============================================================================
// File Tree Types
// ============================================================================

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  content?: string;
  language?: string;
  children?: FileNode[];
  expanded?: boolean;
}

// ============================================================================
// Capability Type Discriminator
// ============================================================================

export type CapabilityType = 'skill' | 'command' | 'connector' | 'mcp' | 'plugin' | 'cli-tool' | 'webhook';

// ============================================================================
// Base Capability
// ============================================================================

export interface BaseCapability {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  tags: string[];
  enabledByDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: string;
  author?: string;
}

// ============================================================================
// Skill Types
// ============================================================================

export interface SkillVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  type?: string;
}

export interface SkillExample {
  title: string;
  description: string;
  input: Record<string, unknown>;
}

export interface Skill extends BaseCapability {
  type: 'skill';
  content: string;
  filePath?: string;
  variables: SkillVariable[];
  examples: SkillExample[];
}

// ============================================================================
// Command Types
// ============================================================================

export interface CommandArgument {
  name: string;
  description: string;
  required: boolean;
  type?: string;
}

export interface Command extends BaseCapability {
  type: 'command';
  trigger: string;
  triggerType: 'slash' | 'mention';
  commandType?: 'slash' | 'mention';
  handler?: string;
  arguments?: CommandArgument[];
  shortcuts?: string[];
}

// ============================================================================
// Connector Types
// ============================================================================

export interface ConnectorAction {
  id: string;
  name: string;
  description: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}

export interface ConnectorWebhook {
  event: string;
  path: string;
  description: string;
}

export interface Connector extends BaseCapability {
  type: 'connector';
  appName: string;
  appUrl: string;
  authType: string;
  actions?: ConnectorAction[];
  webhooks?: ConnectorWebhook[];
}

// ============================================================================
// MCP Types
// ============================================================================

export interface McpServer extends BaseCapability {
  type: 'mcp';
  command: string;
  args: string[];
  tools?: unknown[];
  resources?: unknown[];
}

// ============================================================================
// Plugin Types
// ============================================================================

export interface PluginView {
  id: string;
  type: string;
  title: string;
  component: string;
}

export interface Plugin extends BaseCapability {
  type: 'plugin';
  views?: PluginView[];
  activationPoints?: string[];
}

// ============================================================================
// CLI Tool Types
// ============================================================================

export interface CliTool extends BaseCapability {
  type: 'cli-tool';
  command: string;
  installCommands: Record<string, string>;
  checkCommand: string;
  installed?: boolean;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface Webhook extends BaseCapability {
  type: 'webhook';
  path: string;
  eventType: string;
  method?: string;
  connectedSkill?: string;
  triggerCount?: number;
  lastTriggered?: string;
}

// ============================================================================
// Union Type for all capabilities
// ============================================================================

export type Capability =
  | Skill
  | Command
  | Connector
  | McpServer
  | Plugin
  | CliTool
  | Webhook;

// ============================================================================
// Simplified Capability (for PluginManager)
// ============================================================================

export interface SimpleCapability {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  files?: FileNode[];
  content?: string;
  language?: string;
  version?: string;
  author?: string;
  updatedAt?: string;
  trigger?: string;
  appName?: string;
  command?: string;
}

// ============================================================================
// Marketplace Plugin
// ============================================================================

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon: string;
  category: string;
  installCount: number;
  rating: number;
  installed: boolean;
  tags?: string[];
  sourceLabel?: string;
  sourceId?: string;
  sourceUrl?: string;
  sourceTrust?: 'official' | 'verified' | 'community' | 'unknown';
  sourceKind?: 'curated' | 'api' | 'github' | 'personal';
  sourceDescriptor?:
    | string
    | {
        source: 'github' | 'url' | 'local';
        repo?: string;
        ref?: string;
        url?: string;
        path?: string;
        isDevMode?: boolean;
      };
  sourceRepo?: string;
  sourceRef?: string;
  sourcePath?: string;
  dependencies?: Record<string, string>;
}
