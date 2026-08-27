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
  useEffect,
  useState,
} from 'react';
import {
  Warning,
  ArrowsClockwise,
  Robot,
  ArrowSquareOut,
  Gear,
  CheckCircle,
} from '@phosphor-icons/react';
import { openInBrowser } from '@/lib/openInBrowser';
import { MiniAppRuntimeSurface } from '@/views/aci/MiniAppRuntimeSurface';
import type { InstalledMiniApp } from '@/views/aci/mini-app.types';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/typography/Text';
import { cn } from '@/lib/utils';

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
const OPENCLAW_APP: InstalledMiniApp = {
  id: 'openclaw', name: 'OpenClaw', description: 'Official OpenClaw personal-agent gateway and control UI.',
  category: 'runtime', source: 'builtin', url: OPENCLAW_GATEWAY_URL, status: 'running',
  presentation: { mode: 'hybrid', uiUrl: OPENCLAW_GATEWAY_URL, healthUrl: OPENCLAW_GATEWAY_URL, electronPartition: 'persist:allternit-openclaw', nativeRenderer: 'openclaw', fallback: 'external-browser' },
};

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
      <div className="h-full flex items-center justify-center bg-[var(--bg-elevated)] text-[var(--text-primary)]">
        <div className="flex flex-col items-center gap-3 text-[var(--text-secondary)]">
          <ArrowsClockwise size={28} className="animate-spin" />
          <Text variant="caption">Connecting to OpenClaw gateway…</Text>
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
    <div className="h-full w-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
        <Robot size={22} className="text-[var(--accent-primary)] shrink-0" />
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">OpenClaw</h1>
        <Pill
          size="sm"
          icon={<CheckCircle size={11} className="text-[var(--status-success)]" />}
          className="border-[var(--status-success)]/30 bg-[var(--status-success)]/10 text-[var(--status-success)]"
        >
          Connected
        </Pill>
        <div className="flex-1" />
        <TabBar active={activeTab} onChange={setActiveTab} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => openInBrowser(OPENCLAW_GATEWAY_URL)}
          aria-label="Open in browser"
          title="Open in browser"
        >
          <ArrowSquareOut size={14} />
        </Button>
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
        <button
          type="button"
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-none cursor-pointer',
            active === id
              ? 'bg-[var(--surface-active)] text-[var(--text-primary)]'
              : 'bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]'
          )}
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
  return <MiniAppRuntimeSurface app={OPENCLAW_APP} title="OpenClaw Gateway" />;
}

// ============================================================================
// Overview tab
// ============================================================================

function OverviewTab({ status }: { status: GatewayStatus }) {
  return (
    <div className="p-6 max-w-lg mx-auto space-y-4 pt-10">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
        <Text variant="label" className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-3">
          Gateway status
        </Text>
        <div className="space-y-2 text-sm">
          <Row label="Status"   value={<span className="text-[var(--status-success)]">Connected</span>} />
          {status.version && <Row label="Version"  value={`v${status.version}`} />}
          <Row label="Endpoint" value={OPENCLAW_GATEWAY_URL} />
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => openInBrowser(OPENCLAW_GATEWAY_URL)}
      >
        <ArrowSquareOut size={14} />
        Open gateway in browser
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Text variant="caption" className="text-[var(--text-secondary)]">{label}</Text>
      <Text variant="code" className="text-[var(--text-primary)] text-right">{value}</Text>
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
    <div className="h-full flex items-center justify-center p-8 bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="max-w-md w-full flex flex-col items-center text-center gap-5 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-8">
        <div className="text-[var(--status-error)]">
          <Warning size={48} />
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">OpenClaw Not Running</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Gateway unreachable at {OPENCLAW_GATEWAY_URL}
          </p>
        </div>

        <div className="w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-left space-y-1.5">
          <Text variant="label" className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] block mb-2">
            Start OpenClaw
          </Text>
          <div
            className="font-mono text-xs p-2 rounded-lg"
            style={{ backgroundColor: 'var(--surface-active)', color: 'var(--text-primary)' }}
          >
            openclaw gateway --port 18789
          </div>
          <Text variant="caption" className="text-[var(--text-tertiary)] block">
            First-time setup: openclaw onboard --install-daemon
          </Text>
          <Text variant="caption" className="text-[var(--text-tertiary)] block">
            Override URL: set <code>window.__ALLTERNIT_OPENCLAW_URL__</code>
          </Text>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {miniApps && (
            <Button onClick={install} disabled={Boolean(working)}>
              {working === 'install' ? 'Installing…' : 'Install or update'}
            </Button>
          )}
          {miniApps && (
            <Button variant="outline" onClick={start} disabled={Boolean(working)}>
              {working === 'start' ? 'Starting…' : 'Start gateway'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={retry}
            disabled={retrying}
          >
            <ArrowsClockwise size={14} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Checking…' : 'Retry Connection'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openInBrowser('https://github.com/openclaw/openclaw')}
          >
            <ArrowSquareOut size={14} />
            GitHub
          </Button>
        </div>

        {error && (
          <p className="text-xs text-[var(--status-error)] bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
