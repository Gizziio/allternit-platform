'use client';

/**
 * OpenClawView — Native Allternit UI for OpenClaw gateway
 *
 * Talks directly to the OpenClaw gateway — NOT routed through allternit-api
 * or Gizzi.
 *
 * Gateway URL: defaults to localhost:18789, overridable via
 *   window.__ALLTERNIT_OPENCLAW_URL__
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Warning,
  ArrowsClockwise,
  Robot,
  XCircle,
  ArrowSquareOut,
  Gear,
} from '@phosphor-icons/react';
import { openInBrowser } from '@/lib/openInBrowser';

// ============================================================================
// Gateway config
// ============================================================================

function resolveGatewayUrl(): string {
  if (typeof window !== 'undefined') {
    const override = ((window as unknown) as Record<string, unknown>).__ALLTERNIT_OPENCLAW_URL__;
    if (typeof override === 'string' && override.trim()) {
      return override.trim().replace(/\/$/, '');
    }
  }
  return 'http://localhost:18789';
}

const OPENCLAW_GATEWAY_URL = resolveGatewayUrl();
const HEALTH_INTERVAL_MS   = 8000;

// ============================================================================
// Types
// ============================================================================

interface GatewayStatus {
  healthy: boolean;
  version: string | null;
  corsBlocked: boolean;
}

type ViewTab = 'ui' | 'overview';

// ============================================================================
// Gateway health check
// ============================================================================

// OpenClaw serves its own SPA at all HTTP routes (no REST JSON API).
// Use no-cors so we can check reachability without CORS negotiation.
async function checkHealth(): Promise<GatewayStatus> {
  try {
    await fetch(`${OPENCLAW_GATEWAY_URL}/`, {
      mode: 'no-cors',
      signal: AbortSignal.timeout(3000),
    });
    return { healthy: true, version: null, corsBlocked: false };
  } catch {
    return { healthy: false, version: null, corsBlocked: false };
  }
}

// ============================================================================
// Main view
// ============================================================================

export function OpenClawView() {
  const [status, setStatus]       = useState<GatewayStatus>({ healthy: false, version: null, corsBlocked: false });
  const [checking, setChecking]   = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('ui');

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const s = await checkHealth();
      if (mounted) { setStatus(s); setChecking(false); }
    };
    poll();
    const t = setInterval(poll, HEALTH_INTERVAL_MS);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  if (checking) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3 opacity-50">
          <ArrowsClockwise size={28} className="mx-auto animate-spin" />
          <p className="text-sm">Connecting to OpenClaw gateway…</p>
        </div>
      </div>
    );
  }

  if (!status.healthy) {
    return (
      <GatewayOffline
        onRetry={async () => {
          setChecking(true);
          const s = await checkHealth();
          setStatus(s);
          setChecking(false);
        }}
      />
    );
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <div
        className="shrink-0 px-5 py-3 border-b flex items-center gap-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Robot size={20} style={{ color: 'var(--accent-primary)' }} />
          <span className="font-semibold text-sm">OpenClaw</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(120,220,100,0.15)', color: '#78dc64' }}
          >
            Connected
          </span>
        </div>
        <TabBar active={activeTab} onChange={setActiveTab} />
        <button type="button"
          onClick={() => openInBrowser(OPENCLAW_GATEWAY_URL)}
          className="size-7 flex items-center justify-center rounded-lg border-none cursor-pointer transition-colors"
          style={{ background: 'transparent', color: 'var(--ui-text-muted)' }}
          title="Open in browser"
        >
          <ArrowSquareOut size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'ui'       && <GatewayUiTab />}
        {activeTab === 'overview' && <OverviewTab status={status} />}
      </div>
    </div>
  );
}

// ============================================================================
// Tab bar
// ============================================================================

const TABS: { id: ViewTab; label: string; icon: React.ElementType }[] = [
  { id: 'ui',       label: 'Gateway',  icon: Robot },
  { id: 'overview', label: 'Overview', icon: Gear },
];

function TabBar({ active, onChange }: { active: ViewTab; onChange: (t: ViewTab) => void }) {
  return (
    <div className="flex gap-1">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button type="button"
          key={id}
          onClick={() => onChange(id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: active === id ? 'var(--surface-active)' : 'transparent',
            color:           active === id ? 'var(--ui-text-primary)' : 'var(--ui-text-muted)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Gateway UI tab — iframe into OpenClaw's own web control panel
// ============================================================================

function GatewayUiTab() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading]         = useState(true);
  const [iframeError, setIframeError] = useState(false);

  const handleLoad  = useCallback(() => setLoading(false), []);
  const handleError = useCallback(() => { setLoading(false); setIframeError(true); }, []);

  if (iframeError) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-3 max-w-xs">
          <XCircle size={28} className="mx-auto" style={{ color: '#f87171' }} />
          <p className="text-sm font-medium">Could not embed OpenClaw UI</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            The gateway interface may be blocked in this context.
          </p>
          <button type="button"
            onClick={() => openInBrowser(OPENCLAW_GATEWAY_URL)}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--surface-active)', color: 'var(--text-primary)', border: 'none', cursor: 'pointer' }}
          >
            <ArrowSquareOut size={14} />
            Open in Browser
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <div className="flex flex-col items-center gap-2 opacity-40">
            <ArrowsClockwise size={24} className="animate-spin" />
            <p className="text-sm">Loading OpenClaw…</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={OPENCLAW_GATEWAY_URL}
        className="w-full h-full border-0"
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        title="OpenClaw Gateway"
      />
    </div>
  );
}

// ============================================================================
// Overview tab
// ============================================================================

function OverviewTab({ status }: { status: GatewayStatus }) {
  return (
    <div className="p-6 max-w-lg mx-auto space-y-4 pt-10">
      <div
        className="p-4 rounded-xl"
        style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          GATEWAY STATUS
        </div>
        <div className="space-y-2 text-sm">
          <Row label="Status"   value={<span style={{ color: '#78dc64' }}>Connected</span>} />
          {status.version && <Row label="Version"  value={`v${status.version}`} />}
          <Row label="Endpoint" value={OPENCLAW_GATEWAY_URL} />
        </div>
      </div>

      <button type="button"
        onClick={() => openInBrowser(OPENCLAW_GATEWAY_URL)}
        className="flex items-center gap-2 text-sm"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
      >
        <ArrowSquareOut size={14} />
        Open gateway in browser
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

// ============================================================================
// Offline state
// ============================================================================

function GatewayOffline({ onRetry }: { onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  const [working, setWorking] = useState<'install' | 'start' | null>(null);
  const [error, setError] = useState('');
  const miniApps = typeof window !== 'undefined' ? window.allternit?.miniApps : undefined;

  const retry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  const install = async () => {
    if (!miniApps) return;
    setWorking('install'); setError('');
    const result = await miniApps.install('openclaw');
    setWorking(null);
    if (!result.success) setError(result.error ?? 'Installation failed');
  };

  const start = async () => {
    if (!miniApps) return;
    setWorking('start'); setError('');
    const result = await miniApps.start('openclaw');
    setWorking(null);
    if (!result.success) setError(result.error ?? 'Gateway failed to start');
    else await onRetry();
  };

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-sm w-full space-y-5">
        <div className="flex items-center gap-3">
          <Warning size={24} style={{ color: '#f87171' }} />
          <div>
            <div className="font-semibold">OpenClaw Not Running</div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Gateway unreachable at {OPENCLAW_GATEWAY_URL}
            </div>
          </div>
        </div>

        <div
          className="p-4 rounded-xl text-sm space-y-1.5"
          style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="font-medium mb-2">To start OpenClaw:</div>
          <div
            className="font-mono text-xs p-2 rounded"
            style={{ backgroundColor: 'var(--surface-active)', color: 'var(--text-primary)' }}
          >
            openclaw gateway --port 18789
          </div>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            First-time setup: openclaw onboard --install-daemon
          </div>
          <div className="text-xs pt-1" style={{ color: 'var(--text-tertiary)' }}>
            Override URL: set <code>window.__ALLTERNIT_OPENCLAW_URL__</code>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
        {miniApps && <button type="button" onClick={install} disabled={Boolean(working)} className="flex items-center gap-2 px-4 py-2 rounded-lg border-none cursor-pointer text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)' }}>{working === 'install' ? 'Installing…' : 'Install or update'}</button>}
        {miniApps && <button type="button" onClick={start} disabled={Boolean(working)} className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>{working === 'start' ? 'Starting…' : 'Start gateway'}</button>}
        <button type="button"
          onClick={retry}
          disabled={retrying}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border-none cursor-pointer text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--surface-active)', color: 'var(--text-primary)' }}
        >
          <ArrowsClockwise size={14} className={retrying ? 'animate-spin' : ''} />
          {retrying ? 'Checking…' : 'Retry Connection'}
        </button>
        <button type="button" onClick={() => openInBrowser('https://github.com/openclaw/openclaw')} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}><ArrowSquareOut size={14}/>GitHub</button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
