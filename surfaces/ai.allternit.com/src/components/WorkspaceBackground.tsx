import React from 'react';
import { useMode } from '../providers/mode-provider';

const BACKGROUND_TREATMENT: 'classic' | 'sharp-v1' = 'sharp-v1';

export function WorkspaceBackground() {
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
        background: 'var(--shell-frame-bg)',
      }}
    >
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

      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.32,
          backgroundImage: `
            linear-gradient(to right, color-mix(in srgb, var(--ui-border-muted) 38%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in srgb, var(--ui-border-muted) 32%, transparent) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), var(--surface-panel) 55%, transparent 100%)',
        }}
      />

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

      {mode === 'code' && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(to right, color-mix(in srgb, var(--accent-code) 18%, transparent) 1px, transparent 1px),
                linear-gradient(to bottom, color-mix(in srgb, var(--accent-code) 14%, transparent) 1px, transparent 1px)
              `,
              backgroundSize: '72px 72px',
              opacity: 0.55,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                radial-gradient(circle, color-mix(in srgb, var(--accent-code) 34%, transparent) 1.2px, transparent 1.2px)
              `,
              backgroundSize: '72px 72px',
              backgroundPosition: '36px 36px',
              opacity: 0.42,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `
                radial-gradient(80% 65% at 50% 22%, color-mix(in srgb, var(--accent-code) 12%, transparent) 0%, transparent 72%),
                linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 12%, transparent) 0%, transparent 26%)
              `,
            }}
          />
        </>
      )}

      {mode === 'chat' && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `
                radial-gradient(72% 62% at 50% 28%, color-mix(in srgb, var(--accent-chat) 12%, transparent) 0%, transparent 72%),
                radial-gradient(42% 36% at 50% 18%, color-mix(in srgb, var(--accent-primary) 14%, transparent) 0%, transparent 70%)
              `,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.2,
              backgroundImage: `
                linear-gradient(to right, color-mix(in srgb, var(--accent-chat) 8%, transparent) 1px, transparent 1px),
                linear-gradient(to bottom, color-mix(in srgb, var(--accent-chat) 6%, transparent) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(70% 60% at 50% 35%, rgba(0,0,0,0.92), transparent 82%)',
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
