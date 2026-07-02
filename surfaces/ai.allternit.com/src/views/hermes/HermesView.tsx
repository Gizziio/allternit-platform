'use client';

/**
 * HermesView — Dedicated view for the Allternit Hermes connector runtime
 *
 * Hermes is a first-class Allternit kernel (connector and messaging runtime).
 * This view talks directly to the Hermes process on localhost:18790 — NOT
 * routed through allternit-api or Gizzi.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Warning,
  ArrowsClockwise,
  Plugs,
  ArrowSquareOut,
  CheckCircle,
  XCircle,
  CircleNotch,
  Lightning,
  Gear,
  Globe,
  Info,
} from '@phosphor-icons/react';
import { openInBrowser } from '@/lib/openInBrowser';

// ============================================================================
// Config
// ============================================================================

const HERMES_BASE_URL = 'http://localhost:18790';
const MANIFEST_PATH = '/.well-known/allternit-app.json';
const HEALTH_INTERVAL_MS = 10000;

// ============================================================================
// Types
// ============================================================================

interface HermesManifest {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  category?: string;
  capabilities?: string[];
  endpoints?: Record<string, string>;
}

interface HermesStatus {
  online: boolean;
  manifest: HermesManifest | null;
}

type HermesTab = 'connectors' | 'ui' | 'status';

// ============================================================================
// Health check
// ============================================================================

async function probeHermes(): Promise<HermesStatus> {
  try {
    const res = await fetch(`${HERMES_BASE_URL}${MANIFEST_PATH}`, {
      signal: AbortSignal.timeout(3000),
      mode: 'cors',
    });
    if (!res.ok) {
      return { online: true, manifest: null };
    }
    const manifest: HermesManifest = await res.json().catch(() => ({}));
    return { online: true, manifest };
  } catch {
    try {
      const h = await fetch(`${HERMES_BASE_URL}/health`, {
        signal: AbortSignal.timeout(2000),
        mode: 'cors',
      });
      return { online: h.ok, manifest: null };
    } catch {
      return { online: false, manifest: null };
    }
  }
}

// ============================================================================
// Main view
// ============================================================================

export function HermesView() {
  const [status, setStatus] = useState<HermesStatus>({ online: false, manifest: null });
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<HermesTab>('connectors');

  const recheck = useCallback(async () => {
    setChecking(true);
    const s = await probeHermes();
    setStatus(s);
    setChecking(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const s = await probeHermes();
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
          <CircleNotch size={28} className="mx-auto animate-spin" />
          <p className="text-sm">Connecting to Hermes…</p>
        </div>
      </div>
    );
  }

  if (!status.online) {
    return <HermesOffline onRetry={recheck} />;
  }

  const name    = status.manifest?.name    ?? 'Hermes';
  const version = status.manifest?.version ?? null;

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
          <Plugs size={20} style={{ color: 'var(--accent-primary)' }} />
          <span className="font-semibold text-sm">{name}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(120,220,100,0.15)', color: '#78dc64' }}
          >
            Connected{version ? ` · v${version}` : ''}
          </span>
        </div>

        <HermesTabBar active={activeTab} onChange={setActiveTab} />

        <button type="button"
          onClick={() => openInBrowser(HERMES_BASE_URL)}
          className="size-7 flex items-center justify-center rounded-lg border-none cursor-pointer transition-colors"
          style={{ background: 'transparent', color: 'var(--ui-text-muted)' }}
          title="Open Hermes in browser"
        >
          <ArrowSquareOut size={15} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'connectors' && <ConnectorsTab manifest={status.manifest} />}
        {activeTab === 'ui'         && <HermesUiTab />}
        {activeTab === 'status'     && <HermesStatusTab status={status} />}
      </div>
    </div>
  );
}

// ============================================================================
// Tab bar
// ============================================================================

const TABS: { id: HermesTab; label: string; icon: React.ElementType }[] = [
  { id: 'connectors', label: 'Connectors', icon: Plugs },
  { id: 'ui',         label: 'UI',         icon: Globe },
  { id: 'status',     label: 'Status',     icon: Gear },
];

function HermesTabBar({ active, onChange }: { active: HermesTab; onChange: (t: HermesTab) => void }) {
  return (
    <div className="flex gap-1">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button type="button"
          key={id}
          onClick={() => onChange(id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: active === id ? 'var(--surface-active)' : 'transparent',
            color: active === id ? 'var(--ui-text-primary)' : 'var(--ui-text-muted)',
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
// Connectors tab
// ============================================================================

interface Connector {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
}

function ConnectorsTab({ manifest }: { manifest: HermesManifest | null }) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(Boolean(manifest?.endpoints?.connectors));
  const [fetchError, setFetchError] = useState(false);
  const [prevManifest, setPrevManifest] = useState(manifest);
  
  if (manifest !== prevManifest) {
    setPrevManifest(manifest);
    setConnectors([]);
    setFetchError(false);
    setLoading(Boolean(manifest?.endpoints?.connectors));
  }

  useEffect(() => {
    const endpoint = manifest?.endpoints?.connectors;
    if (!endpoint) return;

    const controller = new AbortController();

    (async () => {
      try {
        const r = await fetch(endpoint, { mode: 'cors', signal: controller.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const list: Connector[] = Array.isArray(data?.connectors) ? data.connectors
          : Array.isArray(data) ? data
          : [];
        setConnectors(list);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setFetchError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [manifest]);

  return (
    <div className="h-full flex flex-col">
      <div
        className="shrink-0 px-5 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {loading ? 'Loading…'
            : fetchError ? 'Connectors'
            : `${connectors.length} connector${connectors.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading && (
          <div className="flex items-center justify-center py-16 opacity-40">
            <CircleNotch size={22} className="animate-spin" />
          </div>
        )}

        {!loading && fetchError && (
          <div
            className="rounded-xl p-5 flex items-start gap-3"
            style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-subtle)' }}
          >
            <Info size={16} style={{ color: 'var(--ui-text-muted)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-medium mb-1">Connector list unavailable</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Could not fetch from the connectors endpoint — the API shape may differ from what
                Hermes reports. Check the Status tab for the configured endpoints.
              </p>
            </div>
          </div>
        )}

        {!loading && !fetchError && connectors.length === 0 && (
          <div
            className="rounded-xl p-5 flex items-start gap-3"
            style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-subtle)' }}
          >
            <Info size={16} style={{ color: 'var(--ui-text-muted)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-medium mb-1">No connectors configured</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Add connectors via the Hermes config file or use the UI tab to manage them through
                the Hermes interface.
              </p>
            </div>
          </div>
        )}

        {connectors.map((c) => (
          <ConnectorRow key={c.id} connector={c} />
        ))}

        {/* Capabilities from manifest */}
        {manifest?.capabilities && manifest.capabilities.length > 0 && (
          <div className="mt-6">
            <div
              className="text-xs font-semibold mb-3 uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Capabilities
            </div>
            <div className="flex flex-wrap gap-2">
              {manifest.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--surface-active)',
                    color: 'var(--ui-text-secondary)',
                  }}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectorRow({ connector }: { connector: Connector }) {
  const Icon = connector.status === 'connected' ? CheckCircle
    : connector.status === 'error' ? XCircle
    : Lightning;
  const color = connector.status === 'connected' ? '#78dc64'
    : connector.status === 'error' ? '#f87171'
    : 'var(--text-tertiary)';

  return (
    <div
      className="flex items-center gap-3 p-3 px-4 rounded-xl mb-2"
      style={{
        backgroundColor: 'var(--surface-hover)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <Icon size={15} style={{ color, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{connector.name}</div>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{connector.type}</div>
      </div>
      <span
        className="text-xs px-2 py-0.5 rounded-full"
        style={{
          backgroundColor: connector.status === 'connected' ? 'rgba(120,220,100,0.12)' : 'var(--surface-active)',
          color,
        }}
      >
        {connector.status}
      </span>
    </div>
  );
}

// ============================================================================
// UI tab (iframe into Hermes)
// ============================================================================

function HermesUiTab() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  const handleLoad = useCallback(() => setLoading(false), []);
  const handleError = useCallback(() => { setLoading(false); setIframeError(true); }, []);

  if (iframeError) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-3 max-w-xs">
          <XCircle size={28} className="mx-auto" style={{ color: '#f87171' }} />
          <p className="text-sm font-medium">Could not load Hermes UI</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            The Hermes interface may be blocked by browser security policy in this context.
          </p>
          <button type="button"
            onClick={() => openInBrowser(HERMES_BASE_URL)}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--surface-active)',
              color: 'var(--text-primary)',
              border: 'none',
              cursor: 'pointer',
            }}
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
            <CircleNotch size={24} className="animate-spin" />
            <p className="text-sm">Loading Hermes UI…</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={HERMES_BASE_URL}
        className="w-full h-full border-0"
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="Hermes UI"
      />
    </div>
  );
}

