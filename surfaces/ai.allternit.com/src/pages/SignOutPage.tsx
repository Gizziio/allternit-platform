'use client';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatformSignOut } from '@/lib/platform-auth-client';
import { AProtocolWordmark } from '@/components/AProtocolWordmark';

export default function SignOutPage(): React.ReactNode {
  const navigate = useNavigate();
  const signOut = usePlatformSignOut();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await signOut();
      } catch {
        // Proceed to home regardless so the user is not stuck.
      }
      if (!cancelled) {
        navigate('/', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signOut, navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAF9F7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
      }}
    >
      <AProtocolWordmark theme="adaptive" height={22} />
      <div
        style={{
          width: '120px',
          height: '2px',
          background: '#E7E4DF',
          borderRadius: '1px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#9A7658',
            animation: 'an-signout-shimmer 1.4s infinite ease-in-out',
          }}
        />
      </div>
      <p style={{ fontSize: '14px', color: '#74716B', margin: 0 }}>Signing you out…</p>
      <style>{`
        @keyframes an-signout-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
