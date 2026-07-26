/**
 * DevicePairingPanel - Approve `gizzi pair` requests and review paired runtimes.
 *
 * Approval happens where the user is already signed in. Inside the desktop
 * shell the preload bridge (window.allternit.devicePairing) brokers the call
 * through Electron main, which holds the runtime device credential; on the
 * web the panel talks to the cloud API directly with the Clerk session token,
 * exactly like RuntimePairingPage.
 */

"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowClockwise,
  CheckCircle,
  HardDrives,
  Laptop,
  ShieldCheck,
  Warning,
} from '@phosphor-icons/react';
import { STATUS, TEXT } from '@/design/allternit.tokens';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { QUIET_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { cn } from '@/lib/utils';
import { env } from '@/lib/env';
import { usePlatformAuth } from '@/lib/platform-auth-client';

type PairingInfo = {
  pairingId: string;
  userCode: string;
  name: string;
  runtimeType: string;
  hostname?: string;
  platform?: string;
  publicKeyFingerprint: string;
  capabilities: string[];
  status: string;
  expiresAt: string;
};

type RuntimeDevice = {
  id: string;
  name: string;
  runtimeType: string;
  hostname?: string;
  platform?: string;
  version?: string;
  capabilities: string[];
  publicKeyFingerprint: string;
  status: string;
  lastSeenAt?: string;
  createdAt: string;
  credentialExpiresAt: string;
};

function cloudApiUrl(path: string): string {
  const base = env('NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL', 'https://allternit-cloud-api.fly.dev')!;
  return `${base.replace(/\/$/, '')}${path}`;
}

/** Same normalization as RuntimePairingPage: XXXX-XXXX. */
function normalizeCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8);
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

function formatLastSeen(value?: string): string {
  if (!value) return 'Never';
  const seen = new Date(value).getTime();
  if (Number.isNaN(seen)) return 'Unknown';
  const deltaMs = Date.now() - seen;
  if (deltaMs < 60_000) return 'Just now';
  if (deltaMs < 3_600_000) return `${Math.floor(deltaMs / 60_000)}m ago`;
  if (deltaMs < 86_400_000) return `${Math.floor(deltaMs / 3_600_000)}h ago`;
  return new Date(value).toLocaleDateString();
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
  return new Error(payload.message || payload.error || fallback);
}

