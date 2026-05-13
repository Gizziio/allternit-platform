import React from 'react';
import { useMode } from '../providers/mode-provider';

const BACKGROUND_TREATMENT: 'classic' | 'sharp-v1' = 'sharp-v1';

export function WorkspaceBackground(): JSX.Element {
  const { mode } = useMode();

  if (BACKGROUND_TREATMENT === 'classic') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          transition: 'all 0.5s ease',
          background: 'var(--shell-frame-bg)',
        }}
      >
        {mode === 'cowork' && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                  radial-gradient(circle, color-mix(in srgb, var(--ui-text-primary) 10%, transparent) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
                backgroundPosition: 'center',
              }}
            />
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
              <defs>
                <pattern id="crosshair" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <line x1="18" y1="20" x2="22" y2="20" stroke="var(--ui-text-primary)" strokeWidth="1" />
                  <line x1="20" y1="18" x2="20" y2="22" stroke="var(--ui-text-primary)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#crosshair)" />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at center, color-mix(in srgb, var(--accent-chat) 6%, transparent) 0%, transparent 80%)',
              }}
            />
          </>
        )}

        {mode === 'code' && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `radial-gradient(color-mix(in srgb, var(--ui-text-primary) 10%, transparent) 1.5px, transparent 1.5px)`,
                backgroundSize: '32px 32px',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                  linear-gradient(to right, color-mix(in srgb, var(--ui-text-primary) 3%, transparent) 1px, transparent 1px),
                  linear-gradient(to bottom, color-mix(in srgb, var(--ui-text-primary) 3%, transparent) 1px, transparent 1px)
                `,
                backgroundSize: '128px 128px',
              }}
            />
          </>
        )}

        {mode === 'chat' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at center, color-mix(in srgb, var(--accent-chat) 6%, transparent) 0%, transparent 80%)',
            }}
          />
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at center, transparent 0%, color-mix(in srgb, var(--shell-overlay-backdrop) 52%, transparent) 100%)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        transition: 'all 0.5s ease',
        background: mode === 'code'
          ? 'var(--view-code-bg)'
          : mode === 'chat'
          ? 'var(--view-chat-bg)'
          : mode === 'browser'
          ? 'var(--view-browser-bg)'
          : 'var(--shell-frame-bg)',
      }}
    >
      {mode !== 'code' && mode !== 'chat' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--surface-floating) 52%, transparent) 0%, transparent 58%),
              linear-gradient(180deg, color-mix(in srgb, var(--surface-panel) 38%, transparent) 0%, transparent 32%, color-mix(in srgb, var(--surface-overlay) 24%, transparent) 100%)
            `,
          }}
        />
      )}

      {mode !== 'chat' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: mode === 'code' ? 0.18 : 0.32,
            backgroundImage: `
              linear-gradient(to right, color-mix(in srgb, var(--ui-border-muted) 38%, transparent) 1px, transparent 1px),
              linear-gradient(to bottom, color-mix(in srgb, var(--ui-border-muted) 32%, transparent) 1px, transparent 1px)
            `,
            backgroundSize: mode === 'code' ? '32px 32px' : '24px 24px',
            maskImage: mode === 'code'
              ? 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)'
              : 'linear-gradient(180deg, rgba(0,0,0,0.9), var(--surface-panel) 55%, transparent 100%)',
          }}
        />
      )}

      {mode !== 'code' && mode !== 'chat' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.08,
            backgroundImage: 'radial-gradient(color-mix(in srgb, var(--ui-text-primary) 90%, transparent) 0.7px, transparent 0.7px)',
            backgroundSize: '8px 8px',
            mixBlendMode: 'multiply',
          }}
        />
      )}

      {mode === 'cowork' && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                radial-gradient(circle, color-mix(in srgb, var(--accent-cowork) 18%, transparent) 1px, transparent 1px)
              `,
              backgroundSize: '36px 36px',
              backgroundPosition: 'center',
              opacity: 0.6,
            }}
          />
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.16 }}>
            <defs>
              <pattern id="crosshair" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <line x1="17" y1="20" x2="23" y2="20" stroke="var(--accent-cowork)" strokeWidth="1" />
                <line x1="20" y1="17" x2="20" y2="23" stroke="var(--accent-cowork)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#crosshair)" />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `
                radial-gradient(70% 60% at 50% 35%, color-mix(in srgb, var(--accent-cowork) 12%, transparent) 0%, transparent 75%),
                linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--accent-cowork) 6%, transparent) 100%)
              `,
            }}
          />
        </>
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--surface-floating) 70%, transparent)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle at center, transparent 0%, color-mix(in srgb, var(--shell-overlay-backdrop) 52%, transparent) 100%),
            linear-gradient(180deg, color-mix(in srgb, var(--surface-overlay) 10%, transparent) 0%, transparent 18%, color-mix(in srgb, var(--shell-overlay-backdrop) 14%, transparent) 100%)
          `,
        }}
      />

      <style>{`
        @keyframes topoPulse {
          0% { transform: scale(1) translate(0, 0); opacity: 0.5; }
          100% { transform: scale(1.2) translate(2%, 2%); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
