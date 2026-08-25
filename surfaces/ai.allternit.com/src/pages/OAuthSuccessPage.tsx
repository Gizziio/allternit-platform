// @ts-nocheck
'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// Light-mode Allternit brand palette (matches allternit.com)
const COLORS = {
  bg: '#faf9f7',
  panel: '#fffefc',
  border: '#e1e5eb',
  text: '#1a1916',
  textStrong: '#0d0c0a',
  muted: '#74716b',
  soft: '#989590',
  faint: '#b3b0a8',
  accent: '#B08D6E',
  accentStrong: '#9A7658',
  success: '#1f7a3a',
  successSoft: '#e8f7ee',
  white: '#fffefc',
};

function SuccessContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [launchAttempted, setLaunchAttempted] = useState(false);
  const protocolLinkRef = useRef<HTMLAnchorElement | null>(null);

  const appName = searchParams.get('app') ?? 'The application';
  const redirectUri = searchParams.get('redirect_uri');
  const isLocalRedirect =
    redirectUri?.startsWith('/') ||
    redirectUri?.startsWith('http://localhost') ||
    redirectUri?.startsWith('allternit://') ||
    redirectUri?.startsWith('gizzi://');
  const isProtocolRedirect =
    redirectUri?.startsWith('allternit://') ||
    redirectUri?.startsWith('gizzi://');

  // For protocol/deep-link redirects we hand control back to the desktop app
  // immediately instead of making the user wait in the browser.
  const initialCountdown = isProtocolRedirect ? 0 : 5;

  function launchRedirect(target: string) {
    if (target.startsWith('allternit://') || target.startsWith('gizzi://')) {
      setLaunchAttempted(true);
      protocolLinkRef.current?.click();
      window.location.assign(target);
      return;
    }

    navigate(target);
  }

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setCountdown(initialCountdown);
  }, [initialCountdown]);

  // Auto-redirect countdown for local/desktop app redirects
  useEffect(() => {
    if (!isLocalRedirect || !redirectUri) return;
    if (countdown <= 0) {
      launchRedirect(redirectUri);
      return;
    }
    const interval = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(interval);
  }, [countdown, isLocalRedirect, redirectUri, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'inherit',
      padding: '24px 16px',
    }}>
      {/* Ambient glow — accent tint on success */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 400,
        background: 'radial-gradient(ellipse, rgba(176,141,110,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%',
            maxWidth: 420,
            background: COLORS.panel,
            borderRadius: 20,
            border: `1px solid ${COLORS.border}`,
            boxShadow: '0 32px 80px rgba(28,27,26,0.10), 0 0 0 1px rgba(0,0,0,0.02)',
            overflow: 'hidden',
            textAlign: 'center',
          }}
        >
          <div style={{ padding: '48px 36px 40px' }}>

            {/* Success ring + logo */}
            <div style={{ position: 'relative', display: 'inline-flex', marginBottom: 28 }}>
              {/* Pulsing ring */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'absolute', inset: -14,
                  borderRadius: '50%',
                  border: `1.5px solid rgba(31,122,58,0.25)`,
                }}
              />
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.15, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute', inset: -22,
                  borderRadius: '50%',
                  border: `1px solid rgba(31,122,58,0.12)`,
                }}
              />
              <img src="/brand/matrix/matrix-logo.svg" alt="Allternit" style={{ width: 52, height: 52 }} />

              {/* Checkmark badge */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 18 }}
                style={{
                  position: 'absolute',
                  bottom: -4, right: -4,
                  width: 22, height: 22,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #34d399, #10b981)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.div>
            </div>

            {/* Text */}
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: COLORS.textStrong,
                letterSpacing: '-0.03em',
                marginBottom: 10,
              }}
            >
              Authorization successful
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.44, duration: 0.4 }}
              style={{
                fontSize: 14,
                color: COLORS.muted,
                lineHeight: 1.6,
                marginBottom: 0,
                maxWidth: 300,
                margin: '0 auto',
              }}
            >
              <strong style={{ color: COLORS.text, fontWeight: 600 }}>{appName}</strong>
              {' '}now has access to your Allternit account.
            </motion.p>

            {/* Auto-redirect notice for CLI/desktop */}
            {isLocalRedirect && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.4 }}
                style={{
                  fontSize: 13,
                  color: COLORS.soft,
                  marginTop: 20,
                }}
              >
                {isProtocolRedirect && launchAttempted
                  ? 'If Allternit did not open automatically, use the button below.'
                  : isProtocolRedirect
                    ? 'Opening Allternit…'
                    : `Redirecting in ${countdown}s…`}
              </motion.p>
            )}

            {/* Divider */}
            <div style={{ height: 1, background: COLORS.border, margin: '28px 0 24px' }} />

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.35 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {/* If it's a web redirect, show a "Go to app" button */}
              {redirectUri && !isLocalRedirect && (
                <a
                  href={redirectUri}
                  style={{
                    display: 'block',
                    padding: '13px 20px',
                    borderRadius: 12,
                    background: COLORS.text,
                    color: COLORS.white,
                    fontSize: 14,
                    fontWeight: 700,
                    textDecoration: 'none',
                    letterSpacing: '-0.01em',
                    boxShadow: '0 4px 20px rgba(28,27,26,0.12)',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
                >
                  Continue to {appName}
                </a>
              )}

              {/* For CLI/desktop — provide a direct deep-link action in case the browser blocks auto-launch */}
              {isLocalRedirect && (
                <>
                  {redirectUri && (
                    <a
                      ref={protocolLinkRef}
                      href={redirectUri}
                      style={{
                        display: 'block',
                        padding: '13px 20px',
                        borderRadius: 12,
                        background: COLORS.text,
                        color: COLORS.white,
                        fontSize: 14,
                        fontWeight: 700,
                        textDecoration: 'none',
                        letterSpacing: '-0.01em',
                        boxShadow: '0 4px 20px rgba(28,27,26,0.12)',
                        transition: 'transform 0.2s',
                      }}
                      onClick={() => setLaunchAttempted(true)}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
                    >
                      Open {appName}
                    </a>
                  )}

                  <div style={{
                    padding: '13px 20px',
                    borderRadius: 12,
                    background: COLORS.successSoft,
                    border: `1px solid rgba(31,122,58,0.15)`,
                    fontSize: 13,
                    color: COLORS.success,
                    lineHeight: 1.5,
                  }}>
                    Return to {appName} after the desktop app opens and completes sign-in.
                  </div>
                </>
              )}

              <a
                href="/shell"
                style={{
                  display: 'block',
                  padding: '11px 20px',
                  borderRadius: 12,
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: COLORS.soft,
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = COLORS.text; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = COLORS.soft; }}
              >
                Go to Allternit platform
              </a>
            </motion.div>
          </div>

          {/* Footer */}
          <div style={{
            borderTop: `1px solid ${COLORS.border}`,
            background: COLORS.bg,
            padding: '14px 36px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 12.5, color: COLORS.soft, margin: 0, lineHeight: 1.6 }}>
              You can revoke access any time from{' '}
              <a href="/shell/settings/connections" style={{ color: COLORS.accent, textDecoration: 'underline' }}>
                Settings → Connections
              </a>
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
