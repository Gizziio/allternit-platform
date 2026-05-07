/**
 * AgentCapabilitiesPanel
 * 
 * Displays enabled capabilities from plugins for the Cowork launchpad.
 * Shows what skills/commands/connectors are available for agents to use.
 */

import React, { useMemo, useState } from 'react';
import {
  PuzzlePiece as Puzzle,
  Terminal,
  BookOpen,
  PlugsConnected,
  CaretRight,
  CaretDown,
  Sparkle,
} from '@phosphor-icons/react';
import type { Plugin, PluginCommand, PluginSkill, PluginConnector } from '../../plugins/plugin.types';
import { useCapabilities } from '../../plugins/useCapabilities';

const THEME = {
  bg: 'var(--surface-canvas)',
  bgElevated: 'var(--surface-panel)',
  accent: 'var(--accent-primary)',
  accentMuted: 'rgba(212, 176, 140, 0.15)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--ui-text-secondary)',
  textTertiary: 'var(--ui-text-muted)',
  border: 'rgba(212, 176, 140, 0.1)',
};

interface AgentCapabilitiesPanelProps {
  /** Called when user requests to use a capability */
  onUseCapability?: (type: string, item: PluginCommand | PluginSkill | PluginConnector, prompt: string) => void;
  /** Whether to show the panel inline or as an overlay trigger */
  variant?: 'inline' | 'compact';
}

