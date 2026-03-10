/**
 * Body Customization Tab
 * 
 * Controls for body shape selection.
 */

import React from 'react';
import { useAvatarCreatorStore } from '../../stores/avatar-creator.store';
import { BODY_SHAPE_METADATA } from '../../components/Avatar';
import { STUDIO_THEME } from '../AgentView';
import type { AvatarBodyShape } from '../../lib/agents/character.types';

const BODY_SHAPES: { id: AvatarBodyShape; emoji: string }[] = [
  { id: 'round', emoji: '🔵' },
  { id: 'square', emoji: '🟦' },
  { id: 'hex', emoji: '⬡' },
  { id: 'diamond', emoji: '◆' },
  { id: 'cloud', emoji: '☁️' },
];

export const BodyCustomizationTab: React.FC = () => {
  const { currentConfig, setBaseShape } = useAvatarCreatorStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h4
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            marginBottom: '12px',
          }}
        >
          Body Shape
        </h4>
        
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
          }}
        >
          {BODY_SHAPES.map((shape) => {
            const meta = BODY_SHAPE_METADATA[shape.id];
            const isSelected = currentConfig.baseShape === shape.id;
            
            return (
              <button
                type="button"
                key={shape.id}
                onClick={() => setBaseShape(shape.id)}
                style={{
                  padding: '16px 8px',
                  borderRadius: '10px',
                  border: '2px solid',
                  borderColor: isSelected 
                    ? STUDIO_THEME.accent 
                    : STUDIO_THEME.border,
                  backgroundColor: isSelected 
                    ? `${STUDIO_THEME.accent}15`
                    : STUDIO_THEME.bg,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '28px' }}>{shape.emoji}</span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: isSelected 
                      ? STUDIO_THEME.accent 
                      : STUDIO_THEME.textPrimary,
                  }}
                >
                  {meta.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Shape Info */}
      <div
        style={{
          padding: '16px',
          backgroundColor: STUDIO_THEME.bg,
          borderRadius: '8px',
          border: `1px solid ${STUDIO_THEME.border}`,
        }}
      >
        <h5
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: STUDIO_THEME.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '8px',
          }}
        >
          Selected Shape
        </h5>
        <p style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, marginBottom: '4px' }}>
          {currentConfig.baseShape ? BODY_SHAPE_METADATA[currentConfig.baseShape]?.name : 'Unknown'}
        </p>
        <p style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>
          {currentConfig.baseShape ? BODY_SHAPE_METADATA[currentConfig.baseShape]?.description : ''}
        </p>
        <p style={{ fontSize: '11px', color: STUDIO_THEME.accent, marginTop: '8px' }}>
          Best for: {currentConfig.baseShape ? BODY_SHAPE_METADATA[currentConfig.baseShape]?.idealSetup : 'general'} agents
        </p>
      </div>
    </div>
  );
};

BodyCustomizationTab.displayName = 'BodyCustomizationTab';
