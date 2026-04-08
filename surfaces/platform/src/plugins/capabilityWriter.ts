/**
 * Capability Writer
 * 
 * Writes capabilities to disk in the appropriate format.
 * This is the bridge between the UI forms and the file system.
 */

import type { FileSystemAPI } from './fileSystem.types';
import type { SimpleCapability, MarketplacePlugin } from './capability.types';
import {
  buildPluginManifestFromWizard,
  buildMarketplaceManifestForPlugin,
  sanitizeRelativePath,
  validateMarketplaceManifestV1,
  validatePluginManifestV1,
  type PluginManifestV1,
  type PluginMarketplaceManifestV1,
} from './pluginStandards';

// Base directories
const ALLTERNIT_DIR = '.allternit';
const SKILLS_DIR = `${ALLTERNIT_DIR}/skills`;
const COMMANDS_DIR = `${ALLTERNIT_DIR}/commands`;
const PLUGINS_DIR = `${ALLTERNIT_DIR}/plugins`;
const MCPS_DIR = `${ALLTERNIT_DIR}/mcps`;
const WEBHOOKS_DIR = `${ALLTERNIT_DIR}/webhooks`;
const CONNECTORS_DIR = `${ALLTERNIT_DIR}/connectors`;
const CLI_TOOLS_DIR = `${ALLTERNIT_DIR}/cli-tools`;

const SKILL_DIR_CANDIDATES = [SKILLS_DIR, '.agents/skills', '.codex/skills'];
const COMMAND_DIR_CANDIDATES = [COMMANDS_DIR, '.agents/commands', '.codex/commands'];
const PLUGIN_DIR_CANDIDATES = [PLUGINS_DIR, '.agents/plugins', '.codex/plugins'];
const MCP_DIR_CANDIDATES = [MCPS_DIR, '.agents/mcps', '.codex/mcps'];
const WEBHOOK_DIR_CANDIDATES = [WEBHOOKS_DIR, '.agents/webhooks', '.codex/webhooks'];
const CONNECTOR_DIR_CANDIDATES = [CONNECTORS_DIR, '.agents/connectors', '.codex/connectors'];
const CLI_TOOL_DIR_CANDIDATES = [CLI_TOOLS_DIR, '.agents/cli-tools', '.codex/cli-tools'];

// ============================================================================
// Create Capabilities
// ============================================================================

export interface CreateSkillInput {
  name: string;
  description: string;
  content: string;
  tags?: string[];
  category?: string;
}

export interface CreateCommandInput {
  name: string;
  description: string;
  trigger: string;
  triggerType?: 'slash' | 'mention';
  tags?: string[];
}

export interface CreateConnectorInput {
  name: string;
  appName: string;
  description: string;
  authType?: 'oauth' | 'apikey' | 'token' | 'none';
  appUrl?: string;
  tags?: string[];
}

export interface CreateMcpInput {
  name: string;
  description: string;
  command: string;
  args?: string[];
  tags?: string[];
}

export interface CreateCliToolInput {
  name: string;
  description: string;
  command: string;
  category?: string;
  tags?: string[];
}

export interface CreateWebhookInput {
  name: string;
  description: string;
  path: string;
  eventType?: string;
  connectedSkill?: string;
  tags?: string[];
}

export interface CreatePluginInput {
  name: string;
  description: string;
  content?: string;
  category?: string;
  tags?: string[];
  manifest?: PluginManifestV1;
  marketplaceManifest?: PluginMarketplaceManifestV1;
  files?: Array<{ relativePath: string; content: string }>;
}

// ============================================================================
// Writer Functions
// ============================================================================

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item';
}

function toSafeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';
}

function scoreCandidatePath(path: string, idHint: string): number {
  const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
  const normalizedId = idHint.toLowerCase();
  let score = 0;

  if (normalizedId.includes('-agents-')) {
    if (normalizedPath.includes('/.agents/')) score += 100;
    if (normalizedPath.includes('/.allternit/')) score -= 10;
  }

  if (normalizedId.includes('-codex-')) {
    if (normalizedPath.includes('/.codex/')) score += 100;
    if (normalizedPath.includes('/.allternit/')) score -= 10;
  }

  if (normalizedId.includes('-allternit-')) {
    if (normalizedPath.includes('/.allternit/')) score += 100;
  }

  return score;
}

