/**
 * Antennas Customization Tab
 * 
 * Controls for antenna count, style, animation, and tip decoration.
 */

import React from 'react';
import { useAvatarCreatorStore } from '../../stores/avatar-creator.store';
import { 
  ANTENNA_STYLE_METADATA, 
  ANTENNA_ANIMATION_METADATA, 
  TIP_DECORATION_METADATA 
} from '../../components/Avatar';
import { STUDIO_THEME } from '../AgentView';
import type { AntennaStyle, AntennaAnimation } from '../../lib/agents/character.types';

const ANTENNA_EMOJI: Record<AntennaStyle, string> = {
  straight: '│',
  curved: '⎛',
  coiled: '@',
  zigzag: '⚡',
  leaf: '🌿',
  bolt: '⌁',
};

const ANIMATION_EMOJI: Record<string, string> = {
  static: '⏸️',
  wiggle: '〰️',
  pulse: '💓',
  sway: '🍃',
  bounce: '⬆️',
};

const TIP_EMOJI: Record<string, string> = {
  none: '○',
  ball: '●',
  glow: '✦',
  star: '⭐',
  diamond: '◆',
};

export const AntennasCustomizationTab: React.FC = () => {
  const {
    currentConfig,
    setAntennaCount,
    setAntennaStyle,
    setAntennaAnimation,
    setAntennaTip,
    randomizeAntennas,
  } = useAvatarCreatorStore();

  const antennas = currentConfig.antennas ?? { count: 2, style: 'curved', animation: 'sway', tipDecoration: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Antenna Count */}
      <div>
        <h4
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            marginBottom: '12px',
          }}
        >
          Antenna Count: {antennas?.count ?? 0}
        </h4>
        
        <div
          style={{
            display: 'flex',
            gap: '8px',
          }}
        >
          {[0, 1, 2, 3].map((count) => (
            <button
              type="button"
              key={count}
              onClick={() => setAntennaCount(count as 0 | 1 | 2 | 3)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: antennas?.count === count 
                  ? STUDIO_THEME.accent 
                  : STUDIO_THEME.border,
                backgroundColor: antennas?.count === count 
                  ? `${STUDIO_THEME.accent}15`
                  : STUDIO_THEME.bg,
                color: antennas?.count === count 
                  ? STUDIO_THEME.accent 
                  : STUDIO_THEME.textPrimary,
                fontSize: '18px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {count}
            </button>
          ))}
        </div>
        
        {(antennas?.count ?? 0) === 0 && (
          <p
            style={{
              fontSize: '12px',
              color: STUDIO_THEME.textSecondary,
              marginTop: '8px',
              fontStyle: 'italic',
            }}
          >
            No antennas - sleek and minimal
          </p>
        )}
      </div>

      {(antennas?.count ?? 0) > 0 && (
        <>
          {/* Antenna Style */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <h4
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                }}
              >
                Style
              </h4>
              <button
                type="button"
                onClick={randomizeAntennas}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${STUDIO_THEME.border}`,
                  backgroundColor: 'transparent',
                  color: STUDIO_THEME.textSecondary,
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                🎲 Random
              </button>
            </div>
            
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
              }}
            >
              {Object.entries(ANTENNA_STYLE_METADATA).map(([id, meta]) => {
                const isSelected = antennas?.style === id;
                
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setAntennaStyle(id as AntennaStyle)}
                    style={{
                      padding: '12px 4px',
                      borderRadius: '8px',
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
                      gap: '6px',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>
                      {ANTENNA_EMOJI[id as AntennaStyle]}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        color: isSelected 
                          ? STUDIO_THEME.accent 
                          : STUDIO_THEME.textSecondary,
                        textAlign: 'center',
                      }}
                    >
                      {meta.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Animation Style */}
          <div>
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: STUDIO_THEME.textPrimary,
                marginBottom: '12px',
              }}
            >
              Animation
            </h4>
            
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
              }}
            >
              {Object.entries(ANTENNA_ANIMATION_METADATA).map(([id, meta]) => {
                const isSelected = antennas?.animation === id;
                
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setAntennaAnimation(id as AntennaAnimation)}
                    style={{
                      padding: '10px 4px',
                      borderRadius: '8px',
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
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>
                      {ANIMATION_EMOJI[id]}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        color: isSelected 
                          ? STUDIO_THEME.accent 
                          : STUDIO_THEME.textSecondary,
                      }}
                    >
                      {meta.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tip Decoration */}
          <div>
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: STUDIO_THEME.textPrimary,
                marginBottom: '12px',
              }}
            >
              Tip Decoration
            </h4>
            
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '6px',
              }}
            >
              {Object.entries(TIP_DECORATION_METADATA).map(([id, meta]) => {
                const isSelected = antennas?.tipDecoration === id;
                
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setAntennaTip(id as "none" | "ball" | "glow" | "star" | "diamond")}
                    style={{
                      padding: '10px 4px',
                      borderRadius: '8px',
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
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>
                      {TIP_EMOJI[id]}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 500,
                        color: isSelected 
                          ? STUDIO_THEME.accent 
                          : STUDIO_THEME.textSecondary,
                      }}
                    >
                      {meta.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

AntennasCustomizationTab.displayName = 'AntennasCustomizationTab';
