/**
 * Avatar Creator Wizard Step
 * 
 * Integrates the avatar creation UI into the agent creation wizard.
 * Provides template selection, visual customization, and live preview.
 */

import React, { useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  Palette, 
  Eye, 
  Radio, 
  SlidersHorizontal,
  Undo2,
  Redo2,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import { useAvatarCreatorStore, AVATAR_TEMPLATES, type CreatorTab } from '../../stores/avatar-creator.store';
import { AgentAvatar } from '../../components/avatar';
import { AvatarPreview } from '../../components/avatar/AvatarPreview';
import { STUDIO_THEME } from '../AgentView';
import type { AgentSetup } from '../../lib/agents/character.types';

// Tab configuration
const TABS: { id: CreatorTab; label: string; icon: React.ReactNode }[] = [
  { id: 'body', label: 'Body', icon: <Palette size={16} /> },
  { id: 'eyes', label: 'Eyes', icon: <Eye size={16} /> },
  { id: 'colors', label: 'Colors', icon: <Sparkles size={16} /> },
  { id: 'antennas', label: 'Antennas', icon: <Radio size={16} /> },
  { id: 'personality', label: 'Personality', icon: <SlidersHorizontal size={16} /> },
];

interface AvatarCreatorStepProps {
  agentSetup?: AgentSetup;
  agentTemperament?: "precision" | "exploratory" | "systemic" | "balanced";
  onAvatarChange?: (avatarConfig: unknown) => void;
}

export const AvatarCreatorStep: React.FC<AvatarCreatorStepProps> = ({
  agentSetup,
  agentTemperament,
  onAvatarChange,
}) => {
  const {
    currentConfig,
    activeTab,
    selectedTemplateId,
    historyIndex,
    history,
    agentSetup: storedSetup,
    setAgentContext,
    applySmartDefaults,
    setActiveTab,
    applyTemplate,
    selectTemplate,
    undo,
    redo,
    canUndo,
    canRedo,
    resetConfig,
    randomize,
  } = useAvatarCreatorStore();

  // Initialize with agent context
  useEffect(() => {
    if (agentSetup && agentSetup !== storedSetup) {
      setAgentContext(agentSetup, agentTemperament || null);
      applySmartDefaults();
    }
  }, [agentSetup, agentTemperament, storedSetup, setAgentContext, applySmartDefaults]);

  // Notify parent of changes
  useEffect(() => {
    onAvatarChange?.(currentConfig);
  }, [currentConfig, onAvatarChange]);

  const handleUndo = useCallback(() => undo(), [undo]);
  const handleRedo = useCallback(() => redo(), [redo]);
  const handleReset = useCallback(() => resetConfig(), [resetConfig]);
  const handleRandomize = useCallback(() => randomize(), [randomize]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 320px',
        gap: '24px',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Left Panel - Templates & Navigation */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          height: '100%',
          overflow: 'auto',
          minHeight: 0,
        }}
      >
        {/* Templates Section */}
        <div
          style={{
            backgroundColor: STUDIO_THEME.bgCard,
            borderRadius: '12px',
            border: `1px solid ${STUDIO_THEME.border}`,
            padding: '16px',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: STUDIO_THEME.textPrimary,
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Wand2 size={16} />
            Templates
          </h3>
          
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
            }}
          >
            {AVATAR_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  applyTemplate(template);
                  selectTemplate(template.id);
                }}
                style={{
                  padding: '12px 8px',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: selectedTemplateId === template.id 
                    ? STUDIO_THEME.accent 
                    : 'transparent',
                  backgroundColor: selectedTemplateId === template.id 
                    ? `${STUDIO_THEME.accent}20`
                    : STUDIO_THEME.bg,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '24px' }}>{template.preview}</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: STUDIO_THEME.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {template.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
          }}
        >
          <button
            onClick={handleUndo}
            disabled={!canUndo()}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${STUDIO_THEME.border}`,
              backgroundColor: canUndo() ? STUDIO_THEME.bg : 'transparent',
              color: canUndo() ? STUDIO_THEME.textPrimary : STUDIO_THEME.textSecondary,
              cursor: canUndo() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
            }}
          >
            <Undo2 size={14} />
            Undo
          </button>
          
          <button
            onClick={handleRedo}
            disabled={!canRedo()}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${STUDIO_THEME.border}`,
              backgroundColor: canRedo() ? STUDIO_THEME.bg : 'transparent',
              color: canRedo() ? STUDIO_THEME.textPrimary : STUDIO_THEME.textSecondary,
              cursor: canRedo() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
            }}
          >
            <Redo2 size={14} />
            Redo
          </button>
          
          <button
            onClick={handleReset}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${STUDIO_THEME.border}`,
              backgroundColor: 'transparent',
              color: STUDIO_THEME.textSecondary,
              cursor: 'pointer',
            }}
            title="Reset to defaults"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Center Panel - Preview */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          height: '100%',
          overflow: 'auto',
          minHeight: 0,
        }}
      >
        <AvatarPreview />
      </div>

      {/* Right Panel - Customization Tabs */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          height: '100%',
          overflow: 'hidden',
          minHeight: 0,
          backgroundColor: STUDIO_THEME.bgCard,
          borderRadius: '12px',
          border: `1px solid ${STUDIO_THEME.border}`,
          overflow: 'hidden',
        }}
      >
        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${STUDIO_THEME.border}`,
            overflowX: 'auto',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '12px 8px',
                border: 'none',
                borderBottom: '2px solid',
                borderColor: activeTab === tab.id 
                  ? STUDIO_THEME.accent 
                  : 'transparent',
                backgroundColor: 'transparent',
                color: activeTab === tab.id 
                  ? STUDIO_THEME.accent 
                  : STUDIO_THEME.textSecondary,
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div
          style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
          }}
        >
          {activeTab === 'body' && <BodyCustomizationTab />}
          {activeTab === 'eyes' && <EyesCustomizationTab />}
          {activeTab === 'colors' && <ColorsCustomizationTab />}
          {activeTab === 'antennas' && <AntennasCustomizationTab />}
          {activeTab === 'personality' && <PersonalityCustomizationTab />}
        </div>

        {/* Randomize Button */}
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={handleRandomize}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: `1px dashed ${STUDIO_THEME.border}`,
              backgroundColor: 'transparent',
              color: STUDIO_THEME.textSecondary,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            🎲 Randomize Avatar
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Customization Tab Components
// ============================================================================

import { BodyCustomizationTab } from './BodyCustomizationTab';
import { EyesCustomizationTab } from './EyesCustomizationTab';
import { ColorsCustomizationTab } from './ColorsCustomizationTab';
import { AntennasCustomizationTab } from './AntennasCustomizationTab';
import { PersonalityCustomizationTab } from './PersonalityCustomizationTab';

AvatarCreatorStep.displayName = 'AvatarCreatorStep';
