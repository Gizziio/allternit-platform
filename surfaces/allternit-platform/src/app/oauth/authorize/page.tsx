'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { MatrixLogo } from '@/components/ai-elements/MatrixLogo';
import { Check } from 'lucide-react';
import { OAUTH_APPS } from '@/config/oauth-apps';
import { OAuthAppIcons, DefaultAppIcon } from '@/config/oauth-app-icons';

// ─── Build client-side app map from shared config ────────────────────────────

type OAuthApp = { name: string; icon: React.ReactNode; scopes: string[] };

const KNOWN_APPS: Record<string, OAuthApp> = Object.fromEntries(
  OAUTH_APPS.map((a) => [a.clientId, {
    name: a.name,
    icon: OAuthAppIcons[a.clientId] ?? DefaultAppIcon,
    scopes: a.scopes,
  }]),
);

const DEFAULT_APP: OAuthApp = {
  name: 'This application',
  icon: DefaultAppIcon,
  scopes: ['Access your Allternit account information'],
};

// ─── Animated connection bridge ───────────────────────────────────────────────

function ConnectionBridge() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(217,119,87,0.6)' }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function AuthorizeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn, userId, getToken } = usePlatformAuth();

  const [loading, setLoading] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = searchParams.get('client_id') ?? 'gizzi-code';
  const redirectUri = searchParams.get('redirect_uri') ?? '/shell';
  const oauthState = searchParams.get('state') ?? '';
  const userEmail = searchParams.get('login_hint') ?? '';
  const codeChallenge = searchParams.get('code_challenge') ?? undefined;
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? undefined;

  const app = KNOWN_APPS[clientId] ?? DEFAULT_APP;

  useEffect(() => {
    const t = setTimeout(() => setCardVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const returnTo = `/oauth/authorize?${searchParams.toString()}`;
    router.replace(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }, [isLoaded, isSignedIn, router, searchParams]);

  async function handleAuthorize() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const clerkToken = await getToken().catch(() => null);
      const res = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {}),
        },
        body: JSON.stringify({ clientId, redirectUri, state: oauthState, userEmail, codeChallenge, codeChallengeMethod }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `Server error ${res.status}`);
      }
      const { code, state } = await res.json() as { code: string; redirectUri: string; state: string };
      
      // Append code and state to the redirectUri for the final protocol redirect
      const finalRedirectUri = new URL(redirectUri);
      finalRedirectUri.searchParams.set('code', code);
      finalRedirectUri.searchParams.set('state', state);
      
      const dest = `/oauth/success?app=${encodeURIComponent(app.name)}&redirect_uri=${encodeURIComponent(finalRedirectUri.toString())}`;
      router.push(dest);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Authorization failed');
    }
  }

  function handleDecline() {
    setDeclined(true);
    setTimeout(() => router.push('/shell'), 1200);
  }

  // Don't flash anything until Clerk confirms the session
  if (!isLoaded || !isSignedIn) return null;

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0806',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'inherit', padding: '24px 16px',
    }}>
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400,
        background: 'radial-gradient(ellipse, rgba(217,119,87,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <AnimatePresence>
        {cardVisible && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%', maxWidth: 480, background: '#110E0B', borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '40px 36px 32px' }}>
              {/* Connected logos */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
                <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
                  {app.icon}
                </motion.div>
                <motion.div initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>
                  <ConnectionBridge />
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
                  <MatrixLogo state="idle" size={40} />
                </motion.div>
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}
                style={{ fontSize: 17, fontWeight: 400, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 1.5, marginBottom: 24, letterSpacing: '-0.01em' }}
              >
                <strong style={{ fontWeight: 700 }}>{app.name}</strong>{' '}would like to connect to your{' '}
                <strong style={{ fontWeight: 700 }}>Allternit account</strong>
              </motion.h1>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />

              {/* Scopes */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.4 }}>
                <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
                  Your account will be used to:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {app.scopes.map((scope, i) => (
                    <motion.div key={scope} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.055, duration: 0.3 }}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flexShrink: 0, marginTop: 1, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={13} strokeWidth={2.5} color="#D97757" />
                      </div>
                      <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.45 }}>{scope}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '24px 0 20px' }} />

              {/* Error */}
              {error && (
                <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12.5, color: 'rgba(239,68,68,0.9)' }}>
                  {error}
                </div>
              )}

              {/* Actions */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.35 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={handleAuthorize}
                  disabled={loading || declined}
                  style={{
                    width: '100%', padding: '13px 20px', borderRadius: 12, border: 'none',
                    background: loading ? 'rgba(217,119,87,0.6)' : 'linear-gradient(135deg, #E8886A 0%, #D97757 100%)',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    cursor: loading || declined ? 'not-allowed' : 'pointer',
                    letterSpacing: '-0.01em',
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(217,119,87,0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
                >
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }}
                      />
                      Authorizing…
                    </span>
                  ) : 'Authorize'}
                </button>

                <button
                  onClick={handleDecline}
                  disabled={loading || declined}
                  style={{
                    width: '100%', padding: '11px 20px', borderRadius: 12, border: 'none',
                    background: 'transparent',
                    color: declined ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)',
                    fontSize: 14, fontWeight: 500,
                    cursor: declined ? 'not-allowed' : 'pointer',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => { if (!declined && !loading) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'; }}
                >
                  {declined ? 'Redirecting…' : 'Decline'}
                </button>
              </motion.div>
            </div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.35 }}
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: '#0D0A07', padding: '14px 36px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                Logged in as <span style={{ color: 'rgba(255,255,255,0.55)' }}>{userEmail || 'your account'}</span>
              </p>
              <a
                href={`/oauth/select-account?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${oauthState}`}
                style={{ fontSize: 12, color: '#D97757', textDecoration: 'none', opacity: 0.8 }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8'; }}
              >
                Switch account
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense>
      <AuthorizeContent />
    </Suspense>
  );
}
