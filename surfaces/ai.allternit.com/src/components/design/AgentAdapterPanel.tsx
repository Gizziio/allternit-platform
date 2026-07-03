"use client";
import React, { useEffect, useState } from 'react';
import { Plug, ArrowsClockwise, CheckCircle, XCircle } from '@phosphor-icons/react';
import { detectAdapters, listAdapters, type AdapterKind, type AdapterDetectionResult, spawnAdapter } from '../../lib/design/agent-adapters-api';

export function AgentAdapterPanel() {
  const [kinds, setKinds] = useState<AdapterKind[]>([]);
  const [detected, setDetected] = useState<AdapterDetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [spawning, setSpawning] = useState<string | null>(null);

  useEffect(() => {
    listAdapters().then((res) => setKinds(res.adapters));
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const result = await detectAdapters();
      setDetected(result);
    } finally {
      setLoading(false);
    }
  }

  async function handleSpawn(kind: string) {
    setSpawning(kind);
    try {
      await spawnAdapter({ kind });
    } finally {
      setSpawning(null);
    }
  }

  return (
    <div style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 12, background: 'var(--bg-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plug size={14} color="var(--accent-primary)" weight="bold" />
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>Agent Adapters</span>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          {loading ? <ArrowsClockwise size={12} /> : 'Detect'}
        </button>
      </div>

      {detected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {kinds.map((kind) => {
            const isAvailable = detected.available.includes(kind.id);
            return (
              <div key={kind.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                {isAvailable ? (
                  <CheckCircle size={12} color="#22c55e" weight="fill" />
                ) : (
                  <XCircle size={12} color="#ef4444" weight="fill" />
                )}
                <div style={{ flex: 1, color: 'var(--text-primary)' }}>
                  <div style={{ fontWeight: 700 }}>{kind.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{kind.runtime}</div>
                </div>
                {isAvailable && (
                  <button
                    type="button"
                    onClick={() => handleSpawn(kind.id)}
                    disabled={spawning === kind.id}
                    style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    {spawning === kind.id ? '…' : 'Spawn'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          Click Detect to scan for available agent runtimes.
        </div>
      )}
    </div>
  );
}
