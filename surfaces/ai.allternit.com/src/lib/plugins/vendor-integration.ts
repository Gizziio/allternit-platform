/**
 * Vendor Plugin Integration
 * 
 * Integrates third-party plugins (Claude Desktop, etc.) into the Allternit
 * unified plugin system with command routing, skill execution, and MCP support.
 */

import {
  ALL_CLAUDE_DESKTOP_PLUGINS,
  getPluginById,
} from '@/plugins/vendor/claude-desktop-registry';

// =============================================================================
// VENDOR PLUGIN TYPES
// =============================================================================

export interface VendorPlugin {
  id: string;
  name: string;
  vendor: 'claude-desktop' | 'copilot' | 'cursor' | 'other';
  version: string;
  category: 'create' | 'analyze' | 'build' | 'automate';
  icon?: string;
  color: string;
  description: string;
  enabled: boolean;
}

export interface VendorCommand {
  pluginId: string;
  trigger: string;
  name: string;
  description: string;
  handler: () => Promise<void>;
}

export interface CommandContext {
  pluginId: string;
  commandId: string;
  args: Record<string, unknown>;
  files?: File[];
}

// =============================================================================
// CLAUDE DESKTOP INTEGRATION
// =============================================================================

/**
 * Convert Claude Desktop plugins to unified vendor format
 */
export function getClaudeDesktopPlugins(): VendorPlugin[] {
  return ALL_CLAUDE_DESKTOP_PLUGINS.map(plugin => ({
    id: plugin.id,
    name: plugin.name,
    vendor: 'claude-desktop' as const,
    version: plugin.version,
    category: plugin.category,
    color: getCategoryColor(plugin.category),
    description: plugin.description,
    enabled: true,
  }));
}

/**
 * Get color for category
 */
function getCategoryColor(category: string): string {
  switch (category) {
    case 'create': return 'violet';
    case 'analyze': return 'blue';
    case 'build': return 'emerald';
    case 'automate': return 'amber';
    default: return 'slate';
  }
}

// =============================================================================
// COMMAND ROUTING
// =============================================================================

const commandRegistry = new Map<string, VendorCommand>();

/**
 * Register all Claude Desktop commands
 */
export function registerClaudeDesktopCommands(): void {
  for (const plugin of ALL_CLAUDE_DESKTOP_PLUGINS) {
    for (const command of plugin.commands) {
      commandRegistry.set(command.trigger, {
        pluginId: plugin.id,
        trigger: command.trigger,
        name: command.name,
        description: command.description,
        handler: async () => {
          // In a real implementation, this would load and execute the command
          console.log(`[Claude Desktop] Executing ${command.trigger}`);
          // TODO: Load command markdown and execute
        },
      });
    }
  }
}

/**
 * Get a command by its trigger
 */
export function getVendorCommand(trigger: string): VendorCommand | undefined {
  return commandRegistry.get(trigger);
}

/**
 * Check if input is a vendor command
 */
export function isVendorCommand(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.startsWith('/') && trimmed.includes(':') && commandRegistry.has(trimmed);
}

/**
 * Execute a vendor command
 */
export async function executeVendorCommand(trigger: string, context?: CommandContext): Promise<void> {
  const command = commandRegistry.get(trigger);
  if (!command) {
    throw new Error(`Command not found: ${trigger}`);
  }
  
  await command.handler();
}

/**
 * Get all available commands
 */
export function getAllVendorCommands(): VendorCommand[] {
  return Array.from(commandRegistry.values());
}

/**
 * Get commands for a specific plugin
 */
export function getCommandsForPlugin(pluginId: string): VendorCommand[] {
  return Array.from(commandRegistry.values()).filter(cmd => cmd.pluginId === pluginId);
}

// =============================================================================
// MODE SELECTOR INTEGRATION
// =============================================================================

export interface ModeSelectorEntry {
  id: string;
  name: string;
  group: 'create' | 'analyze' | 'build' | 'automate';
  shade: number;
  vendor: 'claude-desktop' | 'built-in';
  commandCount?: number;
  skillCount?: number;
}

/**
 * Get all mode selector entries including vendor plugins
 */
