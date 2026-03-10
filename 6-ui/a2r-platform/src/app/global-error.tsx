'use client';

/**
 * Next.js Global Error Page
 * Catches critical errors that escape all other boundaries
 * This renders outside the root layout, so it must include <html> and <body>
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Next.js Global Error] Critical error:', error);
    // Could send to error tracking service here
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '40px',
            textAlign: 'center',
            background: '#0a0a0a',
          }}
        >
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '32px',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>

          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#fff',
              margin: '0 0 12px 0',
            }}
          >
            Critical Error
          </h1>

          <p
            style={{
              fontSize: '16px',
              color: 'rgba(255,255,255,0.5)',
              margin: '0 0 32px 0',
              maxWidth: '500px',
              lineHeight: 1.6,
            }}
          >
            A critical error has occurred and the application cannot continue.
            {error.message && ` (${error.message})`}
          </p>

          {error.digest && (
            <div
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '32px',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.4)',
                  margin: 0,
                  fontFamily: 'ui-monospace, monospace',
                }}
              >
                Error ID: {error.digest}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                padding: '14px 28px',
                borderRadius: '8px',
                border: 'none',
                background: '#d4b08c',
                color: '#1a1a1a',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.2s, opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.opacity = '1';
              }}
            >
              Try to Recover
            </button>

            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '14px 28px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#fff',
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Reload Application
            </button>
          </div>

          <p
            style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.3)',
              marginTop: '48px',
            }}
          >
            If this error persists, please contact support.
          </p>
        </div>
      </body>
    </html>
  );
}
