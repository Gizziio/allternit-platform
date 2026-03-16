import React from 'react';
import { useMode } from '../providers/mode-provider';

export function WorkspaceBackground() {
  const { mode } = useMode();

  return (
    <div 
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        transition: 'all 0.5s ease',
        background: '#161616',
      }}
    >
      {/* Cowork Mode: Precision Crosshair Field */}
      {mode === 'cowork' && (
        <>
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
              backgroundPosition: 'center',
            }}
          />
          {/* Subtle Nodal Crosses via SVG Pattern */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
            <defs>
              <pattern id="crosshair" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <line x1="18" y1="20" x2="22" y2="20" stroke="white" strokeWidth="1" />
                <line x1="20" y1="18" x2="20" y2="22" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#crosshair)" />
          </svg>
          
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at center, rgba(217, 119, 87, 0.02) 0%, transparent 80%)',
            }}
          />
        </>
      )}

      {/* Code Mode: Nodal Schematic (Circuitry) */}
      {mode === 'code' && (
        <>
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `radial-gradient(rgba(255,255,255,0.05) 1.5px, transparent 1.5px)`,
              backgroundSize: '32px 32px',
            }}
          />
          {/* Faint Circuit Traces (Horizontal/Vertical) */}
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.01) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.01) 1px, transparent 1px)
              `,
              backgroundSize: '128px 128px',
            }}
          />
        </>
      )}

      {/* Chat Mode: Deep Core (Subtle) */}
      {mode === 'chat' && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at center, rgba(217, 119, 87, 0.02) 0%, transparent 80%)',
          }}
        />
      )}

      {/* Global Vignette & Noise */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes topoPulse {
          0% { transform: scale(1) translate(0, 0); opacity: 0.5; }
          100% { transform: scale(1.2) translate(2%, 2%); opacity: 0.8; }
        }
      `}} />
    </div>
  );
}
