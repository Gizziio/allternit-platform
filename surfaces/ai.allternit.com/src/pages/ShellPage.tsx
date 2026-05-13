"use client";

import { lazy, Suspense } from 'react';

const ShellApp = lazy(
  () => import('../shell/ShellApp').then((mod) => ({ default: mod.ShellApp }))
);

export default function ShellPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0F0C0A',
            color: 'var(--accent-primary)',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: '2px solid rgba(212, 176, 140, 0.2)',
              borderTopColor: 'var(--accent-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.05em' }}>
            Loading Allternit…
          </span>
        </div>
      }
    >
      <ShellApp />
    </Suspense>
  );
}
