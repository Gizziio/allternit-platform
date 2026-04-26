'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /connect — Desktop-to-web tunnel handshake page.
 *
 * The Allternit desktop app opens this URL in the browser when the user
 * enables Web Access:
 *
 *   platform.allternit.com/connect?tunnelUrl=abc123.trycloudflare.com&token=xxx
 *
 * Flow:
 *  1. Validate query params
 *  2. Register tunnel as active backend via POST /api/v1/runtime/backend/manual
 *     (persists to DB + Clerk, used by server-side gateway proxy)
 *  3. Redirect to /shell
 */

type Phase = 'validating' | 'connecting' | 'ready' | 'error';

export default function ConnectPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('validating');
  const [error, setError] = useState<string | null>(null);
  const [tunnelHost, setTunnelHost] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const params = new URLSearchParams(window.location.search);
      const tunnelUrl = params.get('tunnelUrl');
      const token = params.get('token');

      if (!tunnelUrl || !token) {
        setError(
          'Invalid link — missing tunnelUrl or token. ' +
          'Open Allternit desktop and click Enable Web Access again.'
        );
        setPhase('error');
        return;
      }

      // tunnelUrl arrives without scheme (desktop strips https://)
      const host = tunnelUrl.replace(/^https?:\/\//, '');
      const gatewayUrl = `https://${host}`;
      setTunnelHost(host);
      setPhase('connecting');

      // Register the tunnel as the active backend server-side.
      // This persists to DB + Clerk so the gateway proxy routes through the tunnel.
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch('/api/v1/runtime/backend/manual', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Desktop Tunnel',
            gatewayUrl,
            gatewayWsUrl: `wss://${host}`,
            gatewayToken: token,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = (body as Record<string, unknown>).error as string | undefined;
          if (res.status === 401) {
            throw new Error('Please sign in to platform.allternit.com first, then re-open the desktop link.');
          }
          if (msg?.includes('not reachable')) {
            throw new Error(
              'Your desktop tunnel is not reachable yet. ' +
              'Wait a few seconds and try enabling Web Access again.'
            );
          }
          throw new Error(msg || `Registration failed (HTTP ${res.status})`);
        }
      } catch (err) {
        const message = (err as Error).message;
        if (message === 'The operation was aborted.' || message.includes('abort')) {
          setError('Connection timed out. Your desktop tunnel may not be reachable yet. Try again in a few seconds.');
          setPhase('error');
          return;
        }
        if (message.startsWith('Please sign in') || message.includes('not reachable')) {
          setError(message);
          setPhase('error');
          return;
        }
        // Network/fetch errors — show error instead of silently proceeding
        console.warn('[connect] Server-side registration failed:', err);
        setError(message || 'Failed to register tunnel. Please check your connection and try again.');
        setPhase('error');
        return;
      }

      setPhase('ready');

      // Brief pause so the user sees the success state, then enter the app
      await new Promise(r => setTimeout(r, 1200));
      router.replace('/shell');
    }

    run();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0f172a' }}>
      <div className="w-full max-w-md text-center">

        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2 select-none">
          <span style={{ color: '#D97757', fontFamily: 'monospace', fontSize: 22, fontWeight: 400 }}>A://</span>
          <span style={{ color: '#ECECEC', fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 400 }}>LLTERNIT</span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-2xl">
          {phase === 'validating' && (
            <>
              <Spinner />
              <h2 className="mt-4 text-xl font-semibold text-white">Validating link…</h2>
              <p className="mt-2 text-slate-400 text-sm">Checking tunnel parameters</p>
            </>
          )}

          {phase === 'connecting' && tunnelHost && (
            <>
              <Spinner />
              <h2 className="mt-4 text-xl font-semibold text-white">Connecting to Desktop</h2>
              <p className="mt-2 text-slate-400 text-sm break-all">{tunnelHost}</p>
              <p className="mt-4 text-slate-500 text-xs">Registering your desktop as the active backend…</p>
            </>
          )}

          {phase === 'ready' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-3xl mx-auto">
                ✓
              </div>
              <h2 className="mt-4 text-xl font-semibold text-white">Desktop Connected</h2>
              <p className="mt-2 text-slate-400 text-sm">Redirecting to your workspace…</p>
            </>
          )}

          {phase === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-3xl mx-auto">
                ⚠
              </div>
              <h2 className="mt-4 text-xl font-semibold text-white">Connection Failed</h2>
              <p className="mt-3 text-red-400 text-sm">{error}</p>
              <div className="mt-6 space-y-2 text-xs text-slate-500">
                <p>1. Open the Allternit desktop app</p>
                <p>2. Go to Settings → Web Access</p>
                <p>3. Click "Enable Web Access" to get a new link</p>
              </div>
            </>
          )}
        </div>

        {/* Security note */}
        {phase !== 'error' && (
          <p className="mt-6 text-slate-600 text-xs">
            This connection is end-to-end encrypted via Cloudflare Tunnel.
            Your data never leaves your machine.
          </p>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="w-12 h-12 rounded-full border-2 border-slate-600 border-t-blue-400 mx-auto animate-spin"
      style={{ animationDuration: '0.8s' }}
    />
  );
}
