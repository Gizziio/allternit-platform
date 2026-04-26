"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BookBookmark, CheckCircle, WarningCircle, FileText } from '@phosphor-icons/react';
import { fetchH5iClaims, fetchH5iSummaries, type H5iClaim, type H5iSummary } from '@/lib/h5i/client';

interface CodeCanvasTileKnowledgeProps {
  workspacePath: string;
}

export function CodeCanvasTileKnowledge({ workspacePath }: CodeCanvasTileKnowledgeProps) {
  const [claims, setClaims] = useState<H5iClaim[]>([]);
  const [summaries, setSummaries] = useState<H5iSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'claims' | 'summaries'>('claims');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [claimsData, summariesData] = await Promise.all([
        fetchH5iClaims(workspacePath).catch(() => ({ success: false, claims: [] as H5iClaim[] })),
        fetchH5iSummaries(workspacePath).catch(() => ({ success: false, summaries: [] as H5iSummary[] })),
      ]);
      setClaims(claimsData.claims ?? []);
      setSummaries(summariesData.summaries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge');
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setTab('claims')}
          style={{
            flex: 1,
            padding: '4px 8px',
            borderRadius: 6,
            border: 'none',
            background: tab === 'claims' ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: tab === 'claims' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <BookBookmark size={12} />
          Claims ({claims.length})
        </button>
        <button
          onClick={() => setTab('summaries')}
          style={{
            flex: 1,
            padding: '4px 8px',
            borderRadius: 6,
            border: 'none',
            background: tab === 'summaries' ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: tab === 'summaries' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <FileText size={12} />
          Summaries ({summaries.length})
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>
            <span className="animate-spin" style={{ display: 'inline-block', marginRight: 8 }}>⟳</span>
            Loading...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 11,
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}

        {tab === 'claims' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {claims.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                No claims yet. Claims are pinned facts about the codebase.
              </div>
            )}
            {claims.map((claim) => (
              <div
                key={claim.id}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: claim.status === 'live' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                  border: `1px solid ${claim.status === 'live' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {claim.status === 'live' ? (
                    <CheckCircle size={12} color="#10b981" />
                  ) : (
                    <WarningCircle size={12} color="#ef4444" />
                  )}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: claim.status === 'live' ? '#10b981' : '#ef4444',
                    }}
                  >
                    {claim.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {claim.text}
                </div>
                {claim.paths.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {claim.paths.map((p) => (
                      <span
                        key={p}
                        style={{
                          fontSize: 10,
                          fontFamily: 'monospace',
                          color: 'var(--text-muted)',
                          background: 'rgba(255,255,255,0.04)',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'summaries' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {summaries.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                No summaries yet. Summaries are per-file orientation notes.
              </div>
            )}
            {summaries.map((summary) => (
              <div
                key={summary.path}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: summary.valid ? 'rgba(59,130,246,0.06)' : 'rgba(239,68,68,0.06)',
                  border: `1px solid ${summary.valid ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <FileText size={12} color={summary.valid ? '#3b82f6' : '#ef4444'} />
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', flex: 1 }}>
                    {summary.path}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: summary.valid ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                      color: summary.valid ? '#3b82f6' : '#ef4444',
                    }}
                  >
                    {summary.valid ? 'Valid' : 'Stale'}
                  </span>
                </div>
                {summary.text && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {summary.text}
                  </div>
                )}
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                  blob:{summary.blobOid.slice(0, 8)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
