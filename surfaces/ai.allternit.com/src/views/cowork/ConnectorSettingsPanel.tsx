'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, Warning, ArrowClockwise } from '@phosphor-icons/react';
import type { ConnectorDefinition } from '@/lib/cowork/connectors-manifest';
import type { ConnectorCategory } from '@/lib/cowork/connectors-manifest';

type ConnectorWithStatus = ConnectorDefinition & {
  status: 'connected' | 'unconfigured';
  missingVars: string[];
};

type Summary = { total: number; connected: number; unconfigured: number };

const CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  comms: 'Communications',
  devtools: 'Developer Tools',
  productivity: 'Productivity',
  crm: 'CRM',
  infra: 'Infrastructure',
};

const CATEGORY_ORDER: ConnectorCategory[] = ['comms', 'devtools', 'productivity', 'crm', 'infra'];

export function ConnectorSettingsPanel() {
  const [connectors, setConnectors] = useState<ConnectorWithStatus[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/v1/cowork/connectors')
      .then((r) => r.json())
      .then((data: { connectors: ConnectorWithStatus[]; summary: Summary }) => {
        setConnectors(data.connectors ?? []);
        setSummary(data.summary ?? null);
      })
      .catch(() => setError('Failed to load connectors'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const grouped = CATEGORY_ORDER.reduce<Record<ConnectorCategory, ConnectorWithStatus[]>>(
    (acc, cat) => {
      acc[cat] = connectors.filter((c) => c.category === cat);
      return acc;
    },
    {} as Record<ConnectorCategory, ConnectorWithStatus[]>,
  );

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: '24px 28px',
      color: 'var(--ui-text-primary)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
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
          {summary && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ui-text-muted)' }}>
              {summary.connected} of {summary.total} connectors configured
            </p>
          )}
        </div>
        <button
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

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8,
          color: '#f87171',
          fontSize: 13,
          marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {loading && !connectors.length ? (
        <div style={{ color: 'var(--ui-text-muted)', fontSize: 13 }}>Loading connectors…</div>
      ) : (
        CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items.length) return null;
          return (
            <section key={cat} style={{ marginBottom: 28 }}>
              <h3 style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ui-text-muted)',
                margin: '0 0 10px',
              }}>
                {CATEGORY_LABELS[cat]}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((connector) => (
                  <ConnectorRow key={connector.id} connector={connector} />
                ))}
              </div>
            </section>
          );
        })
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function ConnectorRow({ connector }: { connector: ConnectorWithStatus }) {
  const isConnected = connector.status === 'connected';

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
      {/* Status icon */}
      <div style={{ paddingTop: 2, flexShrink: 0 }}>
        {isConnected ? (
          <CheckCircle size={16} color="#22c55e" weight="fill" />
        ) : (
          <Warning size={16} color="#f59e0b" weight="fill" />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{connector.name}</span>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '1px 6px',
            borderRadius: 4,
            background: isConnected ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
            color: isConnected ? '#4ade80' : '#fbbf24',
          }}>
            {isConnected ? 'Connected' : 'Unconfigured'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-muted)' }}>{connector.description}</p>

        {/* Missing vars hint */}
        {!isConnected && connector.missingVars.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {connector.missingVars.map((key) => (
              <code key={key} style={{
                fontSize: 12,
                padding: '1px 6px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4,
                color: 'var(--ui-text-secondary)',
                fontFamily: 'monospace',
              }}>
                {key}
              </code>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