export function AgentCapabilitiesPanel({
  onUseCapability,
  variant = 'inline',
}: AgentCapabilitiesPanelProps) {
  const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set(['core-capabilities']));
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['commands']));
  const [showPanel, setShowPanel] = useState(false);
  const {
    skills,
    enabledSkillIds,
    commands,
    enabledCommandIds,
    connectors,
    enabledConnectorIds,
  } = useCapabilities();

  const enabledPlugins = useMemo<Plugin[]>(() => {
    const enabledCommands: PluginCommand[] = commands
      .filter((command) => enabledCommandIds.has(command.id))
      .map((command) => ({
        id: command.id,
        name: command.name,
        description: command.description,
        trigger: command.trigger,
        pluginId: 'core-capabilities',
      }));

    const enabledSkills: PluginSkill[] = skills
      .filter((skill) => enabledSkillIds.has(skill.id))
      .map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        content: skill.content,
        pluginId: 'core-capabilities',
      }));

    const enabledConnectors: PluginConnector[] = connectors
      .filter((connector) => enabledConnectorIds.has(connector.id))
      .map((connector) => {
        const authType = (
          connector.authType === 'oauth' ||
          connector.authType === 'apikey' ||
          connector.authType === 'token' ||
          connector.authType === 'none'
        )
          ? connector.authType
          : 'none';

        return {
          id: connector.id,
          name: connector.name,
          description: connector.description,
          appName: connector.appName,
          authType,
          installed: true,
          pluginId: 'core-capabilities',
        };
      });

    if (
      enabledCommands.length === 0 &&
      enabledSkills.length === 0 &&
      enabledConnectors.length === 0
    ) {
      return [];
    }

    return [
      {
        id: 'core-capabilities',
        name: 'Core Capabilities',
        version: '1.0.0',
        description: 'Enabled capabilities available to agents.',
        author: { name: 'Allternit System' },
        source: { type: 'local' },
        tags: ['core'],
        category: 'internal',
        enabled: true,
        commands: enabledCommands,
        skills: enabledSkills,
        connectors: enabledConnectors,
        mcps: [],
        webhooks: [],
      },
    ];
  }, [
    commands,
    connectors,
    enabledCommandIds,
    enabledConnectorIds,
    enabledSkillIds,
    skills,
  ]);

  const totalCapabilities = enabledPlugins.reduce((sum, p) => 
    sum + p.commands.length + p.skills.length + p.connectors.length, 0
  );

  const togglePlugin = (pluginId: string) => {
    setExpandedPlugins(prev => {
      const next = new Set(prev);
      if (next.has(pluginId)) next.delete(pluginId);
      else next.add(pluginId);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={() => setShowPanel(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: `1px solid ${THEME.border}`,
            background: 'transparent',
            color: THEME.textSecondary,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Puzzle size={16} />
          <span>{totalCapabilities} capabilities enabled</span>
        </button>

        {showPanel && (
          <CapabilitiesOverlay
            plugins={enabledPlugins}
            expandedPlugins={expandedPlugins}
            expandedTypes={expandedTypes}
            onTogglePlugin={togglePlugin}
            onToggleType={toggleType}
            onClose={() => setShowPanel(false)}
            onUseCapability={onUseCapability}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ marginTop: 48 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Puzzle size={16} color={THEME.textTertiary} />
        <h3
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: THEME.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0,
          }}
        >
          Available Capabilities ({totalCapabilities})
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {enabledPlugins.map((plugin) => (
          <PluginSection
            key={plugin.id}
            plugin={plugin}
            expanded={expandedPlugins.has(plugin.id)}
            expandedTypes={expandedTypes}
            onToggle={() => togglePlugin(plugin.id)}
            onToggleType={toggleType}
            onUse={onUseCapability}
          />
        ))}

        {enabledPlugins.length === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: THEME.textTertiary,
              fontSize: 13,
            }}
          >
            No plugins enabled. Open Plugin Manager to enable plugins.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Plugin Section
// ============================================================================

function PluginSection({
  plugin,
  expanded,
  expandedTypes,
  onToggle,
  onToggleType,
  onUse,
}: {
  plugin: Plugin;
  expanded: boolean;
  expandedTypes: Set<string>;
  onToggle: () => void;
  onToggleType: (type: string) => void;
  onUse?: (type: string, item: PluginCommand | PluginSkill | PluginConnector, prompt: string) => void;
}) {
  const hasCommands = plugin.commands.length > 0;
  const hasSkills = plugin.skills.length > 0;
  const hasConnectors = plugin.connectors.length > 0;

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${THEME.border}`,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Terminal size={18} color={THEME.accent} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: THEME.textPrimary }}>
          {plugin.name}
        </span>
        <span style={{ fontSize: 12, color: THEME.textTertiary }}>
          {plugin.commands.length + plugin.skills.length + plugin.connectors.length}
        </span>
        {expanded ? (
          <CaretDown size={16} color={THEME.textTertiary} />
        ) : (
          <CaretRight size={16} color={THEME.textTertiary} />
        )}
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${THEME.border}` }}>
          {hasCommands && (
            <CapabilityTypeSection
              type="commands"
              icon={<Terminal size={14} />}
              label="Commands"
              items={plugin.commands}
              expanded={expandedTypes.has('commands')}
              onToggle={() => onToggleType('commands')}
              onUse={onUse ? (item, prompt) => onUse('command', item, prompt) : undefined}
              renderTrigger={(item) => (item as PluginCommand).trigger}
            />
          )}
          {hasSkills && (
            <CapabilityTypeSection
              type="skills"
              icon={<BookOpen size={14} />}
              label="Skills"
              items={plugin.skills}
              expanded={expandedTypes.has('skills')}
              onToggle={() => onToggleType('skills')}
              onUse={onUse ? (item, prompt) => onUse('skill', item, prompt) : undefined}
            />
          )}
          {hasConnectors && (
            <CapabilityTypeSection
              type="connectors"
              icon={<PlugsConnected size={14} />}
              label="Connectors"
              items={plugin.connectors}
              expanded={expandedTypes.has('connectors')}
              onToggle={() => onToggleType('connectors')}
              onUse={onUse ? (item, prompt) => onUse('connector', item, prompt) : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Capability Type Section
// ============================================================================

function CapabilityTypeSection({
  type,
  icon,
  label,
  items,
  expanded,
  onToggle,
  onUse,
  renderTrigger,
}: {
  type: string;
  icon: React.ReactNode;
  label: string;
  items: (PluginCommand | PluginSkill | PluginConnector)[];
  expanded: boolean;
  onToggle: () => void;
  onUse?: (item: PluginCommand | PluginSkill | PluginConnector, prompt: string) => void;
  renderTrigger?: (item: PluginCommand | PluginSkill | PluginConnector) => string;
}) {
  return (
    <div style={{ borderBottom: `1px solid ${THEME.border}` }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ color: THEME.accent }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: THEME.textSecondary, textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: THEME.textTertiary }}>{items.length}</span>
        {expanded ? (
          <CaretDown size={14} color={THEME.textTertiary} />
        ) : (
          <CaretRight size={14} color={THEME.textTertiary} />
        )}
      </button>

      {expanded && (
        <div>
          {items.map((item) => (
            <CapabilityItem
              key={item.id}
              item={item}
              onUse={onUse}
              renderTrigger={renderTrigger}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Capability Item
// ============================================================================

function CapabilityItem({
  item,
  onUse,
  renderTrigger,
}: {
  item: PluginCommand | PluginSkill | PluginConnector;
  onUse?: (item: PluginCommand | PluginSkill | PluginConnector, prompt: string) => void;
  renderTrigger?: (item: PluginCommand | PluginSkill | PluginConnector) => string;
}) {
  const handleUse = () => {
    if (!onUse) return;
    
    let prompt = '';
    if (renderTrigger) {
      prompt = `Run ${renderTrigger(item)}`;
    } else {
      prompt = `Use ${item.name}`;
    }
    
    onUse(item, prompt);
  };

  return (
    <div
      style={{
        padding: '10px 16px 10px 40px',
        borderTop: `1px solid ${THEME.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: THEME.textPrimary }}>
          {renderTrigger ? renderTrigger(item) : item.name}
        </div>
        <div style={{ fontSize: 12, color: THEME.textTertiary, marginTop: 2 }}>
          {item.description.slice(0, 60)}...
        </div>
      </div>
      {onUse && (
        <button
          onClick={handleUse}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            backgroundColor: THEME.accentMuted,
            border: 'none',
            color: THEME.accent,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Use
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Capabilities Overlay (for compact variant)
// ============================================================================

function CapabilitiesOverlay({
  plugins,
  expandedPlugins,
  expandedTypes,
  onTogglePlugin,
  onToggleType,
  onClose,
  onUseCapability,
}: {
  plugins: Plugin[];
  expandedPlugins: Set<string>;
  expandedTypes: Set<string>;
  onTogglePlugin: (id: string) => void;
  onToggleType: (type: string) => void;
  onClose: () => void;
  onUseCapability?: (type: string, item: PluginCommand | PluginSkill | PluginConnector, prompt: string) => void;
}) {
  const totalEnabled = plugins.reduce((sum, p) => 
    sum + p.commands.length + p.skills.length + p.connectors.length, 0
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(4px)',
        zIndex: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: 500,
          maxHeight: '80vh',
          backgroundColor: THEME.bgElevated,
          border: `1px solid ${THEME.border}`,
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: THEME.textPrimary,
              margin: 0,
            }}
          >
            Available Capabilities ({totalEnabled})
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <CaretRight size={20} color={THEME.textTertiary} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>

        <div style={{ overflow: 'auto', padding: 16 }}>
          {plugins.map((plugin) => (
            <PluginSection
              key={plugin.id}
              plugin={plugin}
              expanded={expandedPlugins.has(plugin.id)}
              expandedTypes={expandedTypes}
              onToggle={() => onTogglePlugin(plugin.id)}
              onToggleType={onToggleType}
              onUse={onUseCapability}
            />
          ))}

          {plugins.length === 0 && (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: THEME.textTertiary,
                fontSize: 13,
              }}
            >
              No capabilities enabled. Open Plugin Manager to enable plugins.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentCapabilitiesPanel;