export function DevicePairingPanel() {
  const { getToken } = usePlatformAuth();
  const bridge = typeof window !== 'undefined' ? window.allternit?.devicePairing : undefined;

  const [code, setCode] = useState('');
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [acting, setActing] = useState<'approve' | 'deny' | null>(null);
  const [approvedName, setApprovedName] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);

  const [devices, setDevices] = useState<RuntimeDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState<string | null>(null);

  const webFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = await getToken();
    if (!token) throw new Error('Your Allternit session is unavailable. Sign in again to continue.');
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(cloudApiUrl(path), { ...init, headers });
  }, [getToken]);

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    setDevicesError(null);
    try {
      if (bridge) {
        setDevices(await bridge.listDevices());
      } else {
        const response = await webFetch('/api/v1/runtime-devices');
        if (!response.ok) throw await readError(response, 'Unable to load paired devices.');
        const payload = await response.json() as { runtimes?: RuntimeDevice[] };
        setDevices(payload.runtimes ?? []);
      }
    } catch (failure) {
      setDevicesError(failure instanceof Error ? failure.message : 'Unable to load paired devices.');
    } finally {
      setDevicesLoading(false);
    }
  }, [bridge, webFetch]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const lookupPairing = useCallback(async (requestedCode: string) => {
    const normalized = normalizeCode(requestedCode);
    if (normalized.length !== 9) return;
    setLookupLoading(true);
    setPairingError(null);
    setApprovedName(null);
    try {
      if (bridge) {
        setPairing(await bridge.lookup(normalized));
      } else {
        const response = await webFetch(`/api/v1/runtime-pairings/code/${encodeURIComponent(normalized)}`);
        if (!response.ok) throw await readError(response, 'This pairing code is invalid or expired.');
        setPairing(await response.json() as PairingInfo);
      }
    } catch (failure) {
      setPairing(null);
      setPairingError(failure instanceof Error ? failure.message : 'Unable to load this pairing request.');
    } finally {
      setLookupLoading(false);
    }
  }, [bridge, webFetch]);

  const approvePairing = useCallback(async () => {
    if (!pairing) return;
    setActing('approve');
    setPairingError(null);
    try {
      if (bridge) {
        await bridge.approve(pairing.userCode);
      } else {
        const response = await webFetch(
          `/api/v1/runtime-pairings/code/${encodeURIComponent(pairing.userCode)}/approve`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) },
        );
        if (!response.ok) throw await readError(response, 'Allternit could not approve this runtime.');
      }
      setApprovedName(pairing.name);
      setPairing(null);
      setCode('');
      void loadDevices();
    } catch (failure) {
      setPairingError(failure instanceof Error ? failure.message : 'Unable to approve this runtime.');
    } finally {
      setActing(null);
    }
  }, [bridge, pairing, webFetch, loadDevices]);

  const denyPairing = useCallback(async () => {
    if (!pairing) return;
    setActing('deny');
    setPairingError(null);
    try {
      if (bridge) {
        await bridge.deny(pairing.userCode);
      } else {
        await webFetch(`/api/v1/runtime-pairings/code/${encodeURIComponent(pairing.userCode)}/deny`, { method: 'POST' });
      }
      setPairing(null);
      setCode('');
    } catch (failure) {
      setPairingError(failure instanceof Error ? failure.message : 'Unable to deny this runtime.');
    } finally {
      setActing(null);
    }
  }, [bridge, pairing, webFetch]);

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header Card */}
      <div
        style={{
          marginBottom: '24px',
          padding: '24px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(37,37,37,0.6) 0%, rgba(37,37,37,0.3) 100%)',
          border: '1px solid var(--ui-border-muted)',
        }}
      >
        <SectionHeading className="mb-2">Devices</SectionHeading>
        <p style={{ fontSize: '14px', color: TEXT.secondary, margin: 0, lineHeight: '1.5' }}>
          Approve a runtime that is asking to pair with your Allternit account — for example a
          machine that just ran <code>gizzi pair</code> — and review the devices already connected.
        </p>
      </div>

      {/* Approval success */}
      {approvedName && (
        <div
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'var(--status-success-bg, rgba(34,197,94,0.12))',
            border: '1px solid rgba(34,197,94,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: STATUS.success,
            fontSize: '13px',
          }}
        >
          <CheckCircle size={18} weight="fill" />
          <span style={{ flex: 1 }}>{approvedName} is now connected to your Allternit account.</span>
          <button type="button" onClick={() => setApprovedName(null)} className={QUIET_BUTTON_CLASS}>
            Dismiss
          </button>
        </div>
      )}

      {/* Pairing errors */}
      {pairingError && (
        <div
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'var(--status-error-bg)',
            border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: STATUS.error,
            fontSize: '13px',
          }}
        >
          <Warning size={18} weight="fill" />
          <span style={{ flex: 1 }}>{pairingError}</span>
          <button type="button" onClick={() => setPairingError(null)} className={QUIET_BUTTON_CLASS}>
            Dismiss
          </button>
        </div>
      )}

      {/* Pair a device */}
      <div
        style={{
          marginBottom: '24px',
          padding: '20px',
          borderRadius: '10px',
          background: 'rgba(37,37,37,0.4)',
          border: '1px solid var(--ui-border-muted)',
        }}
      >
        <SectionHeading>Pair a device</SectionHeading>
        <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '0 0 14px', lineHeight: '1.5' }}>
          Enter the code shown by the runtime asking to connect.
        </p>

        {!pairing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              value={code}
              onChange={(event) => {
                setCode(normalizeCode(event.target.value));
                setPairingError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void lookupPairing(code);
              }}
              placeholder="ABCD-2345"
              autoComplete="one-time-code"
              style={{
                width: '180px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <button
              type="button"
              disabled={code.length !== 9 || lookupLoading}
              onClick={() => void lookupPairing(code)}
              className={QUIET_BUTTON_CLASS}
            >
              {lookupLoading ? 'Checking…' : 'Continue'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--accent-primary)',
                }}
              >
                {pairing.runtimeType === 'vps' || pairing.runtimeType === 'hosted'
                  ? <HardDrives size={22} />
                  : <Laptop size={22} />}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Connect {pairing.name}?
                </div>
                <div style={{ fontSize: '12px', color: TEXT.secondary }}>
                  {pairing.runtimeType === 'vps' ? 'VPS runtime' : pairing.runtimeType === 'hosted' ? 'Hosted runtime' : 'Desktop runtime'}
                  {' · '}Code {pairing.userCode}
                </div>
              </div>
            </div>

            <div
              style={{
                marginBottom: '16px',
                padding: '4px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
              }}
            >
              {[
                pairing.hostname ? ['Host', pairing.hostname] : null,
                pairing.platform ? ['System', pairing.platform] : null,
                ['Device key', `${pairing.publicKeyFingerprint.slice(0, 12)}…`],
              ].filter((row): row is string[] => Boolean(row)).map(([label, value], index, rows) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '14px',
                    padding: '9px 0',
                    borderBottom: index < rows.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ color: TEXT.secondary }}>{label}</span>
                  <strong style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value}
                  </strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                disabled={acting !== null}
                onClick={() => void approvePairing()}
                className={QUIET_BUTTON_CLASS}
              >
                <ShieldCheck size={16} />
                {acting === 'approve' ? 'Connecting…' : 'Approve'}
              </button>
              <button
                type="button"
                disabled={acting !== null}
                onClick={() => void denyPairing()}
                className={QUIET_BUTTON_CLASS}
              >
                {acting === 'deny' ? 'Denying…' : 'Deny'}
              </button>
              <button
                type="button"
                disabled={acting !== null}
                onClick={() => { setPairing(null); setPairingError(null); }}
                className={QUIET_BUTTON_CLASS}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paired devices */}
      <div
        style={{
          padding: '20px',
          borderRadius: '10px',
          background: 'rgba(37,37,37,0.4)',
          border: '1px solid var(--ui-border-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <SectionHeading className="mb-0">Paired devices</SectionHeading>
          <button
            type="button"
            onClick={() => void loadDevices()}
            disabled={devicesLoading}
            className={QUIET_BUTTON_CLASS}
          >
            <ArrowClockwise size={16} className={cn(devicesLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {devicesError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: STATUS.error, fontSize: '13px', padding: '12px 0' }}>
            <Warning size={16} weight="fill" />
            <span>{devicesError}</span>
          </div>
        )}

        {!devicesError && !devicesLoading && devices.length === 0 && (
          <p style={{ fontSize: '13px', color: TEXT.secondary, margin: '12px 0 4px' }}>
            No devices are paired with your Allternit account yet.
          </p>
        )}

        {devices.map((device) => (
          <div
            key={device.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 0',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '9px',
                background: 'var(--bg-secondary)',
                color: 'var(--accent-primary)',
                flex: 'none',
              }}
            >
              {device.runtimeType === 'vps' || device.runtimeType === 'hosted'
                ? <HardDrives size={19} />
                : <Laptop size={19} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {device.name}
              </div>
              <div style={{ fontSize: '12px', color: TEXT.secondary }}>
                {device.runtimeType === 'vps' ? 'VPS runtime' : device.runtimeType === 'hosted' ? 'Hosted runtime' : 'Desktop runtime'}
                {device.hostname ? ` · ${device.hostname}` : ''}
                {' · Last seen '}{formatLastSeen(device.lastSeenAt)}
              </div>
            </div>
            <span
              style={{
                flex: 'none',
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'capitalize',
                color: device.status === 'online' ? STATUS.success : TEXT.secondary,
                background: device.status === 'online' ? 'var(--status-success-bg, rgba(34,197,94,0.12))' : 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {device.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DevicePairingPanel;
