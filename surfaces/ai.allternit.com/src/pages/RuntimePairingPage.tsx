'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Laptop, Server, ShieldCheck } from 'lucide-react';
import { MatrixLogo } from '@/components/ai-elements/MatrixLogo';
import { env } from '@/lib/env';
import { usePlatformAuth, usePlatformUser } from '@/lib/platform-auth-client';

type PairingInfo = {
  pairingId: string;
  userCode: string;
  name: string;
  runtimeType: 'desktop' | 'vps';
  hostname?: string;
  platform?: string;
  publicKeyFingerprint: string;
  capabilities: string[];
  status: 'pending' | 'approved';
  expiresAt: string;
};

const CAPABILITY_LABELS: Record<string, string> = {
  'runtime:connect': 'Connect securely to your Allternit account',
  'runtime:execute': 'Run tasks you send to this runtime',
  'runtime:files': 'Work with files on this runtime',
  'runtime:terminal': 'Use terminal tools on this runtime',
  'providers:connect': 'Connect model providers on this runtime',
  'providers:use': 'Use connected models for your tasks',
};

function cloudApiUrl(path: string): string {
  const base = env('NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL', 'https://allternit-cloud-api.fly.dev')!;
  return `${base.replace(/\/$/, '')}${path}`;
}

function normalizeCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8);
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

export default function RuntimePairingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = usePlatformAuth();
  const { user } = usePlatformUser();
  const [code, setCode] = useState(() => normalizeCode(searchParams.get('code') || ''));
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const returnPath = useMemo(() => `/pair?code=${encodeURIComponent(code)}`, [code]);

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    navigate(`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`, { replace: true });
  }, [isLoaded, isSignedIn, navigate, returnPath]);

  const authenticatedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getToken();
    if (!token) throw new Error('Your Allternit session expired. Sign in again to continue.');
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, {
      ...init,
      headers,
    });
  }, [getToken]);

  const loadPairing = useCallback(async (requestedCode: string) => {
    const normalized = normalizeCode(requestedCode);
    if (normalized.length !== 9) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(
        cloudApiUrl(`/api/v1/runtime-pairings/code/${encodeURIComponent(normalized)}`),
      );
      const payload = await response.json().catch(() => ({})) as PairingInfo & { message?: string };
      if (!response.ok) throw new Error(payload.message || 'This pairing code is invalid or expired.');
      setPairing(payload);
    } catch (failure) {
      setPairing(null);
      setError(failure instanceof Error ? failure.message : 'Unable to load this pairing request.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || code.length !== 9) return;
    void loadPairing(code);
  }, [code, isLoaded, isSignedIn, loadPairing]);

  async function approve() {
    if (!pairing) return;
    setApproving(true);
    setError(null);
    try {
      const response = await authenticatedFetch(
        cloudApiUrl(`/api/v1/runtime-pairings/code/${encodeURIComponent(pairing.userCode)}/approve`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user?.primaryEmailAddress?.emailAddress || user?.userEmail,
            name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined,
            imageUrl: user?.imageUrl || undefined,
          }),
        },
      );
      const payload = await response.json().catch(() => ({})) as {
        desktopCallbackUrl?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message || 'Allternit could not approve this runtime.');
      setApproved(true);
      setCallbackUrl(payload.desktopCallbackUrl || null);
      if (payload.desktopCallbackUrl) {
        window.setTimeout(() => window.location.assign(payload.desktopCallbackUrl!), 250);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to approve this runtime.');
    } finally {
      setApproving(false);
    }
  }

  async function deny() {
    if (!pairing) return;
    setApproving(true);
    try {
      await authenticatedFetch(
        cloudApiUrl(`/api/v1/runtime-pairings/code/${encodeURIComponent(pairing.userCode)}/deny`),
        { method: 'POST' },
      );
    } finally {
      setPairing(null);
      setError('Pairing cancelled. You can close this tab.');
      setApproving(false);
    }
  }

  if (!isLoaded || !isSignedIn) {
    return <PairingShell><p className="pair-muted">Checking your Allternit session…</p></PairingShell>;
  }

  if (approved) {
    return (
      <PairingShell>
        <div className="pair-success"><ShieldCheck size={28} /></div>
        <h1>Desktop connected</h1>
        <p className="pair-muted">Allternit is finishing setup and should come to the front automatically.</p>
        {callbackUrl ? (
          <a className="pair-primary pair-link" href={callbackUrl}>Return to Allternit Desktop</a>
        ) : null}
        <p className="pair-footnote">You can close this browser tab.</p>
      </PairingShell>
    );
  }

  return (
    <PairingShell>
      {!pairing ? (
        <>
          <h1>Connect a runtime</h1>
          <p className="pair-muted">Enter the code shown by Allternit Desktop or your VPS runtime.</p>
          <label className="pair-label" htmlFor="pair-code">Pairing code</label>
          <input
            id="pair-code"
            className="pair-code"
            value={code}
            onChange={(event) => {
              setCode(normalizeCode(event.target.value));
              setError(null);
            }}
            placeholder="ABCD-2345"
            autoComplete="one-time-code"
            autoFocus
          />
          <button
            className="pair-primary"
            type="button"
            disabled={code.length !== 9 || loading}
            onClick={() => void loadPairing(code)}
          >
            {loading ? 'Checking…' : 'Continue'}
          </button>
          {error ? <div className="pair-error">{error}</div> : null}
        </>
      ) : (
        <>
          <div className="pair-device-icon">
            {pairing.runtimeType === 'vps' ? <Server size={28} /> : <Laptop size={28} />}
          </div>
          <p className="pair-eyebrow">{pairing.runtimeType === 'vps' ? 'VPS runtime' : 'Desktop runtime'}</p>
          <h1>Connect {pairing.name}?</h1>
          <p className="pair-muted">
            Signed in as {user?.primaryEmailAddress?.emailAddress || user?.userEmail || 'your Allternit account'}
          </p>
          <div className="pair-details">
            <div><span>Code</span><strong>{pairing.userCode}</strong></div>
            {pairing.hostname ? <div><span>Host</span><strong>{pairing.hostname}</strong></div> : null}
            {pairing.platform ? <div><span>System</span><strong>{pairing.platform}</strong></div> : null}
            <div><span>Device key</span><strong>{pairing.publicKeyFingerprint.slice(0, 12)}…</strong></div>
          </div>
          <div className="pair-permissions">
            <p>This runtime will be able to:</p>
            {pairing.capabilities.map((capability) => (
              <div key={capability}><Check size={15} /><span>{CAPABILITY_LABELS[capability] || capability}</span></div>
            ))}
          </div>
          {error ? <div className="pair-error">{error}</div> : null}
          <button className="pair-primary" type="button" disabled={approving} onClick={() => void approve()}>
            {approving ? 'Connecting…' : 'Connect runtime'}
          </button>
          <button className="pair-secondary" type="button" disabled={approving} onClick={() => void deny()}>
            Cancel
          </button>
          <p className="pair-footnote">Provider credentials stay on this runtime and are never sent to Allternit Cloud.</p>
        </>
      )}
    </PairingShell>
  );
}

