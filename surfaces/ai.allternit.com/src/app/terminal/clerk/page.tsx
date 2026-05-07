"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo"
import { AuthPreview } from "@/components/auth/AuthPreview"
import { SiteFooter } from "@/components/auth/SiteFooter"
import { PlatformSignIn, usePlatformAuth } from "@/lib/platform-auth-client"

function TerminalClerkContent() {
  const searchParams = useSearchParams()
  const { isLoaded, isSignedIn, getToken } = usePlatformAuth()
  const [status, setStatus] = useState<"idle" | "connecting" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const posted = useRef(false)
  const signUpUrl = "/sign-up?redirect_url=%2Fterminal%2Fclerk"

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

  useEffect(() => {
    const callbackUrl = searchParams.get("callback_url")
    if (callbackUrl) {
      sessionStorage.setItem("allternit_callback_url", callbackUrl)
    }
  }, [searchParams])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || posted.current) return
    const callbackUrl = sessionStorage.getItem("allternit_callback_url")
    if (!callbackUrl) return

    posted.current = true
    setStatus("connecting")

    getToken()
      .then((token) => {
        if (!token) throw new Error("No token from Clerk")
        return fetch(callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
      })
      .then((response) => {
        if (!response.ok) throw new Error(`Callback error (${response.status})`)
        sessionStorage.removeItem("allternit_callback_url")
        setStatus("done")
        setTimeout(() => window.close(), 1800)
      })
      .catch((error: Error) => {
        setErrorMsg(error.message)
        setStatus("error")
      })
  }, [getToken, isLoaded, isSignedIn])

  const callbackUrl = searchParams.get("callback_url")
  const hasDesktopCallback = Boolean(callbackUrl || sessionStorage.getItem("allternit_callback_url"))

  return (
    <>
      <style>{`
        .terminal-auth-page {
          min-height: 100vh;
          background: #0F0C0A;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        .terminal-auth-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--surface-hover);
          flex-shrink: 0;
        }
        .terminal-auth-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .terminal-auth-logo-text {
          font-size: 15px;
          font-weight: 700;
          color: #ECECEC;
          letter-spacing: -0.02em;
        }
        .terminal-auth-nav-link {
          font-size: 13px;
          color: #664E3A;
          text-decoration: none;
          font-weight: 500;
        }
        .terminal-auth-nav-link span {
          color: #D97757;
        }
        .terminal-auth-main {
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
        .terminal-auth-preview-col {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
        }
        .terminal-auth-form-col {
          flex: 0 0 420px;
          min-width: 0;
        }
        .terminal-auth-kicker {
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8E6B57;
          margin-bottom: 14px;
          font-weight: 700;
        }
        .terminal-auth-heading {
          font-size: 48px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.05;
          color: #F5EDE3;
          margin: 0 0 14px;
        }
        .terminal-auth-heading span {
          color: #D97757;
        }
        .terminal-auth-sub {
          font-size: 15px;
          line-height: 1.68;
          color: #8B6F5F;
          margin: 0 0 28px;
          max-width: 360px;
        }
        .terminal-auth-card {
          background: #1A1410;
          border-radius: 20px;
          border: 1px solid var(--ui-border-muted);
          padding: 28px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          overflow: hidden;
        }
        .terminal-auth-status {
          display: flex;
          flex-direction: column;
          gap: 12px;
          text-align: left;
        }
        .terminal-auth-status-title {
          font-size: 24px;
          font-weight: 700;
          color: #F5EDE3;
          margin: 0;
        }
        .terminal-auth-status-copy {
          font-size: 14px;
          line-height: 1.7;
          color: #A98A75;
          margin: 0;
        }
        .terminal-auth-status-note {
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(217,119,87,0.08);
          border: 1px solid rgba(217,119,87,0.18);
          color: #D6C2B1;
          font-size: 12px;
          line-height: 1.6;
        }
        .terminal-auth-legal {
          font-size: 11px;
          color: #3A2A1E;
          text-align: center;
          margin-top: 14px;
          line-height: 1.6;
        }
        .terminal-auth-legal a {
          color: #664E3A;
          text-decoration: underline;
        }
        /* Tablet/mobile: stack preview above form */
        @media (max-width: 900px) {
          .terminal-auth-main { flex-direction: column; align-items: center; padding: 24px 20px 40px; gap: 32px; }
          .terminal-auth-preview-col { display: flex; width: 100%; max-width: 580px; }
          .terminal-auth-form-col { flex: 1 1 auto; width: 100%; max-width: 580px; }
        }
        @media (max-width: 600px) {
          .terminal-auth-main { padding: 20px 16px 32px; }
          .terminal-auth-heading { font-size: 36px; }
          .terminal-auth-card { padding: 20px; border-radius: 16px; }
          .terminal-auth-nav { padding: 14px 16px; }
        }
      `}</style>

      <div className="terminal-auth-page">
        <nav className="terminal-auth-nav">
          <a href="/" className="terminal-auth-logo">
            <MatrixLogo state="idle" size={28} />
            <span className="terminal-auth-logo-text">Allternit</span>
          </a>
          <a href="/sign-in" className="terminal-auth-nav-link">
            Standard account access <span>Sign in</span>
          </a>
        </nav>

        <div className="terminal-auth-main">
          <div className="terminal-auth-preview-col">
            <AuthPreview />
          </div>

          <div className="terminal-auth-form-col">
            <div className="terminal-auth-kicker">Desktop Connection</div>
            <h1 className="terminal-auth-heading">
              Connect Gizzi to your
              <br />
              <span>Allternit account.</span>
            </h1>
            <p className="terminal-auth-sub">
              Use the same branded Allternit sign-in flow to authorize the desktop shell, then we
              will return the session to Gizzi automatically.
            </p>

            <div className="terminal-auth-card">
              {status === "done" ? (
                <div className="terminal-auth-status">
                  <h2 className="terminal-auth-status-title">Connected.</h2>
                  <p className="terminal-auth-status-copy">
                    Gizzi is linked to your account. This window can close now.
                  </p>
                </div>
              ) : status === "error" ? (
                <div className="terminal-auth-status">
                  <h2 className="terminal-auth-status-title">Connection failed.</h2>
                  <p className="terminal-auth-status-copy">{errorMsg}</p>
                  <div className="terminal-auth-status-note">
                    The desktop callback did not complete. Try again from the Gizzi desktop flow.
                  </div>
                </div>
              ) : status === "connecting" || (isLoaded && isSignedIn) ? (
                <div className="terminal-auth-status">
                  <h2 className="terminal-auth-status-title">Finalizing secure handoff.</h2>
                  <p className="terminal-auth-status-copy">
                    We are sending your verified session back to the desktop app now.
                  </p>
                  <div className="terminal-auth-status-note">
                    Keep this window open for a moment while Gizzi completes the connection.
                  </div>
                </div>
              ) : (
                <div className="terminal-auth-status">
                  <div className="terminal-auth-status-note">
                    {hasDesktopCallback
                      ? "Desktop callback detected. After sign-in, this window will return control to Gizzi automatically."
                      : "Open this route from the Gizzi desktop connect flow so the callback can be completed after sign-in."}
                  </div>
                  <PlatformSignIn
                    forceRedirectUrl="/terminal/clerk"
                    signUpForceRedirectUrl="/terminal/clerk"
                    signUpUrl={signUpUrl}
                  />
                </div>
              )}
            </div>

            <p className="terminal-auth-legal">
              By continuing you agree to the <a href="/terms">Terms</a> and{" "}
              <a href="/privacy">Privacy Policy</a>.
            </p>
          </div>
        </div>

        <SiteFooter />
      </div>
    </>
  )
}

export default function TerminalClerkPage() {
  return (
    <Suspense fallback={null}>
      <TerminalClerkContent />
    </Suspense>
  )
}
