/**
 * Next.js 404 Not Found Page
 * Displayed when a route doesn't exist
 */

import Link from 'next/link';

export default function NotFound() {
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
          background: 'rgba(212,176,140,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        <span
          style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#d4b08c',
          }}
        >
          404
        </span>
      </div>

      <h1
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#fff',
          margin: '0 0 8px 0',
        }}
      >
        Page Not Found
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
        The page you're looking for doesn't exist or has been moved.
      </p>

      <Link
        href="/"
        style={{
          padding: '12px 24px',
          borderRadius: '8px',
          border: 'none',
          background: '#d4b08c',
          color: '#1a1a1a',
          fontSize: '14px',
          fontWeight: 500,
          textDecoration: 'none',
          cursor: 'pointer',
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
