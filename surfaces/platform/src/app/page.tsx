'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ShellApp to avoid SSR issues with browser APIs
const ShellApp = dynamic(
  () => import('../shell/ShellApp').then((mod) => mod.ShellApp),
  { 
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading Allternit Platform"
        className="w-screen h-dvh flex flex-col items-center justify-center gap-6"
        style={{ background: '#1A1612' }}
      >
        <div className="flex items-center gap-2 select-none">
          <span style={{ color: '#D97757', fontFamily: 'monospace', fontSize: 24, fontWeight: 400 }}>A://</span>
          <span style={{ color: '#ECECEC', fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400 }}>LLTERNIT</span>
        </div>
        <div
          className="w-40 h-px relative overflow-hidden"
          style={{ background: 'rgba(212,176,140,0.15)' }}
        >
          <div
            className="absolute inset-y-0 left-0 w-1/3"
            style={{
              background: 'linear-gradient(90deg, transparent, #D97757, transparent)',
              animation: 'shimmer 1.4s ease-in-out infinite',
            }}
          />
        </div>
        <style>{`@keyframes shimmer { 0% { transform: translateX(-200%) } 100% { transform: translateX(400%) } }`}</style>
      </div>
    ),
  }
);

export default function Home() {
  return <ShellApp />;
}
