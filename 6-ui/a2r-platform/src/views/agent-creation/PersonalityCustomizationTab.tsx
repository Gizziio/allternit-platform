/**
 * Personality Customization Tab
 * 
 * Controls for idle animation behavior (bounce, sway, breathing).
 */

import React from 'react';
import { useAvatarCreatorStore } from '../../stores/avatar-creator.store';
import { STUDIO_THEME } from '../AgentView';

export const PersonalityCustomizationTab: React.FC = () => {
  const {
    currentConfig,
    setBounce,
    setSway,
    setBreathing,
  } = useAvatarCreatorStore();

  const { personality } = currentConfig;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Intro Text */}
      <div
        style={{
          padding: '16px',
          backgroundColor: STUDIO_THEME.bg,
          borderRadius: '8px',
          border: `1px solid ${STUDIO_THEME.border}`,
        }}
      >
        <p style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, lineHeight: 1.5 }}>
          Adjust how your avatar behaves when idle. These settings control the 
          subtle animations that bring your agent to life.
        </p>
      </div>

      {/* Bounce Slider */}
      <div>
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: STUDIO_THEME.textPrimary,
              }}
            >
              Bounce Energy
            </h4>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: STUDIO_THEME.accent,
              }}
            >
              {Math.round(personality.bounce * 100)}%
            </span>
          </div>
          <p
            style={{
              fontSize: '11px',
              color: STUDIO_THEME.textSecondary,
            }}
          >
            How much your avatar bobs up and down
          </p>
        </div>
        
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={personality.bounce}
          onChange={(e) => setBounce(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: '8px',
            borderRadius: '4px',
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
            marginTop: '6px',
          }}
        >
          <span>Still</span>
          <span>Subtle</span>
          <span>Energetic</span>
        </div>

        {/* Visual Indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '16px',
            height: '40px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: STUDIO_THEME.accent,
              animation: personality.bounce > 0 
                ? `demo-bounce ${2 - personality.bounce}s ease-in-out infinite`
                : 'none',
              opacity: personality.bounce > 0 ? 1 : 0.5,
            }}
          />
          <style>{`
            @keyframes demo-bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-${personality.bounce * 10}px); }
            }
          `}</style>
        </div>
      </div>

      {/* Sway Slider */}
      <div>
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
            }}
          >
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: STUDIO_THEME.textPrimary,
              }}
            >
              Sway Amount
            </h4>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: STUDIO_THEME.accent,
              }}
            >
              {Math.round(personality.sway * 100)}%
            </span>
          </div>
          <p
            style={{
              fontSize: '11px',
              color: STUDIO_THEME.textSecondary,
            }}
          >
            How much your avatar rotates side to side
          </p>
        </div>
        
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={personality.sway}
          onChange={(e) => setSway(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: '8px',
            borderRadius: '4px',
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
            marginTop: '6px',
          }}
        >
          <span>Steady</span>
          <span>Gentle</span>
          <span>Animated</span>
        </div>

        {/* Visual Indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '16px',
            height: '40px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              backgroundColor: STUDIO_THEME.accent,
              animation: personality.sway > 0 
                ? `demo-sway ${3 - personality.sway}s ease-in-out infinite`
                : 'none',
              opacity: personality.sway > 0 ? 1 : 0.5,
            }}
          />
          <style>{`
            @keyframes demo-sway {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(-${personality.sway * 10}deg); }
              75% { transform: rotate(${personality.sway * 10}deg); }
            }
          `}</style>
        </div>
      </div>

      {/* Breathing Toggle */}
      <div>
        <div style={{ marginBottom: '12px' }}>
          <h4
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: STUDIO_THEME.textPrimary,
            }}
          >
            Breathing Effect
          </h4>
          <p
            style={{
              fontSize: '11px',
              color: STUDIO_THEME.textSecondary,
              marginTop: '4px',
            }}
          >
            Subtle pulsing scale animation
          </p>
        </div>
        
        <button
          onClick={() => setBreathing(!personality.breathing)}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: '8px',
            border: '2px solid',
            borderColor: personality.breathing 
              ? STUDIO_THEME.accent 
              : STUDIO_THEME.border,
            backgroundColor: personality.breathing 
              ? `${STUDIO_THEME.accent}15`
              : STUDIO_THEME.bg,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.15s ease',
          }}
        >
          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: personality.breathing 
                ? STUDIO_THEME.accent 
                : STUDIO_THEME.textPrimary,
            }}
          >
            {personality.breathing ? 'Enabled' : 'Disabled'}
          </span>
          
          <div
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '12px',
              backgroundColor: personality.breathing 
                ? STUDIO_THEME.accent 
                : STUDIO_THEME.border,
              position: 'relative',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: 'white',
                position: 'absolute',
                top: '2px',
                left: personality.breathing ? '22px' : '2px',
                transition: 'left 0.15s ease',
              }}
            />
          </div>
        </button>

        {/* Visual Indicator */}
        {personality.breathing && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: '16px',
              height: '40px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: STUDIO_THEME.accent,
                opacity: 0.7,
                animation: 'demo-breathe 4s ease-in-out infinite',
              }}
            />
            <style>{`
              @keyframes demo-breathe {
                0%, 100% { transform: scale(1); opacity: 0.7; }
                50% { transform: scale(1.1); opacity: 0.9; }
              }
            `}</style>
          </div>
        )}
      </div>

      {/* Preset Buttons */}
      <div
        style={{
          padding: '16px',
          backgroundColor: STUDIO_THEME.bg,
          borderRadius: '8px',
          border: `1px solid ${STUDIO_THEME.border}`,
        }}
      >
        <h4
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: STUDIO_THEME.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
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
          <button
            onClick={() => {
              setBounce(0.1);
              setSway(0.05);
              setBreathing(true);
            }}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: `1px solid ${STUDIO_THEME.border}`,
              backgroundColor: STUDIO_THEME.bgCard,
              color: STUDIO_THEME.textPrimary,
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            🤖 Robotic
            <span style={{ display: 'block', fontSize: '10px', color: STUDIO_THEME.textSecondary, marginTop: '2px' }}>
              Minimal movement
            </span>
          </button>
          
          <button
            onClick={() => {
              setBounce(0.3);
              setSway(0.15);
              setBreathing(true);
            }}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: `1px solid ${STUDIO_THEME.border}`,
              backgroundColor: STUDIO_THEME.bgCard,
              color: STUDIO_THEME.textPrimary,
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            😊 Natural
            <span style={{ display: 'block', fontSize: '10px', color: STUDIO_THEME.textSecondary, marginTop: '2px' }}>
              Balanced movement
            </span>
          </button>
          
          <button
            onClick={() => {
              setBounce(0.5);
              setSway(0.3);
              setBreathing(true);
            }}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: `1px solid ${STUDIO_THEME.border}`,
              backgroundColor: STUDIO_THEME.bgCard,
              color: STUDIO_THEME.textPrimary,
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            ⚡ Energetic
            <span style={{ display: 'block', fontSize: '10px', color: STUDIO_THEME.textSecondary, marginTop: '2px' }}>
              High movement
            </span>
          </button>
          
          <button
            onClick={() => {
              setBounce(0);
              setSway(0);
              setBreathing(false);
            }}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: `1px solid ${STUDIO_THEME.border}`,
              backgroundColor: STUDIO_THEME.bgCard,
              color: STUDIO_THEME.textPrimary,
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            ⏸️ Static
            <span style={{ display: 'block', fontSize: '10px', color: STUDIO_THEME.textSecondary, marginTop: '2px' }}>
              No animation
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

PersonalityCustomizationTab.displayName = 'PersonalityCustomizationTab';