function buildBasePathCandidates(
  fs: FileSystemAPI,
  homeDir: string,
  candidates: string[],
  idHint?: string
): string[] {
  const paths = new Set<string>();
  for (const relativeDir of candidates) {
    paths.add(fs.join(homeDir, relativeDir));
    paths.add(relativeDir);
    paths.add(fs.join('.', relativeDir));
  }
  const result = Array.from(paths);
  if (!idHint) return result;
  return result.sort((a, b) => scoreCandidatePath(b, idHint) - scoreCandidatePath(a, idHint));
}

async function resolveEntryPathBySafeId(
  fs: FileSystemAPI,
  basePaths: string[],
  safeId: string,
  expectedType: 'file' | 'directory'
): Promise<string | null> {
  for (const basePath of basePaths) {
    try {
      const entries = await fs.readDir(basePath);
      for (const entry of entries) {
        if (entry.type !== expectedType) continue;
        const normalizedName = entry.name.replace(/\.json$/i, '');
        const entryIds = new Set([
          toSafeId(entry.path),
          toSafeId(entry.name),
          toSafeId(normalizedName),
        ]);
        if (entryIds.has(safeId)) {
          return entry.path;
        }
      }
    } catch {
      // Ignore missing or unreadable candidate directories.
    }
  }
  return null;
}

async function resolveToggleConfigPath(
  fs: FileSystemAPI,
  type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin',
  homeDir: string,
  cleanId: string,
  defaultPath: string
): Promise<string> {
  if (type === 'skill') {
    const skillDir = await resolveEntryPathBySafeId(
      fs,
      buildBasePathCandidates(fs, homeDir, SKILL_DIR_CANDIDATES, cleanId),
      cleanId,
      'directory'
    );
    return skillDir ? fs.join(skillDir, 'config.json') : defaultPath;
  }

  if (type === 'plugin') {
    const pluginDir = await resolveEntryPathBySafeId(
      fs,
      buildBasePathCandidates(fs, homeDir, PLUGIN_DIR_CANDIDATES, cleanId),
      cleanId,
      'directory'
    );
    if (!pluginDir) return defaultPath;

    const claudePluginJsonPath = fs.join(pluginDir, '.claude-plugin', 'plugin.json');
    if (await fs.exists(claudePluginJsonPath)) return claudePluginJsonPath;

    const pluginJsonPath = fs.join(pluginDir, 'plugin.json');
    if (await fs.exists(pluginJsonPath)) return pluginJsonPath;

    const configJsonPath = fs.join(pluginDir, 'config.json');
    if (await fs.exists(configJsonPath)) return configJsonPath;

    return pluginJsonPath;
  }

  if (type === 'command') {
    const commandPath = await resolveEntryPathBySafeId(
      fs,
      buildBasePathCandidates(fs, homeDir, COMMAND_DIR_CANDIDATES, cleanId),
      cleanId,
      'file'
    );
    return commandPath || defaultPath;
  }

  if (type === 'connector') {
    const connectorPath = await resolveEntryPathBySafeId(
      fs,
      buildBasePathCandidates(fs, homeDir, CONNECTOR_DIR_CANDIDATES, cleanId),
      cleanId,
      'file'
    );
    return connectorPath || defaultPath;
  }

  if (type === 'mcp') {
    const mcpPath = await resolveEntryPathBySafeId(
      fs,
      buildBasePathCandidates(fs, homeDir, MCP_DIR_CANDIDATES, cleanId),
      cleanId,
      'file'
    );
    return mcpPath || defaultPath;
  }

  if (type === 'cli-tool') {
    const cliPath = await resolveEntryPathBySafeId(
      fs,
      buildBasePathCandidates(fs, homeDir, CLI_TOOL_DIR_CANDIDATES, cleanId),
      cleanId,
      'file'
    );
    return cliPath || defaultPath;
  }

  if (type === 'webhook') {
    const webhookPath = await resolveEntryPathBySafeId(
      fs,
      buildBasePathCandidates(fs, homeDir, WEBHOOK_DIR_CANDIDATES, cleanId),
      cleanId,
      'file'
    );
    return webhookPath || defaultPath;
  }

  return defaultPath;
}