// ============================================================================
// Status tab
// ============================================================================

function HermesStatusTab({ status }: { status: HermesStatus }) {
  const m = status.manifest;
  return (
    <div className="p-6 max-w-lg mx-auto space-y-4 pt-10">
      <div
        className="p-4 rounded-xl space-y-3"
        style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-subtle)' }}
      >
        <div
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-secondary)' }}
        >
          Service Info
        </div>
        <StatusRow label="Status"   value={<span style={{ color: '#78dc64' }}>Online</span>} />
        {m?.name        && <StatusRow label="Name"        value={m.name} />}
        {m?.version     && <StatusRow label="Version"     value={`v${m.version}`} />}
        {m?.description && <StatusRow label="Description" value={m.description} />}
        {m?.category    && <StatusRow label="Category"    value={m.category} />}
        <StatusRow label="Endpoint"  value={HERMES_BASE_URL} />
      </div>

      {m?.endpoints && Object.keys(m.endpoints).length > 0 && (
        <div
          className="p-4 rounded-xl space-y-3"
          style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            API Endpoints
          </div>
          {Object.entries(m.endpoints).map(([key, url]) => (
            <StatusRow key={key} label={key} value={<span className="font-mono text-xs">{url}</span>} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ============================================================================
// Offline state
// ============================================================================

function HermesOffline({ onRetry }: { onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);

  const retry = useCallback(async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  }, [onRetry]);

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-sm w-full space-y-5">
        <div className="flex items-center gap-3">
          <Warning size={24} style={{ color: '#f87171' }} />
          <div>
            <div className="font-semibold">Hermes Not Running</div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Service unreachable at {HERMES_BASE_URL}
            </div>
          </div>
        </div>

        <div
          className="p-4 rounded-xl text-sm space-y-2"
          style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="font-medium mb-3">To start Hermes:</div>
          <div
            className="font-mono text-xs p-2.5 rounded-lg"
            style={{ backgroundColor: 'var(--surface-active)', color: 'var(--text-primary)' }}
          >
            hermes start
          </div>
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            or: hermes daemon --port 18790
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button"
            onClick={retry}
            disabled={retrying}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-none cursor-pointer text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--surface-active)', color: 'var(--text-primary)' }}
          >
            <ArrowsClockwise size={14} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Checking…' : 'Retry'}
          </button>
          <button type="button"
            onClick={() => openInBrowser('https://github.com/allternit/hermes')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-none cursor-pointer text-sm"
            style={{ background: 'transparent', color: 'var(--text-secondary)' }}
          >
            <ArrowSquareOut size={14} />
            GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
