'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applyRuntimeBackendSnapshot } from '@/lib/runtime-backend-client';

/**
 * /connect — Desktop-to-web tunnel handshake page.
 *
 * The Allternit desktop app opens this URL in the browser when the user
 * enables Web Access:
 *
 *   platform.allternit.com/connect?tunnelUrl=abc123.trycloudflare.com&token=xxx
 *
 * This page runs entirely client-side (Cloudflare Pages static build has no
 * server-side API routes). It stores the tunnel URL + token in localStorage
 * via applyRuntimeBackendSnapshot() so all subsequent API calls from the
 * frontend automatically route through the tunnel.
 *
 * Flow:
 *  1. Validate query params
 *  2. Optional reachability check against the tunnel URL
 *  3. Persist { gatewayUrl, gatewayWsUrl, gateway_token } to localStorage
 *  4. Redirect to /shell
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
      const tunnelParam = params.get('tunnelUrl');
      const token = params.get('token');

      if (!tunnelParam || !token) {
        setError(
          'Invalid link — missing tunnelUrl or token. ' +
          'Open Allternit desktop and click Enable Web Access again.'
        );
        setPhase('error');
        return;
      }

      // tunnelUrl arrives without scheme (desktop strips https://)
      const host = tunnelParam.replace(/^https?:\/\//, '');
      const gatewayUrl = `https://${host}`;
      const gatewayWsUrl = `wss://${host}`;
      setTunnelHost(host);
      setPhase('connecting');

      // Verify the tunnel is reachable before committing it to storage.
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const res = await fetch(`${gatewayUrl}/health`, {
          signal: controller.signal,
          mode: 'cors',
        });
        clearTimeout(timeout);

        if (!res.ok && res.status !== 401) {
          throw new Error(`Gateway responded with status ${res.status}`);
        }
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes('abort') || message.includes('AbortError')) {
          setError(
            'Connection timed out — your desktop tunnel is not reachable yet. ' +
            'Wait a few seconds and try enabling Web Access again.'
          );
        } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
          setError(
            'Cannot reach your desktop tunnel. Make sure the Allternit desktop app ' +
            'is running and the cloudflared tunnel is active.'
          );
        } else {
          setError(`Tunnel not reachable: ${message}`);
        }
        setPhase('error');
        return;
      }

      // Persist tunnel URL + token client-side — no server round-trip needed.
      applyRuntimeBackendSnapshot({
        mode: 'byoc-vps',
        fallback_mode: 'local',
        source: 'user-preference',
        gateway_url: gatewayUrl,
        gateway_ws_url: gatewayWsUrl,
        active_backend: {
          id: `tunnel-${host}`,
          ssh_connection_id: `tunnel-${host}`,
          name: 'Desktop Tunnel',
          status: 'ready',
          install_state: 'installed',
          backend_url: gatewayUrl,
          gateway_url: gatewayUrl,
          gateway_ws_url: gatewayWsUrl,
          installed_version: null,
          supported_client_range: null,
          last_verified_at: new Date().toISOString(),
          last_heartbeat_at: null,
          last_error: null,
        },
        available_backends: [],
        gateway_token: token,
      });

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
              <p className="mt-4 text-slate-500 text-xs">Verifying tunnel is reachable…</p>
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
                <p>3. Click &ldquo;Enable Web Access&rdquo; to get a new link</p>
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
