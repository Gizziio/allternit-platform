import React from 'react';
import { useMode } from '../providers/mode-provider';

const BACKGROUND_TREATMENT: 'classic' | 'sharp-v1' = 'sharp-v1';

export function WorkspaceBackground(): React.ReactNode {
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
          : mode === 'cowork'
          ? 'var(--view-cowork-bg)'
          : 'var(--shell-frame-bg)',
      }}
    >
      {/* Subtle grid texture for non-chat modes; kept neutral so the rail and view share the same tone */}
      {mode !== 'chat' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: mode === 'code' ? 0.12 : 0.2,
            backgroundImage: `
              linear-gradient(to right, color-mix(in srgb, var(--ui-border-muted) 30%, transparent) 1px, transparent 1px),
              linear-gradient(to bottom, color-mix(in srgb, var(--ui-border-muted) 24%, transparent) 1px, transparent 1px)
            `,
            backgroundSize: mode === 'code' ? '32px 32px' : '24px 24px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
          }}
        />
      )}

      {/* Very faint vignette to keep the canvas from feeling flat, using neutral shell tones */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle at center, transparent 0%, color-mix(in srgb, var(--shell-overlay-backdrop) 28%, transparent) 100%)
          `,
          opacity: 0.6,
        }}
      />
    </div>
  );
}