export async function createSkill(
  fs: FileSystemAPI,
  input: CreateSkillInput
): Promise<{ success: boolean; capability?: SimpleCapability; error?: string }> {
  try {
    const id = slugify(input.name);
    const homeDir = fs.getHomeDir();
    const skillDir = fs.join(homeDir, SKILLS_DIR, id);
    
    // Create directory
    await fs.mkdir(skillDir);
    
    const now = new Date().toISOString();
    
    // Write SKILL.md
    const skillContent = input.content || `# ${input.name}\n\n${input.description}`;
    await fs.writeFile(fs.join(skillDir, 'SKILL.md'), skillContent);
    
    // Write config.json
    const config = {
      name: input.name,
      description: input.description,
      tags: input.tags || [],
      category: input.category || 'general',
      enabled: true,
      version: '1.0.0',
      author: 'User',
      createdAt: now,
      updatedAt: now,
    };
    await fs.writeFile(fs.join(skillDir, 'config.json'), JSON.stringify(config, null, 2));
    
    const capability: SimpleCapability = {
      id: `skill-${id}`,
      name: input.name,
      description: input.description,
      icon: 'book-open',
      enabled: true,
      version: '1.0.0',
      author: 'User',
      updatedAt: now,
      content: skillContent,
    };
    
    return { success: true, capability };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create skill' };
  }
}

export async function createCommand(
  fs: FileSystemAPI,
  input: CreateCommandInput
): Promise<{ success: boolean; capability?: SimpleCapability; error?: string }> {
  try {
    const id = slugify(input.name);
    const homeDir = fs.getHomeDir();
    const commandPath = fs.join(homeDir, COMMANDS_DIR, `${id}.json`);
    
    // Ensure directory exists
    await fs.mkdir(fs.join(homeDir, COMMANDS_DIR));
    
    const now = new Date().toISOString();
    
    const commandData = {
      name: input.name,
      description: input.description,
      trigger: input.trigger || `/${id}`,
      triggerType: input.triggerType || 'slash',
      tags: input.tags || [],
      enabled: true,
      version: '1.0.0',
      author: 'User',
      createdAt: now,
      updatedAt: now,
    };
    
    await fs.writeFile(commandPath, JSON.stringify(commandData, null, 2));
    
    const capability: SimpleCapability = {
      id: `cmd-${id}`,
      name: input.name,
      description: input.description,
      icon: 'command',
      enabled: true,
      trigger: commandData.trigger,
      version: '1.0.0',
      author: 'User',
      updatedAt: now,
      content: JSON.stringify(commandData, null, 2),
      language: 'json',
    };
    
    return { success: true, capability };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create command' };
  }
}

export async function createConnector(
  fs: FileSystemAPI,
  input: CreateConnectorInput
): Promise<{ success: boolean; capability?: SimpleCapability; error?: string }> {
  try {
    const id = slugify(input.name);
    const homeDir = fs.getHomeDir();
    const connectorPath = fs.join(homeDir, CONNECTORS_DIR, `${id}.json`);
    
    await fs.mkdir(fs.join(homeDir, CONNECTORS_DIR));
    
    const now = new Date().toISOString();
    
    const connectorData = {
      name: input.name,
      appName: input.appName,
      description: input.description,
      authType: input.authType || 'apikey',
      appUrl: input.appUrl || '',
      tags: input.tags || [],
      enabled: false, // Connectors start disabled until authenticated
      version: '1.0.0',
      author: 'User',
      createdAt: now,
      updatedAt: now,
    };
    
    await fs.writeFile(connectorPath, JSON.stringify(connectorData, null, 2));
    
    const capability: SimpleCapability = {
      id: `connector-${id}`,
      name: input.name,
      description: input.description,
      icon: 'plug',
      enabled: false,
      appName: input.appName,
      version: '1.0.0',
      author: 'User',
      updatedAt: now,
      content: JSON.stringify(connectorData, null, 2),
      language: 'json',
    };
    
    return { success: true, capability };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create connector' };
  }
}

