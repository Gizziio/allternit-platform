'use client';

import React, { lazy, Suspense } from 'react';
import { AProtocolWordmark } from '../components/AProtocolWordmark';

function AppLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading Allternit Platform"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1A1612',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '28px',
      }}
    >
      {/* Wordmark */}
      <AProtocolWordmark theme="light" height={22} />

      {/* Progress shimmer */}
      <div style={{ width: '120px', height: '1px', background: 'rgba(200,168,140,0.12)', position: 'relative', overflow: 'hidden', borderRadius: '1px' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '40%',
            background: 'linear-gradient(90deg, transparent 0%, #D97757 50%, transparent 100%)',
            animation: 'an-shimmer 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes an-shimmer {
          0%   { transform: translateX(-200%) }
          100% { transform: translateX(350%) }
        }
      `}</style>
    </div>
  );
}

// Dynamically import ShellApp to avoid SSR issues with browser APIs
const ShellApp = lazy(
  () => import('../shell/ShellApp').then((mod) => ({ default: mod.ShellApp }))
);

export default function Home() {
  return (
    <Suspense fallback={<AppLoader />}>
      <ShellApp />
    </Suspense>
  );
}
// Trigger rebuild
