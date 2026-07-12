'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Warning, ArrowClockwise, MagnifyingGlass, Trash } from '@phosphor-icons/react';
import {
  listOwnedConnectors,
  connectOwned,
  disconnectOwned,
  type OwnedConnector,
  type OwnedConnectStatus,
} from '@/lib/design/owned-connector';

// Backed by Allternit's real connector standard (ADR-0043:
// cmd/allternit-api/src/connector_routes.rs + the open-connector sidecar) —
// 1,000+ real connectors, not the old 15-entry env-var-only manifest this
// panel used to read. The catalog is large, so render is capped + searchable
// the same way views/design/ConnectorModal.tsx handles it.
const INITIAL_VISIBLE_COUNT = 60;
const VISIBLE_COUNT_STEP = 100;

export function ConnectorSettingsPanel() {
  const [connectors, setConnectors] = useState<OwnedConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    setError(null);
    listOwnedConnectors()
      .then((list) => setConnectors(list))
      .catch(() => setError('Failed to load connectors'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connectors;
    return connectors.filter((c) =>
      [c.id, c.name, c.category, c.description].some((v) => (v || '').toLowerCase().includes(q)),
    );
  }, [connectors, query]);

  useEffect(() => { setVisibleCount(INITIAL_VISIBLE_COUNT); }, [query, connectors]);

  const isSearching = query.trim().length > 0;
  const visible = isSearching ? filtered : filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;
  const connectedCount = connectors.filter((c) => c.connection?.status === 'connected').length;

  function setInline(id: string, msg: string) {
    setNote((prev) => ({ ...prev, [id]: msg }));
  }

  async function handleConnect(c: OwnedConnector) {
    setBusy(c.id);
    setInline(c.id, '');
    try {
      const r: OwnedConnectStatus = await connectOwned(c.id);
      switch (r.status) {
        case 'connected':
          load();
          break;
        case 'authorization_required': {
          const url = (r as { authorize_url?: string }).authorize_url;
          if (url) window.open(url, '_blank', 'width=600,height=700');
          setInline(c.id, 'Authorize Allternit in the opened window, then click Refresh.');
          break;
        }
        default:
          setInline(c.id, (r as { message?: string }).message || `Status: ${r.status}`);
      }
    } catch (e) {
      setInline(c.id, e instanceof Error ? e.message : 'connect failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect(c: OwnedConnector) {
    setBusy(c.id);
    try {
      await disconnectOwned(c.id);
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: '24px 28px',
      color: 'var(--ui-text-primary)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{
            fontFamily: "'Allternit Serif', Georgia, ui-serif, serif",
            fontSize: 20,
            fontWeight: 600,
            margin: 0,
            marginBottom: 4,
          }}>
            Connector Registry
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ui-text-muted)' }}>
            {loading ? 'Loading…' : `${connectedCount} of ${connectors.length} connectors connected`}
          </p>
        </div>
        <button type="button"
          onClick={load}
          disabled={loading}
          style={{
            background: 'transparent',
            border: '1px solid var(--ui-border-muted)',
            borderRadius: 8,
            padding: '6px 10px',
            color: 'var(--ui-text-secondary)',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
          }}
        >
          <ArrowClockwise size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--ui-border-muted)', background: 'var(--surface-raised, rgba(255,255,255,0.03))', marginBottom: 16 }}>
        <MagnifyingGlass size={14} color="var(--ui-text-muted)" />
        <input
          aria-label="Search connectors"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${connectors.length || ''} connectors…`}
          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, outline: 'none', color: 'var(--ui-text-primary)' }}
        />
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8,
          color: 'var(--status-error)',
          fontSize: 13,
          marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {loading && !connectors.length ? (
        <div style={{ color: 'var(--ui-text-muted)', fontSize: 13 }}>Loading connectors…</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map((c) => (
              <ConnectorRow
                key={c.id}
                connector={c}
                busy={busy === c.id}
                note={note[c.id]}
                onConnect={() => handleConnect(c)}
                onDisconnect={() => handleDisconnect(c)}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ui-text-muted)', padding: 12 }}>No connectors match "{query}".</div>
          )}
          {!isSearching && remaining > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + VISIBLE_COUNT_STEP)}
              style={{ width: '100%', marginTop: 10, padding: 8, borderRadius: 10, border: '1px dashed var(--ui-border-muted)', background: 'transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--ui-text-muted)' }}
            >
              Show {Math.min(remaining, VISIBLE_COUNT_STEP)} more ({remaining} left) — or search above
            </button>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function ConnectorRow({
  connector,
  busy,
  note,
  onConnect,
  onDisconnect,
}: {
  connector: OwnedConnector;
  busy: boolean;
  note?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const isConnected = connector.connection?.status === 'connected';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '10px 14px',
      background: 'var(--surface-raised, rgba(255,255,255,0.03))',
      border: `1px solid ${isConnected ? 'rgba(34,197,94,0.15)' : 'var(--ui-border-muted)'}`,
      borderRadius: 10,
    }}>
      <div style={{ paddingTop: 2, flexShrink: 0 }}>
        {isConnected ? (
          <CheckCircle size={16} color="var(--status-success)" weight="fill" />
        ) : (
          <Warning size={16} color="var(--status-warning)" weight="fill" />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{connector.name}</span>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '1px 6px',
            borderRadius: 4,
            background: isConnected ? 'color-mix(in srgb, var(--status-success) 12%, transparent)' : 'color-mix(in srgb, var(--status-warning) 12%, transparent)',
            color: isConnected ? 'var(--status-success)' : 'var(--status-warning)',
          }}>
            {isConnected ? 'Connected' : 'Not connected'}
          </span>
          {connector.category && (
            <span style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>{connector.category}</span>
          )}
        </div>
        {connector.description && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-muted)' }}>{connector.description}</p>
        )}
        {note && (
          <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: 'var(--ui-text-secondary)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--ui-border-muted)', borderRadius: 6, padding: '6px 8px' }}>
            {note}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        {isConnected ? (
          <button type="button" onClick={onDisconnect} disabled={busy} title="Disconnect" style={{ padding: 6, borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Trash size={13} />
          </button>
        ) : (
          <button type="button" onClick={onConnect} disabled={busy} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--accent-primary, #e27c59)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? '…' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  );
}