export async function createMcp(
  fs: FileSystemAPI,
  input: CreateMcpInput
): Promise<{ success: boolean; capability?: SimpleCapability; error?: string }> {
  try {
    const id = slugify(input.name);
    const homeDir = fs.getHomeDir();
    const mcpPath = fs.join(homeDir, MCPS_DIR, `${id}.json`);
    
    await fs.mkdir(fs.join(homeDir, MCPS_DIR));
    
    const now = new Date().toISOString();
    
    const mcpData = {
      name: input.name,
      description: input.description,
      command: input.command,
      args: input.args || [],
      tags: input.tags || [],
      enabled: true,
      version: '1.0.0',
      author: 'User',
      createdAt: now,
      updatedAt: now,
    };
    
    await fs.writeFile(mcpPath, JSON.stringify(mcpData, null, 2));
    
    const capability: SimpleCapability = {
      id: `mcp-${id}`,
      name: input.name,
      description: input.description,
      icon: 'cpu',
      enabled: true,
      version: '1.0.0',
      author: 'User',
      updatedAt: now,
      content: JSON.stringify(mcpData, null, 2),
      language: 'json',
    };
    
    return { success: true, capability };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create MCP' };
  }
}

export async function createCliTool(
  fs: FileSystemAPI,
  input: CreateCliToolInput
): Promise<{ success: boolean; capability?: SimpleCapability; error?: string }> {
  try {
    const id = slugify(input.name);
    const homeDir = fs.getHomeDir();
    const cliToolPath = fs.join(homeDir, CLI_TOOLS_DIR, `${id}.json`);
    
    await fs.mkdir(fs.join(homeDir, CLI_TOOLS_DIR));
    
    const now = new Date().toISOString();
    
    const cliToolData = {
      name: input.name,
      description: input.description,
      command: input.command,
      category: input.category || 'dev',
      tags: input.tags || [],
      enabled: true,
      version: '1.0.0',
      author: 'User',
      createdAt: now,
      updatedAt: now,
    };
    
    await fs.writeFile(cliToolPath, JSON.stringify(cliToolData, null, 2));
    
    const capability: SimpleCapability = {
      id: `cli-${id}`,
      name: input.name,
      description: input.description,
      icon: 'terminal',
      enabled: true,
      command: input.command,
      version: '1.0.0',
      author: 'User',
      updatedAt: now,
      content: JSON.stringify(cliToolData, null, 2),
      language: 'json',
    };
    
    return { success: true, capability };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create CLI tool' };
  }
}

export async function createWebhook(
  fs: FileSystemAPI,
  input: CreateWebhookInput
): Promise<{ success: boolean; capability?: SimpleCapability; error?: string }> {
  try {
    const id = slugify(input.name);
    const homeDir = fs.getHomeDir();
    const webhookPath = fs.join(homeDir, WEBHOOKS_DIR, `${id}.json`);
    
    await fs.mkdir(fs.join(homeDir, WEBHOOKS_DIR));
    
    const now = new Date().toISOString();
    
    const webhookData = {
      name: input.name,
      description: input.description,
      path: input.path,
      eventType: input.eventType || '',
      connectedSkill: input.connectedSkill || '',
      tags: input.tags || [],
      enabled: true,
      version: '1.0.0',
      author: 'User',
      createdAt: now,
      updatedAt: now,
      triggerCount: 0,
    };
    
    await fs.writeFile(webhookPath, JSON.stringify(webhookData, null, 2));
    
    const capability: SimpleCapability = {
      id: `webhook-${id}`,
      name: input.name,
      description: input.description,
      icon: 'webhook',
      enabled: true,
      version: '1.0.0',
      author: 'User',
      updatedAt: now,
      content: JSON.stringify(webhookData, null, 2),
      language: 'json',
    };
    
    return { success: true, capability };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create webhook' };
  }
}

