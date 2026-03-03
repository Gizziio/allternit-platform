/**
 * Colors Customization Tab
 * 
 * Controls for primary, secondary, glow, and outline colors.
 */

import React from 'react';
import { useAvatarCreatorStore } from '../../stores/avatar-creator.store';
import { STUDIO_THEME } from '../AgentView';
import { SETUP_COLOR_PALETTES, PRESET_COLOR_SCHEMES } from '../../components/avatar/presets/colorPalettes';

const COLOR_LABELS: Record<string, { label: string; description: string }> = {
  primary: { label: 'Primary', description: 'Body fill color' },
  secondary: { label: 'Secondary', description: 'Accent and eye color' },
  glow: { label: 'Glow', description: 'Beacon emission color' },
  outline: { label: 'Outline', description: 'Border stroke color' },
};

export const ColorsCustomizationTab: React.FC = () => {
  const {
    currentConfig,
    setPrimaryColor,
    setSecondaryColor,
    setGlowColor,
    setOutlineColor,
    randomizeColors,
    agentSetup,
  } = useAvatarCreatorStore();

  const { colors } = currentConfig;
  const setup = agentSetup || 'generalist';
  const palette = SETUP_COLOR_PALETTES[setup];

  const colorSetters: Record<string, (color: string) => void> = {
    primary: setPrimaryColor,
    secondary: setSecondaryColor,
    glow: setGlowColor,
    outline: setOutlineColor,
  };

  const currentColors: Record<string, string> = {
    primary: colors.primary,
    secondary: colors.secondary,
    glow: colors.glow,
    outline: colors.outline,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Color Pickers */}
      {(Object.keys(COLOR_LABELS) as Array<keyof typeof COLOR_LABELS>).map((colorKey) => (
        <div key={colorKey}>
          <div style={{ marginBottom: '10px' }}>
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: STUDIO_THEME.textPrimary,
              }}
            >
              {COLOR_LABELS[colorKey].label}
            </h4>
            <p
              style={{
                fontSize: '11px',
                color: STUDIO_THEME.textSecondary,
                marginTop: '2px',
              }}
            >
              {COLOR_LABELS[colorKey].description}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              type="color"
              value={currentColors[colorKey]}
              onChange={(e) => colorSetters[colorKey](e.target.value)}
              style={{
                width: '44px',
                height: '44px',
                border: `2px solid ${STUDIO_THEME.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
              }}
            />
            <input
              type="text"
              value={currentColors[colorKey]}
              onChange={(e) => colorSetters[colorKey](e.target.value)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '6px',
                border: `1px solid ${STUDIO_THEME.border}`,
                backgroundColor: STUDIO_THEME.bg,
                color: STUDIO_THEME.textPrimary,
                fontSize: '13px',
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* Palette Swatches */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            {palette[colorKey].slice(0, 8).map((color) => (
              <button
                key={color}
                onClick={() => colorSetters[colorKey](color)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '2px solid',
                  borderColor: currentColors[colorKey] === color 
                    ? STUDIO_THEME.accent 
                    : 'transparent',
                  backgroundColor: color,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={color}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Preset Schemes */}
      <div>
        <h4
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            marginBottom: '12px',
          }}
        >
          Quick Presets
        </h4>
        
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
          }}
        >
          {Object.entries(PRESET_COLOR_SCHEMES)
            .filter(([id]) => id.startsWith(setup))
            .map(([id, scheme]) => (
              <button
                key={id}
                onClick={() => {
                  setPrimaryColor(scheme.primary);
                  setSecondaryColor(scheme.secondary);
                  setGlowColor(scheme.glow);
                  setOutlineColor(scheme.outline);
                }}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: `1px solid ${STUDIO_THEME.border}`,
                  backgroundColor: STUDIO_THEME.bg,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    width: '32px',
                    height: '24px',
                  }}
                >
                  <div style={{ flex: 1, backgroundColor: scheme.primary }} />
                  <div style={{ flex: 1, backgroundColor: scheme.secondary }} />
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: STUDIO_THEME.textPrimary,
                    textTransform: 'capitalize',
                  }}
                >
                  {id.split('-')[1]}
                </span>
              </button>
            ))}
        </div>
      </div>

      {/* Randomize Button */}
      <button
        onClick={randomizeColors}
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
        }}
      >
        🎲 Randomize Colors
      </button>
    </div>
  );
};

ColorsCustomizationTab.displayName = 'ColorsCustomizationTab';
