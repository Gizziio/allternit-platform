'use client';

import React, { useCallback, useEffect, useState } from 'react';
import * as QRCodeModule from 'react-qr-code';
const QRCode =
  (QRCodeModule as any).default?.QRCode ??
  (QRCodeModule as any).default ??
  QRCodeModule;
import {
  ArrowsClockwise,
  Check,
  Copy,
  DesktopTower,
  DeviceMobile,
  Spinner,
  X,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import {
  getDispatchStatus,
  getDispatchDevAddress,
  mintDispatchToken,
  type DispatchStatusResponse,
} from '@/lib/dispatch/handoff';
import { ToastProvider } from '@/components/ui/toast-provider';
import { openRemoteControlWindow } from '@/lib/open-remote-control-window';
import { MachinesPanel } from './MachinesPanel';
import { RemoteSessionPanel } from './RemoteSessionPanel';
import { useRuntimeSelection } from './useRuntimeSelection';
import { useRuntimes } from './useRuntimes';
import { useRemotePendingCounts } from './useRemotePendingCounts';
import { MockRuntimesBanner } from './MockRuntimesBanner';

function generateDispatchToken(): string {
  const arr = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface QRHandoffPanelProps {
  runtimeId: string;
  runtimeName: string;
  onDismiss?: () => void;
}

function QRHandoffPanel({ runtimeId, runtimeName, onDismiss }: QRHandoffPanelProps) {
  const { getToken } = usePlatformAuth();
  const [token, setToken] = useState<string>(() => generateDispatchToken());
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<DispatchStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    mintDispatchToken(getToken, runtimeId)
      .then((minted) => {
        if (!cancelled) setToken(minted.token);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimeId]);

  useEffect(() => {
    let cancelled = false;
    async function buildUrl() {
      if (typeof window === 'undefined') return;
      const base = (await getDispatchDevAddress()) || window.location.origin;
      if (cancelled) return;
      setQrUrl(`${base}/dispatch/join?token=${token}&ts=${Date.now()}`);
      setStatus(null);
      setError(null);
    }
    void buildUrl();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !qrUrl) return;
    let cancelled = false;
    const poll = () => {
      getDispatchStatus(token, getToken)
        .then((s) => {
          if (cancelled) return;
          setStatus(s);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, qrUrl, getToken]);

  const handleCopy = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleRefresh = () => {
    setToken(generateDispatchToken());
    setCopied(false);
  };

  if (status?.claimed) {
    return (
      <div className="rounded-2xl bg-[var(--bg-elevated)] border border-solid border-[var(--status-success)] p-4 flex items-center gap-3 shadow-sm">
        <div className="size-9 rounded-xl bg-[var(--status-success)]/15 flex items-center justify-center shrink-0">
          <DeviceMobile size={18} className="text-[var(--status-success)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">Phone connected</div>
          <div className="text-[12px] text-[var(--text-tertiary)]">
            {status.device ?? 'Mobile device'} · joined{' '}
            {status.claimedAt
              ? new Date(status.claimedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'just now'}
          </div>
        </div>
        <Check size={18} className="text-[var(--status-success)] shrink-0" weight="bold" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-elevated)] border border-solid border-[var(--border-default)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">Hand off {runtimeName}</h3>
          <p className="m-0 text-[12px] text-[var(--text-tertiary)]">
            Scan the QR code to continue this session on your phone.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="bg-transparent border-none cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] p-0.5 shrink-0"
            aria-label="Dismiss QR panel"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex items-start gap-5">
        <div className="p-3 bg-white rounded-xl shadow-sm shrink-0">
          {qrUrl ? (
            <QRCode value={qrUrl} size={140} level="M" />
          ) : (
            <div className="size-[140px] flex items-center justify-center">
              <Spinner size={24} className="animate-spin text-[var(--text-tertiary)]" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--border-subtle)] border border-solid border-[var(--border-default)]">
            <code className="flex-1 text-[11px] text-[var(--text-secondary)] truncate font-mono">
              {qrUrl || 'Generating…'}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg border-none text-[11px] font-bold cursor-pointer transition-colors shrink-0',
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-white'
              )}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] bg-transparent border-none cursor-pointer hover:text-[var(--text-secondary)] p-0"
            >
              <ArrowsClockwise size={13} /> Regenerate
            </button>
            <span className="text-[var(--border-default)]">·</span>
            <span className="text-[11px] text-[var(--text-tertiary)]">One-time token · expires on refresh</span>
          </div>
          {error && <div className="text-[11px] text-[var(--status-error)]">Handoff check failed: {error}</div>}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 shadow-sm">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
        {label}
      </div>
      <div className="text-[32px] font-bold text-[var(--text-primary)]">{value}</div>
      <div className="text-[12px] text-[var(--text-secondary)]">{sub}</div>
    </div>
  );
}

export function RemoteControlHub(): React.ReactNode {
  const auth = usePlatformAuth();
  const { runtimes, loading, isMock, lastRefreshedAt } = useRuntimes();
  const [selectedId, setSelectedId] = useRuntimeSelection();
  const selected = runtimes.find((r) => r.id === selectedId);
  const onlineCount = runtimes.filter((r) => r.status === 'online').length;
  const { permissions: pendingPermissions, questions: pendingQuestions } = useRemotePendingCounts(runtimes, auth.getToken);

  const handleOpenDashboard = useCallback(() => {
    openRemoteControlWindow(selectedId ?? undefined);
  }, [selectedId]);

  const lastRefreshedText = lastRefreshedAt
    ? `Updated ${new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : null;

  return (
    <ToastProvider>
      <div className="h-full w-full overflow-y-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1
                className="text-3xl font-medium tracking-tight m-0"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Remote Control
              </h1>
              <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">
                Monitor, hand off, and control your agents across machines.
              </p>
              <div className="flex items-center gap-2 mt-2">
                {loading && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
                    <Spinner size={12} className="animate-spin" />
                    Refreshing machines…
                  </span>
                )}
                {lastRefreshedText && !loading && (
                  <span className="text-[12px] text-[var(--text-tertiary)]">{lastRefreshedText}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenDashboard}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-none text-[13px] font-semibold cursor-pointer transition-colors shrink-0"
              style={{ background: 'var(--accent-primary)', color: 'var(--accent-on-primary)' }}
            >
              Open dashboard
            </button>
          </header>

          {isMock && <div className="mb-6"><MockRuntimesBanner /></div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Online Machines" value={onlineCount} sub={`of ${runtimes.length} paired`} />
            <StatCard label="Pending Permissions" value={pendingPermissions} sub="Need your approval" />
            <StatCard label="Pending Questions" value={pendingQuestions} sub="Awaiting answers" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MachinesPanel
                runtimes={runtimes}
                loading={loading}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
            <div className="space-y-6">
              {selected ? (
                <>
                  <QRHandoffPanel runtimeId={selected.id} runtimeName={selected.name} />
                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden h-[600px]">
                    <RemoteSessionPanel runtimeId={selected.id} getToken={auth.getToken} />
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-8 text-center">
                  <DesktopTower size={48} className="mx-auto mb-3 opacity-40" />
                  <p className="text-[14px] font-medium text-[var(--text-primary)] m-0 mb-1">
                    Select a machine
                  </p>
                  <p className="text-[12px] text-[var(--text-tertiary)] m-0 mb-4">
                    Choose a paired machine to hand off or remote control it.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenDashboard}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--text-primary)] text-[var(--bg-elevated)] border-none cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <ArrowSquareOut size={14} weight="bold" />
                    Open dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
