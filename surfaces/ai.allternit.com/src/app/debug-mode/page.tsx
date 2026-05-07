'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Dev-only page: marks onboarding complete so the shell renders without going through the flow. */
export default function DebugModePage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem('allternit-onboarding-storage', JSON.stringify({
      state: {
        hasCompletedOnboarding: true,
        preferences: { defaultProvider: 'claude' },
      },
      version: 0,
    }));
    router.push('/');
  }, [router]);

  return (
    <div style={{ background: '#0a0908', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)' }}>
      Loading shell…
    </div>
  );
}