export async function createPlugin(
  fs: FileSystemAPI,
  input: CreatePluginInput
): Promise<{ success: boolean; capability?: SimpleCapability; error?: string }> {
  try {
    const id = slugify(input.name);
    const homeDir = fs.getHomeDir();
    const pluginDir = fs.join(homeDir, PLUGINS_DIR, id);
    const claudePluginDir = fs.join(pluginDir, '.claude-plugin');
    const now = new Date().toISOString();

    await fs.mkdir(pluginDir);
    await fs.mkdir(claudePluginDir);

    const fallbackManifest = buildPluginManifestFromWizard({
      name: input.name,
      description: input.description,
      version: '1.0.0',
      category: input.category,
      tags: input.tags,
      authorName: 'User',
    });
    const pluginManifest = input.manifest || fallbackManifest;
    const pluginManifestValidation = validatePluginManifestV1(pluginManifest);
    if (!pluginManifestValidation.valid) {
      return {
        success: false,
        error: `Invalid plugin manifest: ${pluginManifestValidation.errors.join(' ')}`,
      };
    }

    const pluginJson = {
      id,
      ...pluginManifest,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      source: 'custom',
    };

    // Persist both standard Claude path and legacy root path for compatibility.
    await fs.writeFile(fs.join(claudePluginDir, 'plugin.json'), JSON.stringify(pluginJson, null, 2));
    await fs.writeFile(fs.join(pluginDir, 'plugin.json'), JSON.stringify(pluginJson, null, 2));

    const readme = input.content?.trim()
      ? input.content
      : `# ${input.name}\n\n${input.description}`;
    await fs.writeFile(fs.join(pluginDir, 'README.md'), readme);

    const marketplaceManifest =
      input.marketplaceManifest ||
      buildMarketplaceManifestForPlugin(pluginManifest, {
        ownerName: 'User',
        source: './',
      });
    const marketplaceValidation = validateMarketplaceManifestV1(marketplaceManifest);
    if (marketplaceValidation.valid) {
      await fs.writeFile(
        fs.join(claudePluginDir, 'marketplace.template.json'),
        JSON.stringify(marketplaceManifest, null, 2)
      );
    }

    for (const file of input.files || []) {
      const safePath = sanitizeRelativePath(file.relativePath);
      if (!safePath) continue;
      const segments = safePath.split('/');
      let currentDir = pluginDir;
      for (let i = 0; i < segments.length - 1; i += 1) {
        currentDir = fs.join(currentDir, segments[i]);
        await fs.mkdir(currentDir);
      }
      await fs.writeFile(fs.join(pluginDir, safePath), file.content);
    }

    return {
      success: true,
      capability: {
        id: `plugin-${id}`,
        name: input.name,
        description: input.description,
        icon: 'puzzle',
        enabled: true,
        version: '1.0.0',
        author: 'User',
        updatedAt: now,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create plugin' };
  }
}

// ============================================================================
// Update Capabilities
// ============================================================================

export async function updateSkill(
  fs: FileSystemAPI,
  id: string,
  updates: Partial<CreateSkillInput>
): Promise<{ success: boolean; error?: string }> {
  try {
    const homeDir = fs.getHomeDir();
    const cleanId = id.replace('skill-', '');
    const resolvedSkillDir = await resolveEntryPathBySafeId(
      fs,
      buildBasePathCandidates(fs, homeDir, SKILL_DIR_CANDIDATES, cleanId),
      cleanId,
      'directory'
    );
    const skillDir = resolvedSkillDir || fs.join(homeDir, SKILLS_DIR, cleanId);
    
    // Update SKILL.md if content provided
    if (updates.content !== undefined) {
      await fs.writeFile(fs.join(skillDir, 'SKILL.md'), updates.content);
    }
    
    // Update config.json if other fields provided
    if (updates.name || updates.description || updates.tags || updates.category) {
      const configPath = fs.join(skillDir, 'config.json');
      let config: Record<string, unknown> = {};
      try {
        const existing = await fs.readFile(configPath);
        config = JSON.parse(existing);
      } catch {
        // No existing config
      }
      
      if (updates.name) config.name = updates.name;
      if (updates.description) config.description = updates.description;
      if (updates.tags) config.tags = updates.tags;
      if (updates.category) config.category = updates.category;
      config.updatedAt = new Date().toISOString();
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    }
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to update skill' };
  }
}

export async function updateFileContent(
  fs: FileSystemAPI,
  filePath: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await fs.writeFile(filePath, content);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to update file' };
  }
}

export async function updateCapabilityMetadata(
  fs: FileSystemAPI,
  type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin',
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    appName: string;
    trigger: string;
    command: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    if (type === 'skill') {
      return await updateSkill(fs, id, {
        name: updates.name,
        description: updates.description,
      });
    }

    const homeDir = fs.getHomeDir();
    const cleanId = id.replace(`${type}-`, '');

    let configPath: string;
    switch (type) {
      case 'command':
        configPath = fs.join(homeDir, COMMANDS_DIR, `${cleanId}.json`);
        break;
      case 'connector':
        configPath = fs.join(homeDir, CONNECTORS_DIR, `${cleanId}.json`);
        break;
      case 'mcp':
        configPath = fs.join(homeDir, MCPS_DIR, `${cleanId}.json`);
        break;
      case 'cli-tool':
        configPath = fs.join(homeDir, CLI_TOOLS_DIR, `${cleanId}.json`);
        break;
      case 'webhook':
        configPath = fs.join(homeDir, WEBHOOKS_DIR, `${cleanId}.json`);
        break;
      case 'plugin':
        configPath = fs.join(homeDir, PLUGINS_DIR, cleanId, '.claude-plugin', 'plugin.json');
        break;
      default:
        return { success: false, error: 'Unknown capability type' };
    }

    configPath = await resolveToggleConfigPath(fs, type, homeDir, cleanId, configPath);

    let config: Record<string, unknown> = {};
    try {
      const existing = await fs.readFile(configPath);
      config = JSON.parse(existing);
    } catch {
      // Start from empty config if file does not exist.
    }

    if (updates.name !== undefined) config.name = updates.name;
    if (updates.description !== undefined) config.description = updates.description;
    if (updates.appName !== undefined) config.appName = updates.appName;
    if (updates.trigger !== undefined) config.trigger = updates.trigger;
    if (updates.command !== undefined) config.command = updates.command;
    config.updatedAt = new Date().toISOString();

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to update capability metadata',
    };
  }
}