function PairingShell({ children }: { children: ReactNode }) {
  return (
    <main className="pair-page">
      <style>{`
        .pair-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box; background: #faf9f7; color: #1a1916; }
        .pair-card { width: min(100%, 460px); box-sizing: border-box; padding: 34px; border: 1px solid #e1e5eb; border-radius: 20px; background: #fffefc; box-shadow: 0 24px 70px rgba(28,27,26,.09); }
        .pair-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 30px; font-weight: 700; }
        .pair-card h1 { margin: 8px 0 10px; color: #0d0c0a; font-family: Georgia, ui-serif, serif; font-size: 27px; line-height: 1.2; }
        .pair-muted { margin: 0 0 24px; color: #74716b; font-size: 14px; line-height: 1.55; }
        .pair-label, .pair-eyebrow { display: block; margin-bottom: 8px; color: #74716b; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        .pair-code { width: 100%; box-sizing: border-box; margin-bottom: 14px; padding: 14px; border: 1px solid #c9d0da; border-radius: 10px; background: #fff; color: #1a1916; font: 700 22px/1 ui-monospace, monospace; letter-spacing: .12em; text-align: center; outline: none; }
        .pair-code:focus { border-color: #B08D6E; box-shadow: 0 0 0 3px rgba(176,141,110,.14); }
        .pair-primary, .pair-secondary { width: 100%; box-sizing: border-box; padding: 12px 18px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .pair-primary { border: 1px solid #1a1916; background: #1a1916; color: #faf9f7; }
        .pair-primary:disabled { cursor: not-allowed; opacity: .5; }
        .pair-secondary { margin-top: 9px; border: 1px solid #d7d4ce; background: transparent; color: #74716b; }
        .pair-link { display: block; text-align: center; text-decoration: none; }
        .pair-device-icon, .pair-success { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 14px; background: #f1ece7; color: #9A7658; }
        .pair-success { margin-bottom: 18px; background: #e8f7ee; color: #1f7a3a; }
        .pair-details { margin: 22px 0; padding: 4px 14px; border: 1px solid #e1e5eb; border-radius: 12px; background: #faf9f7; }
        .pair-details div { display: flex; justify-content: space-between; gap: 14px; padding: 10px 0; border-bottom: 1px solid #e8e5df; font-size: 12px; }
        .pair-details div:last-child { border-bottom: 0; }
        .pair-details span { color: #989590; }.pair-details strong { overflow: hidden; color: #47443f; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
        .pair-permissions { margin-bottom: 22px; }.pair-permissions > p { margin: 0 0 10px; color: #74716b; font-size: 12px; font-weight: 600; }
        .pair-permissions > div { display: flex; gap: 9px; margin: 9px 0; color: #5d5a54; font-size: 12px; line-height: 1.35; }.pair-permissions svg { flex: none; color: #B08D6E; }
        .pair-error { margin: 12px 0; padding: 10px 12px; border: 1px solid #f1c7c3; border-radius: 9px; background: #fdecea; color: #9c2a25; font-size: 12px; line-height: 1.45; }
        .pair-footnote { margin: 18px 0 0; color: #989590; font-size: 11px; line-height: 1.45; text-align: center; }
        @media (max-width: 520px) { .pair-page { padding: 0; align-items: stretch; }.pair-card { width: 100%; min-height: 100vh; padding: 28px 22px; border: 0; border-radius: 0; box-shadow: none; } }
      `}</style>
      <section className="pair-card">
        <div className="pair-brand"><MatrixLogo state="idle" size={28} /><span>Allternit</span></div>
        {children}
      </section>
    </main>
  );
}