export function getAllModeSelectorEntries(): ModeSelectorEntry[] {
  const entries: ModeSelectorEntry[] = [];
  
  // Built-in modes
  const builtInEntries: ModeSelectorEntry[] = [
    { id: 'image', name: 'Image', group: 'create', shade: 0, vendor: 'built-in' },
    { id: 'video', name: 'Video', group: 'create', shade: 1, vendor: 'built-in' },
    { id: 'slides', name: 'Slides', group: 'create', shade: 2, vendor: 'built-in' },
    { id: 'website', name: 'Website', group: 'create', shade: 3, vendor: 'built-in' },
    { id: 'research', name: 'Research', group: 'analyze', shade: 0, vendor: 'built-in' },
    { id: 'data', name: 'Data', group: 'analyze', shade: 1, vendor: 'built-in' },
    { id: 'code', name: 'Code', group: 'build', shade: 0, vendor: 'built-in' },
    { id: 'assets', name: 'Assets', group: 'build', shade: 1, vendor: 'built-in' },
    { id: 'swarms', name: 'Swarms', group: 'automate', shade: 0, vendor: 'built-in' },
    { id: 'flow', name: 'Flow', group: 'automate', shade: 1, vendor: 'built-in' },
  ];
  
  entries.push(...builtInEntries);
  
  // Claude Desktop plugins
  const claudeEntries: ModeSelectorEntry[] = ALL_CLAUDE_DESKTOP_PLUGINS
    .filter(p => !['image', 'video', 'slides', 'website', 'research', 'data', 'code', 'assets', 'swarms', 'flow'].includes(p.id))
    .map((plugin, index) => ({
      id: plugin.id,
      name: plugin.name,
      group: plugin.category,
      shade: (index % 4) + 1, // Distribute shades
      vendor: 'claude-desktop',
      commandCount: plugin.commandCount,
      skillCount: plugin.skillCount,
    }));
  
  entries.push(...claudeEntries);
  
  return entries;
}

// =============================================================================
// CHAT INPUT PARSING
// =============================================================================

export interface ParsedCommand {
  type: 'vendor-command' | 'vendor-plugin' | 'built-in' | 'natural-language';
  pluginId?: string;
  commandId?: string;
  args?: Record<string, unknown>;
  raw: string;
}

/**
 * Parse user input to detect vendor commands
 */
export function parseCommandInput(input: string): ParsedCommand {
  const trimmed = input.trim();
  
  // Check for vendor command format: /plugin:command
  if (trimmed.startsWith('/') && trimmed.includes(':')) {
    const [pluginPart, ...rest] = trimmed.slice(1).split(':');
    const commandPart = rest.join(':');
    const trigger = `/${pluginPart}:${commandPart}`;
    
    if (commandRegistry.has(trigger)) {
      const command = commandRegistry.get(trigger)!;
      return {
        type: 'vendor-command',
        pluginId: command.pluginId,
        commandId: command.name,
        raw: trimmed,
      };
    }
    
    // Might be just plugin reference: /plugin (legacy format)
    const plugin = getPluginById(pluginPart);
    if (plugin) {
      return {
        type: 'vendor-plugin',
        pluginId: pluginPart,
        raw: trimmed,
      };
    }
  }
  
  // Check for built-in mode: /mode
  if (trimmed.startsWith('/') && !trimmed.includes(':')) {
    const mode = trimmed.slice(1);
    const validModes = ['image', 'video', 'slides', 'website', 'research', 'data', 'code', 'assets', 'swarms', 'flow'];
    if (validModes.includes(mode)) {
      return {
        type: 'built-in',
        pluginId: mode,
        raw: trimmed,
      };
    }
  }
  
  return {
    type: 'natural-language',
    raw: trimmed,
  };
}

// =============================================================================
// INITIALIZATION
// =============================================================================

let isInitialized = false;

/**
 * Initialize vendor plugin integration
 */
export function initializeVendorPlugins(): void {
  if (isInitialized) return;
  
  registerClaudeDesktopCommands();
  
  console.log(`[Vendor Plugins] Initialized with ${commandRegistry.size} commands from ${ALL_CLAUDE_DESKTOP_PLUGINS.length} Claude Desktop plugins`);
  
  isInitialized = true;
}

// Auto-initialize on import
initializeVendorPlugins();
