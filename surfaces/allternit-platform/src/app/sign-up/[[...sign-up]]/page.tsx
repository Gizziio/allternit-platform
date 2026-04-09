export async function generateStaticParams() {
  return []
}

'use client';

import { PlatformSignUp } from "@/lib/platform-auth-client"
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo"
import { AuthPreview } from "@/components/auth/AuthPreview"
import { SiteFooter } from "@/components/auth/SiteFooter"

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F0C0A',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'inherit',
      overflowY: 'auto',
    }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <MatrixLogo state="idle" size={32} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#ECECEC', letterSpacing: '-0.02em' }}>Allternit</span>
        </a>
        <a href="/sign-in" style={{ fontSize: 13, color: '#664E3A', textDecoration: 'none', fontWeight: 500 }}>
          Already have an account? <span style={{ color: '#D97757' }}>Sign in</span>
        </a>
      </nav>

      {/* Main */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        padding: '40px',
        gap: 60,
        maxWidth: 1280,
        margin: '0 auto',
        width: '100%',
      }}>
        {/* Left — animated preview */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 20 }}>
          <AuthPreview />
        </div>

        {/* Right — headline + form */}
        <div style={{ flex: '0 0 420px' }}>
          <h1 style={{
            fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em',
            lineHeight: 1.05, color: '#F5EDE3', marginBottom: 16,
          }}>
            Any model.<br />
            Any agent.<br />
            <span style={{ color: '#D97757' }}>All yours.</span>
          </h1>

          <p style={{ fontSize: 15, lineHeight: 1.65, color: '#664E3A', marginBottom: 36, maxWidth: 340 }}>
            One platform for every AI model, agent, and tool — running on infrastructure you own.
          </p>

          {/* Form card */}
          <div style={{
            background: '#1A1410',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.07)',
            padding: '28px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <PlatformSignUp forceRedirectUrl="/shell" signInForceRedirectUrl="/shell" />
          </div>

          <p style={{ fontSize: 11, color: '#3A2A1E', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
            By continuing you agree to the{' '}
            <a href="/terms" style={{ color: '#664E3A', textDecoration: 'underline' }}>Terms</a>
            {' '}and{' '}
            <a href="/privacy" style={{ color: '#664E3A', textDecoration: 'underline' }}>Privacy Policy</a>.
          </p>

          {/* Platform availability */}
          <div style={{ marginTop: 28 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
              <span style={{ fontSize: 10, color: '#3A2A1E', letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Also available on
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {/* Chrome Extension */}
              <a
                href="#"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 12, textDecoration: 'none',
                  background: '#1A1410', border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#4285F4"/>
                  <circle cx="12" cy="12" r="4" fill="white"/>
                  <path d="M12 8h8.66A10 10 0 0 0 3.34 8z" fill="#EA4335"/>
                  <path d="M8 12 3.34 8A10 10 0 0 0 12 22z" fill="#34A853"/>
                  <path d="M16 12l4.66-4A10 10 0 0 1 12 22z" fill="#FBBC05"/>
                </svg>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#C4A78A', lineHeight: 1.2 }}>Chrome Extension</div>
                  <div style={{ fontSize: 10, color: '#4A3020', marginTop: 1 }}>Allternit in your browser</div>
                </div>
              </a>

              {/* Microsoft Add-ins */}
              <a
                href="#"
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 12, textDecoration: 'none',
                  background: '#1A1410', border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="2" width="9" height="9" fill="#F25022"/>
                  <rect x="13" y="2" width="9" height="9" fill="#7FBA00"/>
                  <rect x="2" y="13" width="9" height="9" fill="#00A4EF"/>
                  <rect x="13" y="13" width="9" height="9" fill="#FFB900"/>
                </svg>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#C4A78A', lineHeight: 1.2 }}>Microsoft Add-ins</div>
                  <div style={{ fontSize: 10, color: '#4A3020', marginTop: 1 }}>Word, Outlook &amp; Teams</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
