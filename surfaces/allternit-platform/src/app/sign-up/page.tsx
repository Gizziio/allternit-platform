'use client';

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { PlatformSignUp } from "@/lib/platform-auth-client"
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo"
import { AuthPreview } from "@/components/auth/AuthPreview"
import { SiteFooter } from "@/components/auth/SiteFooter"

function SignUpContent() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow
    const prevBodyOverflowY = document.body.style.overflowY
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevHtmlOverflowY = document.documentElement.style.overflowY

    document.body.style.overflow = "auto"
    document.body.style.overflowY = "auto"
    document.documentElement.style.overflow = "auto"
    document.documentElement.style.overflowY = "auto"

    return () => {
      document.body.style.overflow = prevBodyOverflow
      document.body.style.overflowY = prevBodyOverflowY
      document.documentElement.style.overflow = prevHtmlOverflow
      document.documentElement.style.overflowY = prevHtmlOverflowY
    }
  }, [])

  const requestedRedirect = searchParams.get("redirect_url")
  const redirectUrl =
    requestedRedirect && requestedRedirect.startsWith("/")
      ? requestedRedirect
      : "/shell"
  const signInUrl = requestedRedirect
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
    : "/sign-in"

  return (
    <>
      <style>{`
        .signup-page {
          min-height: 100vh;
          background: #0F0C0A;
          display: flex;
          flex-direction: column;
          font-family: inherit;
          overflow-y: auto;
        }
        .signup-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--surface-hover);
          flex-shrink: 0;
        }
        .signup-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .signup-logo-text {
          font-size: 15px;
          font-weight: 700;
          color: #ECECEC;
          letter-spacing: -0.02em;
        }
        .signup-nav-link {
          font-size: 13px;
          color: #664E3A;
          text-decoration: none;
          font-weight: 500;
        }
        .signup-nav-link span { color: #D97757; }
        .signup-main {
          flex: 1;
          display: flex;
          align-items: stretch;
          padding: 32px 24px 40px;
          gap: 48px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .signup-preview-col {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
        }
        .signup-form-col {
          flex: 0 0 420px;
          min-width: 0;
        }
        .signup-heading {
          font-size: 48px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.05;
          color: #F5EDE3;
          margin-bottom: 14px;
          margin-top: 0;
        }
        .signup-sub {
          font-size: 15px;
          line-height: 1.65;
          color: #664E3A;
          margin-bottom: 28px;
          max-width: 340px;
        }
        .signup-card {
          background: #1A1410;
          border-radius: 20px;
          border: 1px solid var(--ui-border-muted);
          padding: 28px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          overflow: hidden;
        }
        .signup-legal {
          font-size: 11px;
          color: #3A2A1E;
          text-align: center;
          margin-top: 14px;
          line-height: 1.6;
        }
        .signup-legal a { color: #664E3A; text-decoration: underline; }
        .signup-also { margin-top: 24px; }
        .signup-also-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .signup-also-line { flex: 1; height: 1px; background: var(--surface-hover); }
        .signup-also-label {
          font-size: 10px;
          color: #3A2A1E;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .signup-pills { display: flex; gap: 10px; }
        .signup-pill {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 14px;
          border-radius: 12px;
          text-decoration: none;
          background: #1A1410;
          border: 1px solid var(--ui-border-muted);
          min-width: 0;
        }
        .signup-pill-title {
          font-size: 11px;
          font-weight: 600;
          color: #C4A78A;
          line-height: 1.2;
          white-space: nowrap;
        }
        .signup-pill-sub {
          font-size: 10px;
          color: #4A3020;
          margin-top: 1px;
          white-space: nowrap;
        }

        /* Tablet/mobile: stack preview above form */
        @media (max-width: 900px) {
          .signup-main { flex-direction: column; align-items: center; padding: 24px 20px 40px; gap: 32px; }
          .signup-preview-col { display: flex; width: 100%; max-width: 580px; }
          .signup-form-col { flex: 1 1 auto; width: 100%; max-width: 580px; }
        }

        @media (max-width: 600px) {
          .signup-main { padding: 20px 16px 32px; }
          .signup-heading { font-size: 36px; }
          .signup-card { padding: 20px; border-radius: 16px; }
          .signup-pills { flex-direction: column; }
          .signup-pill-title, .signup-pill-sub { white-space: normal; }
          .signup-nav { padding: 14px 16px; }
        }
      `}</style>

      <div className="signup-page">
        {/* Nav */}
        <nav className="signup-nav">
          <a href="/" className="signup-logo">
            <MatrixLogo state="idle" size={28} />
            <span className="signup-logo-text">Allternit</span>
          </a>
          <a href="/sign-in" className="signup-nav-link">
            Already have an account? <span>Sign in</span>
          </a>
        </nav>

        {/* Main */}
        <div className="signup-main">
          {/* Left — animated preview (stacks above form on mobile) */}
          <div className="signup-preview-col">
            <AuthPreview />
          </div>

          {/* Right — headline + form */}
          <div className="signup-form-col">
            <h1 className="signup-heading">
              Any model.<br />
              Any agent.<br />
              <span style={{ color: '#D97757' }}>All yours.</span>
            </h1>

            <p className="signup-sub">
              One platform for every AI model, agent, and tool — running on infrastructure you own.
            </p>

            {/* Form card */}
            <div className="signup-card">
              <PlatformSignUp
                forceRedirectUrl={redirectUrl}
                signInForceRedirectUrl={redirectUrl}
                signInUrl={signInUrl}
              />
            </div>

            <p className="signup-legal">
              By continuing you agree to the{' '}
              <a href="/terms">Terms</a>
              {' '}and{' '}
              <a href="/privacy">Privacy Policy</a>.
            </p>

            {/* Platform availability */}
            <div className="signup-also">
              <div className="signup-also-divider">
                <div className="signup-also-line" />
                <span className="signup-also-label">Also available on</span>
                <div className="signup-also-line" />
              </div>
              <div className="signup-pills">
                {/* Chrome Extension */}
                <a
                  href="https://github.com/allternit/chrome-extension/releases"
                  className="signup-pill"
                  target="_blank"
                  rel="noreferrer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" fill="#4285F4"/>
                    <circle cx="12" cy="12" r="4" fill="white"/>
                    <path d="M12 8h8.66A10 10 0 0 0 3.34 8z" fill="#EA4335"/>
                    <path d="M8 12 3.34 8A10 10 0 0 0 12 22z" fill="#34A853"/>
                    <path d="M16 12l4.66-4A10 10 0 0 1 12 22z" fill="#FBBC05"/>
                  </svg>
                  <div style={{ minWidth: 0 }}>
                    <div className="signup-pill-title">Chrome Extension</div>
                    <div className="signup-pill-sub">Allternit in your browser</div>
                  </div>
                </a>

                {/* Desktop App */}
                <a href="https://allternit.com/#/download" className="signup-pill">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <rect x="3" y="3" width="18" height="13" rx="2" stroke="#C4A78A" strokeWidth="1.5" fill="none"/>
                    <path d="M8 20h8M12 16v4" stroke="#C4A78A" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <div style={{ minWidth: 0 }}>
                    <div className="signup-pill-title">Desktop App</div>
                    <div className="signup-pill-sub">Mac, Windows &amp; Linux</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>

        <SiteFooter />
      </div>
    </>
  )
}

export default function SignUpClient() {
  return (
    <Suspense fallback={null}>
      <SignUpContent />
    </Suspense>
  )
}
