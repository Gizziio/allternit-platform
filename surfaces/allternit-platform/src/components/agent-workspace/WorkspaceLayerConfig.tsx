/**
 * Workspace Layer Configuration Component
 * 
 * Allows users to configure which of the 5 workspace layers to enable
 * for their agent during creation.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  UserCircle,
  Shield,
  Wrench,
  Briefcase,
  Check,
  Info,
} from '@phosphor-icons/react';

export interface WorkspaceLayerConfig {
  cognitive: boolean;
  identity: boolean;
  governance: boolean;
  skills: boolean;
  business: boolean;
}

export const DEFAULT_LAYER_CONFIG: WorkspaceLayerConfig = {
  cognitive: true,
  identity: true,
  governance: true,
  skills: true,
  business: false,
};

interface LayerOption {
  id: keyof WorkspaceLayerConfig;
  label: string;
  description: string;
  icon: React.ElementType;
  files: string[];
  recommended?: boolean;
}

const LAYER_OPTIONS: LayerOption[] = [
  {
    id: 'cognitive',
    label: 'Cognitive Layer',
    description: 'BRAIN.md for task management, MEMORY.md for episodic memory, and active task tracking',
    icon: Brain,
    files: ['BRAIN.md', 'MEMORY.md', 'active-tasks.md'],
    recommended: true,
  },
  {
    id: 'identity',
    label: 'Identity Layer',
    description: 'IDENTITY.md for personality, SOUL.md for trust tiers, USER.md for user preferences',
    icon: UserCircle,
    files: ['IDENTITY.md', 'SOUL.md', 'USER.md', 'VOICE.md'],
    recommended: true,
  },
  {
    id: 'governance',
    label: 'Governance Layer',
    description: 'PLAYBOOK.md for execution rules, TOOLS.md for tool inventory, HEARTBEAT.md for scheduled tasks',
    icon: Shield,
    files: ['PLAYBOOK.md', 'TOOLS.md', 'HEARTBEAT.md', 'SYSTEM.md'],
    recommended: true,
  },
  {
    id: 'skills',
    label: 'Skills Layer',
    description: 'Skill definitions with contract.json and SKILL.md for each capability',
    icon: Wrench,
    files: ['skills/_template/SKILL.md', 'skills/_template/contract.json'],
    recommended: true,
  },
  {
    id: 'business',
    label: 'Business Layer',
    description: 'CLIENTS.md for external relationships and business context (advanced)',
    icon: Briefcase,
    files: ['CLIENTS.md'],
    recommended: false,
  },
];

interface WorkspaceLayerConfigProps {
  config: WorkspaceLayerConfig;
  onChange: (config: WorkspaceLayerConfig) => void;
  theme?: {
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    bgCard: string;
    bg: string;
    borderSubtle: string;
  };
}

export function WorkspaceLayerConfigurator({
  config,
  onChange,
  theme = {
    textPrimary: '#ECECEC',
    textSecondary: '#A0A0A0',
    textMuted: 'var(--ui-text-muted)',
    accent: 'var(--accent-primary)',
    bgCard: 'rgba(42, 33, 26, 0.6)',
    bg: '#0E0D0C',
    borderSubtle: 'var(--ui-border-muted)',
  },
}: WorkspaceLayerConfigProps) {
  const toggleLayer = (layerId: keyof WorkspaceLayerConfig) => {
    onChange({
      ...config,
      [layerId]: !config[layerId],
    });
  };

  const enabledCount = Object.values(config).filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          background: theme.bgCard,
          borderRadius: '8px',
          border: `1px solid ${theme.borderSubtle}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Info style={{ width: 16, height: 16, color: theme.accent }} />
          <span style={{ fontSize: '14px', fontWeight: 500, color: theme.textPrimary }}>
            Workspace Layers
          </span>
        </div>
        <p style={{ fontSize: '13px', color: theme.textSecondary, margin: 0, lineHeight: 1.5 }}>
          Choose which layers to include in your agent&apos;s workspace. Each layer adds specific
          markdown files that define how your agent operates. {enabledCount} of 5 layers enabled.
        </p>
      </div>

      {/* Layer Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {LAYER_OPTIONS.map((layer) => {
          const isEnabled = config[layer.id];
          const Icon = layer.icon;

          return (
            <motion.button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                background: isEnabled ? `${theme.accent}10` : theme.bgCard,
                border: `1px solid ${isEnabled ? theme.accent : theme.borderSubtle}`,
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Checkbox */}
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '4px',
                  border: `2px solid ${isEnabled ? theme.accent : theme.borderSubtle}`,
                  background: isEnabled ? theme.accent : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                {isEnabled && <Check style={{ width: 14, height: 14, color: '#fff' }} />}
              </div>

              {/* Icon */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '8px',
                  background: isEnabled ? `${theme.accent}20` : `${theme.textMuted}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon
                  style={{
                    width: 20,
                    height: 20,
                    color: isEnabled ? theme.accent : theme.textMuted,
                  }}
                />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: 500,
                      color: isEnabled ? theme.textPrimary : theme.textSecondary,
                    }}
                  >
                    {layer.label}
                  </span>
                  {layer.recommended && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        background: `${theme.accent}20`,
                        color: theme.accent,
                        borderRadius: '4px',
                        fontWeight: 500,
                      }}
                    >
                      Recommended
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: '13px',
                    color: theme.textMuted,
                    margin: '0 0 8px 0',
                    lineHeight: 1.4,
                  }}
                >
                  {layer.description}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {layer.files.map((file) => (
                    <span
                      key={file}
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: `${theme.textMuted}15`,
                        color: theme.textMuted,
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Quick Presets */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px',
          background: theme.bgCard,
          borderRadius: '8px',
          border: `1px solid ${theme.borderSubtle}`,
        }}
      >
        <span style={{ fontSize: '13px', color: theme.textMuted, marginRight: '8px' }}>
          Presets:
        </span>
        <button
          onClick={() => onChange({ cognitive: true, identity: true, governance: true, skills: true, business: false })}
          style={{
            fontSize: '12px',
            padding: '4px 10px',
            background: `${theme.accent}20`,
            color: theme.accent,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Standard
        </button>
        <button
          onClick={() => onChange({ cognitive: true, identity: true, governance: true, skills: true, business: true })}
          style={{
            fontSize: '12px',
            padding: '4px 10px',
            background: `${theme.textMuted}20`,
            color: theme.textSecondary,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Full
        </button>
        <button
          onClick={() => onChange({ cognitive: false, identity: true, governance: false, skills: false, business: false })}
          style={{
            fontSize: '12px',
            padding: '4px 10px',
            background: `${theme.textMuted}20`,
            color: theme.textSecondary,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Minimal
        </button>
      </div>
    </div>
  );
}

export default WorkspaceLayerConfigurator;
