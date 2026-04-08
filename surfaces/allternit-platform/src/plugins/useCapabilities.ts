/**
 * useCapabilities Hook
 *
 * Production-backed capabilities hook:
 * - Uses runtime scanners from useFileSystem
 * - Persists enabled state via capabilityEnabled.store
 * - Avoids static DEFAULT_* capability registries
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CapabilityType,
  Skill,
  Command,
  Connector,
  McpServer,
  CliTool,
  Webhook,
  Capability,
  SimpleCapability,
} from './capability.types';
import {
  readEnabledState,
  setEnabledIds as persistEnabledIds,
  subscribeToCapabilityChanges,
} from './capabilityEnabled.store';
import { useFeaturePlugins } from './useFeaturePlugins';
import type { FeaturePlugin } from './feature.types';
import { useFileSystem } from './fileSystem';

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function asObject(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function mapSkill(item: SimpleCapability): Skill {
  return {
    id: item.id,
    type: 'skill',
    name: item.name,
    description: item.description,
    category: 'skills',
    tags: [],
    enabledByDefault: item.enabled,
    updatedAt: item.updatedAt,
    version: item.version || 'runtime',
    author: item.author || 'System',
    content: item.content || '',
    variables: [],
    examples: [],
  };
}

function mapCommand(item: SimpleCapability): Command {
  const trigger = item.trigger?.trim() || `/${toSlug(item.name)}`;
  const triggerType: 'slash' | 'mention' = trigger.startsWith('@') ? 'mention' : 'slash';

  return {
    id: item.id,
    type: 'command',
    name: item.name,
    description: item.description,
    category: 'commands',
    tags: [],
    enabledByDefault: item.enabled,
    updatedAt: item.updatedAt,
    version: item.version || 'runtime',
    author: item.author || 'System',
    trigger,
    triggerType,
    commandType: triggerType,
    arguments: [],
    shortcuts: [],
  };
}

function mapConnector(item: SimpleCapability): Connector {
  const content = asObject(item.content);
  const appUrl = typeof content?.appUrl === 'string' ? content.appUrl : '';
  const authType = typeof content?.authType === 'string' ? content.authType : 'oauth';

  return {
    id: item.id,
    type: 'connector',
    name: item.name,
    description: item.description,
    category: 'connectors',
    tags: [],
    enabledByDefault: item.enabled,
    updatedAt: item.updatedAt,
    version: item.version || 'runtime',
    author: item.author || 'System',
    appName: item.appName || item.name,
    appUrl,
    authType,
    actions: [],
    webhooks: [],
  };
}

function mapMcp(item: SimpleCapability): McpServer {
  const content = asObject(item.content);
  const commandFromContent = typeof content?.command === 'string' ? content.command : '';
  const args = asStringArray(content?.args);

  return {
    id: item.id,
    type: 'mcp',
    name: item.name,
    description: item.description,
    category: 'mcps',
    tags: [],
    enabledByDefault: item.enabled,
    updatedAt: item.updatedAt,
    version: item.version || 'runtime',
    author: item.author || 'System',
    command: item.command || commandFromContent,
    args,
    tools: [],
    resources: [],
  };
}

function mapCliTool(item: SimpleCapability): CliTool {
  const command = item.command || toSlug(item.name);

  return {
    id: item.id,
    type: 'cli-tool',
    name: item.name,
    description: item.description,
    category: 'cli-tools',
    tags: [],
    enabledByDefault: item.enabled,
    updatedAt: item.updatedAt,
    version: item.version || 'runtime',
    author: item.author || 'System',
    command,
    installCommands: {},
    checkCommand: `${command} --version`,
    installed: true,
  };
}

function mapWebhook(item: SimpleCapability): Webhook {
  const content = asObject(item.content);
  const path = typeof content?.path === 'string'
    ? content.path
    : `/webhooks/${toSlug(item.name)}`;
  const eventType = typeof content?.eventType === 'string'
    ? content.eventType
    : typeof content?.event === 'string'
      ? content.event
      : toSlug(item.name);
  const connectedSkill = typeof content?.connectedSkill === 'string' ? content.connectedSkill : undefined;

  return {
    id: item.id,
    type: 'webhook',
    name: item.name,
    description: item.description,
    category: 'webhooks',
    tags: [],
    enabledByDefault: item.enabled,
    updatedAt: item.updatedAt,
    version: item.version || 'runtime',
    author: item.author || 'System',
    path,
    eventType,
    method: 'POST',
    connectedSkill,
  };
}

function deriveEnabledIds<T extends { id: string; enabledByDefault: boolean }>(
  type: CapabilityType,
  items: T[]
): Set<string> {
  const state = readEnabledState(type);
  if (state.hasStored) {
    return new Set(state.ids);
  }
  return new Set(items.filter((item) => item.enabledByDefault).map((item) => item.id));
}

function useCapabilitiesCore() {
  const {
    skills: rawSkills,
    commands: rawCommands,
    connectors: rawConnectors,
    mcps: rawMcps,
    cliTools: rawCliTools,
    webhooks: rawWebhooks,
    toggleCapabilityEnabled,
    refresh,
  } = useFileSystem();

  const skills = useMemo(() => rawSkills.map(mapSkill), [rawSkills]);
  const commands = useMemo(() => rawCommands.map(mapCommand), [rawCommands]);
  const connectors = useMemo(() => rawConnectors.map(mapConnector), [rawConnectors]);
  const mcps = useMemo(() => rawMcps.map(mapMcp), [rawMcps]);
  const cliTools = useMemo(() => rawCliTools.map(mapCliTool), [rawCliTools]);
  const webhooks = useMemo(() => rawWebhooks.map(mapWebhook), [rawWebhooks]);

  const [enabledSkillIds, setEnabledSkillIds] = useState<Set<string>>(new Set());
  const [enabledCommandIds, setEnabledCommandIds] = useState<Set<string>>(new Set());
  const [enabledConnectorIds, setEnabledConnectorIds] = useState<Set<string>>(new Set());
  const [enabledMcpIds, setEnabledMcpIds] = useState<Set<string>>(new Set());
  const [enabledCliToolIds, setEnabledCliToolIds] = useState<Set<string>>(new Set());
  const [enabledWebhookIds, setEnabledWebhookIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEnabledSkillIds(deriveEnabledIds('skill', skills));
    const unsubscribe = subscribeToCapabilityChanges('skill', () => {
      setEnabledSkillIds(deriveEnabledIds('skill', skills));
    });
    return unsubscribe;
  }, [skills]);

  useEffect(() => {
    setEnabledCommandIds(deriveEnabledIds('command', commands));
    const unsubscribe = subscribeToCapabilityChanges('command', () => {
      setEnabledCommandIds(deriveEnabledIds('command', commands));
    });
    return unsubscribe;
  }, [commands]);

  useEffect(() => {
    setEnabledConnectorIds(deriveEnabledIds('connector', connectors));
    const unsubscribe = subscribeToCapabilityChanges('connector', () => {
      setEnabledConnectorIds(deriveEnabledIds('connector', connectors));
    });
    return unsubscribe;
  }, [connectors]);

  useEffect(() => {
    setEnabledMcpIds(deriveEnabledIds('mcp', mcps));
    const unsubscribe = subscribeToCapabilityChanges('mcp', () => {
      setEnabledMcpIds(deriveEnabledIds('mcp', mcps));
    });
    return unsubscribe;
  }, [mcps]);

  useEffect(() => {
    setEnabledCliToolIds(deriveEnabledIds('cli-tool', cliTools));
    const unsubscribe = subscribeToCapabilityChanges('cli-tool', () => {
      setEnabledCliToolIds(deriveEnabledIds('cli-tool', cliTools));
    });
    return unsubscribe;
  }, [cliTools]);

  useEffect(() => {
    setEnabledWebhookIds(deriveEnabledIds('webhook', webhooks));
    const unsubscribe = subscribeToCapabilityChanges('webhook', () => {
      setEnabledWebhookIds(deriveEnabledIds('webhook', webhooks));
    });
    return unsubscribe;
  }, [webhooks]);

  const persistRuntimeToggle = useCallback(
    (type: 'skill' | 'command' | 'connector' | 'mcp' | 'cli-tool' | 'webhook', id: string, enabled: boolean) => {
      void (async () => {
        const result = await toggleCapabilityEnabled(type, id, enabled);
        if (result.success) {
          await refresh();
        }
      })();
    },
    [toggleCapabilityEnabled, refresh]
  );

  const toggleSkill = useCallback(
    (id: string) => {
      const next = new Set(enabledSkillIds);
      const enabled = !next.has(id);
      if (enabled) next.add(id);
      else next.delete(id);
      setEnabledSkillIds(next);
      persistEnabledIds('skill', next);
      persistRuntimeToggle('skill', id, enabled);
    },
    [enabledSkillIds, persistRuntimeToggle]
  );

  const toggleCommand = useCallback(
    (id: string) => {
      const next = new Set(enabledCommandIds);
      const enabled = !next.has(id);
      if (enabled) next.add(id);
      else next.delete(id);
      setEnabledCommandIds(next);
      persistEnabledIds('command', next);
      persistRuntimeToggle('command', id, enabled);
    },
    [enabledCommandIds, persistRuntimeToggle]
  );

  const toggleConnector = useCallback(
    (id: string) => {
      const next = new Set(enabledConnectorIds);
      const enabled = !next.has(id);
      if (enabled) next.add(id);
      else next.delete(id);
      setEnabledConnectorIds(next);
      persistEnabledIds('connector', next);
      persistRuntimeToggle('connector', id, enabled);
    },
    [enabledConnectorIds, persistRuntimeToggle]
  );

  const toggleMcp = useCallback(
    (id: string) => {
      const next = new Set(enabledMcpIds);
      const enabled = !next.has(id);
      if (enabled) next.add(id);
      else next.delete(id);
      setEnabledMcpIds(next);
      persistEnabledIds('mcp', next);
      persistRuntimeToggle('mcp', id, enabled);
    },
    [enabledMcpIds, persistRuntimeToggle]
  );

  const toggleCliTool = useCallback(
    (id: string) => {
      const next = new Set(enabledCliToolIds);
      const enabled = !next.has(id);
      if (enabled) next.add(id);
      else next.delete(id);
      setEnabledCliToolIds(next);
      persistEnabledIds('cli-tool', next);
      persistRuntimeToggle('cli-tool', id, enabled);
    },
    [enabledCliToolIds, persistRuntimeToggle]
  );

  const toggleWebhook = useCallback(
    (id: string) => {
      const next = new Set(enabledWebhookIds);
      const enabled = !next.has(id);
      if (enabled) next.add(id);
      else next.delete(id);
      setEnabledWebhookIds(next);
      persistEnabledIds('webhook', next);
      persistRuntimeToggle('webhook', id, enabled);
    },
    [enabledWebhookIds, persistRuntimeToggle]
  );

  const isSkillEnabled = useCallback((id: string) => enabledSkillIds.has(id), [enabledSkillIds]);
  const isCommandEnabled = useCallback((id: string) => enabledCommandIds.has(id), [enabledCommandIds]);
  const isConnectorEnabled = useCallback((id: string) => enabledConnectorIds.has(id), [enabledConnectorIds]);
  const isMcpEnabled = useCallback((id: string) => enabledMcpIds.has(id), [enabledMcpIds]);
  const isCliToolEnabled = useCallback((id: string) => enabledCliToolIds.has(id), [enabledCliToolIds]);
  const isWebhookEnabled = useCallback((id: string) => enabledWebhookIds.has(id), [enabledWebhookIds]);

  return {
    skills,
    commands,
    connectors,
    mcps,
    cliTools,
    webhooks,
    enabledSkillIds,
    enabledCommandIds,
    enabledConnectorIds,
    enabledMcpIds,
    enabledCliToolIds,
    enabledWebhookIds,
    toggleSkill,
    toggleCommand,
    toggleConnector,
    toggleMcp,
    toggleCliTool,
    toggleWebhook,
    isSkillEnabled,
    isCommandEnabled,
    isConnectorEnabled,
    isMcpEnabled,
    isCliToolEnabled,
    isWebhookEnabled,
  };
}

export function useSkills() {
  const core = useCapabilitiesCore();
  return {
    skills: core.skills,
    enabledIds: core.enabledSkillIds,
    toggleSkill: core.toggleSkill,
    isSkillEnabled: core.isSkillEnabled,
  };
}

export function useCommands() {
  const core = useCapabilitiesCore();
  return {
    commands: core.commands,
    enabledIds: core.enabledCommandIds,
    toggleCommand: core.toggleCommand,
    isCommandEnabled: core.isCommandEnabled,
  };
}

export function useConnectors() {
  const core = useCapabilitiesCore();
  return {
    connectors: core.connectors,
    enabledIds: core.enabledConnectorIds,
    toggleConnector: core.toggleConnector,
    isConnectorEnabled: core.isConnectorEnabled,
  };
}

export function useMcps() {
  const core = useCapabilitiesCore();
  return {
    mcps: core.mcps,
    enabledIds: core.enabledMcpIds,
    toggleMcp: core.toggleMcp,
    isMcpEnabled: core.isMcpEnabled,
  };
}

export function useCliTools() {
  const core = useCapabilitiesCore();
  return {
    cliTools: core.cliTools,
    enabledIds: core.enabledCliToolIds,
    toggleCliTool: core.toggleCliTool,
    isCliToolEnabled: core.isCliToolEnabled,
  };
}

export function useWebhooks() {
  const core = useCapabilitiesCore();
  return {
    webhooks: core.webhooks,
    enabledIds: core.enabledWebhookIds,
    toggleWebhook: core.toggleWebhook,
    isWebhookEnabled: core.isWebhookEnabled,
  };
}

// ============================================================================
// Unified Hook (for Agent Launchpad)
// ============================================================================

export interface UseCapabilitiesReturn {
  // Skills
  skills: Skill[];
  enabledSkillIds: Set<string>;
  toggleSkill: (id: string) => void;
  isSkillEnabled: (id: string) => boolean;

  // Commands
  commands: Command[];
  enabledCommandIds: Set<string>;
  toggleCommand: (id: string) => void;
  isCommandEnabled: (id: string) => boolean;

  // Connectors
  connectors: Connector[];
  enabledConnectorIds: Set<string>;
  toggleConnector: (id: string) => void;
  isConnectorEnabled: (id: string) => boolean;

  // MCPs
  mcps: McpServer[];
  enabledMcpIds: Set<string>;
  toggleMcp: (id: string) => void;
  isMcpEnabled: (id: string) => boolean;

  // Plugins (existing)
  plugins: FeaturePlugin[];
  enabledPluginIds: Set<string>;
  togglePlugin: (id: string) => void;
  isPluginEnabled: (id: string) => boolean;

  // CLI Tools
  cliTools: CliTool[];
  enabledCliToolIds: Set<string>;
  toggleCliTool: (id: string) => void;
  isCliToolEnabled: (id: string) => boolean;

  // Webhooks
  webhooks: Webhook[];
  enabledWebhookIds: Set<string>;
  toggleWebhook: (id: string) => void;
  isWebhookEnabled: (id: string) => boolean;

  // All enabled for Agent Launchpad
  allEnabledCapabilities: Capability[];
}

export function useCapabilities(): UseCapabilitiesReturn {
  const core = useCapabilitiesCore();
  const pluginsData = useFeaturePlugins();

  const allEnabledCapabilities = useMemo<Capability[]>(() => {
    return [
      ...core.skills.filter((s) => core.enabledSkillIds.has(s.id)),
      ...core.commands.filter((c) => core.enabledCommandIds.has(c.id)),
      ...core.connectors.filter((c) => core.enabledConnectorIds.has(c.id)),
      ...core.mcps.filter((m) => core.enabledMcpIds.has(m.id)),
      ...core.cliTools.filter((c) => core.enabledCliToolIds.has(c.id)),
      ...core.webhooks.filter((w) => core.enabledWebhookIds.has(w.id)),
    ];
  }, [core]);

  return {
    skills: core.skills,
    enabledSkillIds: core.enabledSkillIds,
    toggleSkill: core.toggleSkill,
    isSkillEnabled: core.isSkillEnabled,

    commands: core.commands,
    enabledCommandIds: core.enabledCommandIds,
    toggleCommand: core.toggleCommand,
    isCommandEnabled: core.isCommandEnabled,

    connectors: core.connectors,
    enabledConnectorIds: core.enabledConnectorIds,
    toggleConnector: core.toggleConnector,
    isConnectorEnabled: core.isConnectorEnabled,

    mcps: core.mcps,
    enabledMcpIds: core.enabledMcpIds,
    toggleMcp: core.toggleMcp,
    isMcpEnabled: core.isMcpEnabled,

    plugins: pluginsData.allPlugins,
    enabledPluginIds: pluginsData.enabledIds,
    togglePlugin: pluginsData.toggle,
    isPluginEnabled: pluginsData.isEnabled,

    cliTools: core.cliTools,
    enabledCliToolIds: core.enabledCliToolIds,
    toggleCliTool: core.toggleCliTool,
    isCliToolEnabled: core.isCliToolEnabled,

    webhooks: core.webhooks,
    enabledWebhookIds: core.enabledWebhookIds,
    toggleWebhook: core.toggleWebhook,
    isWebhookEnabled: core.isWebhookEnabled,

    allEnabledCapabilities,
  };
}
