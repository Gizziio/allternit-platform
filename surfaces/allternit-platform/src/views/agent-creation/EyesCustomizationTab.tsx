/**
 * Eyes Customization Tab
 * 
 * Controls for eye preset, size, color, pupil style, and blink rate.
 */

import React from 'react';
import { useAvatarCreatorStore } from '../../stores/avatar-creator.store';
import { EYE_PRESET_METADATA, PUPIL_STYLE_METADATA } from '../../components/Avatar';
import { STUDIO_THEME } from '../AgentView';
import type { EyePreset, PupilStyle, BlinkRate } from '../../lib/agents/character.types';

const EMOJI_MAP: Record<EyePreset, string> = {
  round: '● ●',
  wide: '◯ ◯',
  narrow: '▬ ▬',
  curious: '◐ ◑',
  pleased: 'ᵔ ᵔ',
  skeptical: '◔ ◔',
  mischief: '◕ ◕',
  proud: '‾◡‾',
  dizzy: '◎ ◎',
  sleepy: '◡ ◡',
  starry: '✦ ✦',
  pixel: '⬛ ⬛',
  focused: '◉ ◉',
};

const PUPIL_EMOJI: Record<PupilStyle, string> = {
  dot: '●',
  ring: '◯',
  slit: '|',
  star: '★',
  heart: '♥',
  plus: '+',
};

const BLINK_OPTIONS: { value: BlinkRate; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
  { value: 'never', label: 'Never' },
];

export const EyesCustomizationTab: React.FC = () => {
  const {
    currentConfig,
    setEyePreset,
    setEyeSize,
    setEyeColor,
    setPupilStyle,
    setBlinkRate,
    randomizeEyes,
  } = useAvatarCreatorStore();

  const eyes = currentConfig.eyes ?? { preset: 'round', size: 1, color: '#ECECEC', pupilStyle: 'dot', blinkRate: 'normal' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Eye Preset */}
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
            Eye Shape
          </h4>
          <button
            type="button"
            onClick={randomizeEyes}
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
          {EYE_PRESET_METADATA.map((preset) => {
            const isSelected = eyes.preset === preset.id;
            
            return (
              <button
                type="button"
                key={preset.id}
                onClick={() => setEyePreset(preset.id)}
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
                <span
                  style={{
                    fontSize: '18px',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '-2px',
                  }}
                >
                  {EMOJI_MAP[preset.id]}
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
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Eye Size Slider */}
      <div>
        <h4
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            marginBottom: '12px',
          }}
        >
          Eye Size: {Math.round((eyes.size ?? 1) * 100)}%
        </h4>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.1"
          value={eyes.size ?? 1}
          onChange={(e) => setEyeSize(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            backgroundColor: STUDIO_THEME.bg,
            accentColor: STUDIO_THEME.accent,
            cursor: 'pointer',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: STUDIO_THEME.textSecondary,
            marginTop: '4px',
          }}
        >
          <span>Small</span>
          <span>Large</span>
        </div>
      </div>

      {/* Eye Color */}
      <div>
        <h4
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            marginBottom: '12px',
          }}
        >
          Eye Color
        </h4>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="color"
            value={eyes.color ?? '#ECECEC'}
            onChange={(e) => setEyeColor(e.target.value)}
            style={{
              width: '48px',
              height: '48px',
              border: `2px solid ${STUDIO_THEME.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: 'transparent',
            }}
          />
          <input
            type="text"
            value={eyes.color ?? '#ECECEC'}
            onChange={(e) => setEyeColor(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '6px',
              border: `1px solid ${STUDIO_THEME.border}`,
              backgroundColor: STUDIO_THEME.bg,
              color: STUDIO_THEME.textPrimary,
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>
      </div>

      {/* Pupil Style */}
      <div>
        <h4
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            marginBottom: '12px',
          }}
        >
          Pupil Style
        </h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}
        >
          {Object.entries(PUPIL_STYLE_METADATA).map(([id, meta]) => {
            const isSelected = (eyes.pupilStyle ?? 'dot') === id;
            
            return (
              <button
                type="button"
                key={id}
                onClick={() => setPupilStyle(id as PupilStyle)}
                style={{
                  padding: '10px',
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
                <span style={{ fontSize: '20px' }}>
                  {PUPIL_EMOJI[id as PupilStyle]}
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

      {/* Blink Rate */}
      <div>
        <h4
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            marginBottom: '12px',
          }}
        >
          Blink Rate
        </h4>
        <div
          style={{
            display: 'flex',
            gap: '6px',
          }}
        >
          {BLINK_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => setBlinkRate(opt.value)}
              style={{
                flex: 1,
                padding: '10px 6px',
                borderRadius: '6px',
                border: '2px solid',
                borderColor: eyes.blinkRate === opt.value 
                  ? STUDIO_THEME.accent 
                  : STUDIO_THEME.border,
                backgroundColor: eyes.blinkRate === opt.value 
                  ? `${STUDIO_THEME.accent}15`
                  : STUDIO_THEME.bg,
                color: eyes.blinkRate === opt.value 
                  ? STUDIO_THEME.accent 
                  : STUDIO_THEME.textSecondary,
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

EyesCustomizationTab.displayName = 'EyesCustomizationTab';