// ============================================================================
// Delete Capabilities
// ============================================================================

export async function deleteCapability(
  fs: FileSystemAPI,
  type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin',
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const homeDir = fs.getHomeDir();
    const cleanId = id.replace(`${type}-`, '');
    
    let targetPath: string;
    
    switch (type) {
      case 'skill': {
        const resolved = await resolveEntryPathBySafeId(
          fs,
          buildBasePathCandidates(fs, homeDir, SKILL_DIR_CANDIDATES, cleanId),
          cleanId,
          'directory'
        );
        targetPath = resolved || fs.join(homeDir, SKILLS_DIR, cleanId);
        break;
      }
      case 'command': {
        const resolved = await resolveEntryPathBySafeId(
          fs,
          buildBasePathCandidates(fs, homeDir, COMMAND_DIR_CANDIDATES, cleanId),
          cleanId,
          'file'
        );
        targetPath = resolved || fs.join(homeDir, COMMANDS_DIR, `${cleanId}.json`);
        break;
      }
      case 'connector': {
        const resolved = await resolveEntryPathBySafeId(
          fs,
          buildBasePathCandidates(fs, homeDir, CONNECTOR_DIR_CANDIDATES, cleanId),
          cleanId,
          'file'
        );
        targetPath = resolved || fs.join(homeDir, CONNECTORS_DIR, `${cleanId}.json`);
        break;
      }
      case 'mcp': {
        const resolved = await resolveEntryPathBySafeId(
          fs,
          buildBasePathCandidates(fs, homeDir, MCP_DIR_CANDIDATES, cleanId),
          cleanId,
          'file'
        );
        targetPath = resolved || fs.join(homeDir, MCPS_DIR, `${cleanId}.json`);
        break;
      }
      case 'cli-tool': {
        const resolved = await resolveEntryPathBySafeId(
          fs,
          buildBasePathCandidates(fs, homeDir, CLI_TOOL_DIR_CANDIDATES, cleanId),
          cleanId,
          'file'
        );
        targetPath = resolved || fs.join(homeDir, CLI_TOOLS_DIR, `${cleanId}.json`);
        break;
      }
      case 'webhook': {
        const resolved = await resolveEntryPathBySafeId(
          fs,
          buildBasePathCandidates(fs, homeDir, WEBHOOK_DIR_CANDIDATES, cleanId),
          cleanId,
          'file'
        );
        targetPath = resolved || fs.join(homeDir, WEBHOOKS_DIR, `${cleanId}.json`);
        break;
      }
      case 'plugin': {
        const resolved = await resolveEntryPathBySafeId(
          fs,
          buildBasePathCandidates(fs, homeDir, PLUGIN_DIR_CANDIDATES, cleanId),
          cleanId,
          'directory'
        );
        targetPath = resolved || fs.join(homeDir, PLUGINS_DIR, cleanId);
        break;
      }
      default:
        return { success: false, error: 'Unknown capability type' };
    }
    
    // Check if it's a directory (for skills and plugins)
    const isDirectory = type === 'skill' || type === 'plugin';
    
    if (isDirectory) {
      // Recursively delete directory
      await deleteDirectoryRecursive(fs, targetPath);
    } else {
      // Delete single file
      await fs.deleteFile(targetPath);
    }
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to delete capability' };
  }
}

