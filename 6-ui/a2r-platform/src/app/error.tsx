'use client';

/**
 * Next.js Error Page
 * Catches errors in route segments and displays user-friendly error UI
 */

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Next.js Error] Route error:', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '40px',
        textAlign: 'center',
        background: '#0f0f0f',
      }}
    >
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>

      <h1
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#fff',
          margin: '0 0 8px 0',
        }}
      >
        Something went wrong
      </h1>

      <p
        style={{
          fontSize: '14px',
          color: 'rgba(255,255,255,0.5)',
          margin: '0 0 24px 0',
          maxWidth: '400px',
          lineHeight: 1.5,
        }}
      >
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>

      {error.digest && (
        <p
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.3)',
            margin: '0 0 24px 0',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          Error ID: {error.digest}
        </p>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={reset}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: '#d4b08c',
            color: '#1a1a1a',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Try Again
        </button>

        <a
          href="/"
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent',
            color: '#fff',
            fontSize: '14px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