async function deleteDirectoryRecursive(fs: FileSystemAPI, dirPath: string): Promise<void> {
  try {
    const entries = await fs.readDir(dirPath);
    for (const entry of entries) {
      if (entry.type === 'directory') {
        await deleteDirectoryRecursive(fs, entry.path);
      } else {
        try {
          await fs.deleteFile(entry.path);
        } catch {
          // Best-effort cleanup
        }
      }
    }
    // Try to delete the directory itself
    try {
      await fs.deleteFile(dirPath);
    } catch {
      // Some backends don't support directory deletion
    }
  } catch {
    // Directory may not exist
  }
}

// ============================================================================
// File Tree Operations
// ============================================================================

export async function createFileInTree(
  fs: FileSystemAPI,
  parentDir: string,
  fileName: string,
  content: string = ''
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const filePath = fs.join(parentDir, fileName);
    await fs.writeFile(filePath, content);
    return { success: true, path: filePath };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create file' };
  }
}

export async function createDirectoryInTree(
  fs: FileSystemAPI,
  parentDir: string,
  dirName: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const dirPath = fs.join(parentDir, dirName);
    await fs.mkdir(dirPath);
    return { success: true, path: dirPath };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create directory' };
  }
}

export async function renameFileInTree(
  fs: FileSystemAPI,
  oldPath: string,
  newName: string
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  try {
    const parentDir = fs.dirname(oldPath);
    const newPath = fs.join(parentDir, newName);
    
    // Read and write to new location, then delete old
    const content = await fs.readFile(oldPath);
    await fs.writeFile(newPath, content);
    await fs.deleteFile(oldPath);
    
    return { success: true, newPath };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to rename file' };
  }
}

export async function deleteFileInTree(
  fs: FileSystemAPI,
  filePath: string,
  isDirectory: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    if (isDirectory) {
      await deleteDirectoryRecursive(fs, filePath);
    } else {
      await fs.deleteFile(filePath);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to delete' };
  }
}

// ============================================================================
// Toggle Enabled State
// ============================================================================

export async function toggleCapabilityEnabled(
  fs: FileSystemAPI,
  type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook' | 'plugin',
  id: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const homeDir = fs.getHomeDir();
    const cleanId = id.replace(`${type}-`, '');
    
    let configPath: string;
    
    switch (type) {
      case 'skill':
        configPath = fs.join(homeDir, SKILLS_DIR, cleanId, 'config.json');
        break;
      case 'plugin':
        configPath = fs.join(homeDir, PLUGINS_DIR, cleanId, '.claude-plugin', 'plugin.json');
        break;
      case 'command':
        configPath = fs.join(homeDir, COMMANDS_DIR, `${cleanId}.json`);
        break;
      case 'connector':
        configPath = fs.join(homeDir, CONNECTORS_DIR, `${cleanId}.json`);
        break;
      case 'mcp':
        configPath = fs.join(homeDir, MCPS_DIR, `${cleanId}.json`);
        break;
      case 'cli-tool':
        configPath = fs.join(homeDir, CLI_TOOLS_DIR, `${cleanId}.json`);
        break;
      case 'webhook':
        configPath = fs.join(homeDir, WEBHOOKS_DIR, `${cleanId}.json`);
        break;
      default:
        return { success: false, error: 'Unknown capability type' };
    }

    configPath = await resolveToggleConfigPath(fs, type, homeDir, cleanId, configPath);
    
    // Read existing config
    let config: Record<string, unknown> = {};
    try {
      const existing = await fs.readFile(configPath);
      config = JSON.parse(existing);
    } catch {
      // No existing config, create new
    }
    
    config.enabled = enabled;
    config.updatedAt = new Date().toISOString();
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to toggle capability' };
  }
}
