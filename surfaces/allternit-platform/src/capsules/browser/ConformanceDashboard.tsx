"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { getPlatformComputerUseBaseUrl } from '../../integration/computer-use-engine';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface SuiteResult {
  passed: number;
  total: number;
  grade: string;
}

interface AdapterGrade {
  adapter_id: string;
  suite_a?: SuiteResult;
  suite_d?: SuiteResult;
  suite_f?: SuiteResult;
  overall_grade: string;
}

interface ConformanceResultsPayload {
  adapters?: AdapterGrade[];
}

type Suite = 'A' | 'D' | 'F';

// ─────────────────────────────────────────────────────────────
// Grade badge helpers
// ─────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  production: { bg: 'var(--status-success-bg)',   border: 'rgba(34,197,94,0.35)',  color: 'var(--status-success)' },
  beta:       { bg: 'var(--status-warning-bg)',  border: 'rgba(245,158,11,0.35)', color: 'var(--status-warning)' },
  experimental:{ bg: 'var(--status-error-bg)',  border: 'rgba(239,68,68,0.35)',  color: 'var(--status-error)' },
  unknown:    { bg: 'var(--surface-hover)', border: 'var(--ui-border-default)', color: 'rgba(255,255,255,0.3)' },
};

function gradeStyle(grade: string): React.CSSProperties {
  const normalized = grade.toLowerCase();
  const style = GRADE_COLORS[normalized] ?? GRADE_COLORS.unknown;
  return {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: 4,
    background: style.bg,
    border: `1px solid ${style.border}`,
    color: style.color,
    fontSize: 9,
    fontWeight: 700,
    fontFamily: 'monospace',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  };
}

function passRateLabel(suite?: SuiteResult): string {
  if (!suite) return '—';
  return `${suite.passed}/${suite.total}`;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ConformanceDashboard() {
  const [grades, setGrades] = useState<AdapterGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const fetchGrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = getPlatformComputerUseBaseUrl();
      const res = await fetch(`${baseUrl}/v1/conformance/results`);
      if (res.status === 404) {
        setError('Gateway not configured');
        setGrades([]);
        return;
      }
      if (!res.ok) {
        setError(`Fetch failed: ${res.status} ${res.statusText}`);
        setGrades([]);
        return;
      }
      const data = await res.json() as ConformanceResultsPayload;
      setGrades(data.adapters ?? []);
    } catch (e) {
      setError(`Gateway not reachable: ${String(e)}`);
      setGrades([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchGrades(); }, [fetchGrades]);

  const runSuite = useCallback(async (suite: Suite) => {
    const key = `suite-${suite}`;
    setRunning(key);
    try {
      const baseUrl = getPlatformComputerUseBaseUrl();
      const res = await fetch(`${baseUrl}/v1/conformance/run/${suite}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        // Surface the error but don't crash
        const body = await res.text().catch(() => '');
        setError(`Suite ${suite} run failed: ${res.status}${body ? ` — ${body.slice(0, 80)}` : ''}`);
        return;
      }
      // Poll for updated results after a brief delay
      await new Promise<void>((resolve) => setTimeout(resolve, 1200));
      await fetchGrades();
    } catch (e) {
      setError(`Suite ${suite} run error: ${String(e)}`);
    } finally {
      setRunning(null);
    }
  }, [fetchGrades]);

  // ── Render ────────────────────────────────────────────────

  return (
    <div style={{
      background: '#0a0908',
      borderTop: '1px solid color-mix(in srgb, var(--accent-primary) 10%, transparent)',
      padding: 10,
      fontFamily: 'monospace',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(212,176,140,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Conformance
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['A', 'D', 'F'] as Suite[]).map((s) => (
            <button
              key={s}
              onClick={() => void runSuite(s)}
              disabled={running !== null}
              style={{
                padding: '2px 7px',
                fontSize: 9,
                fontFamily: 'monospace',
                fontWeight: 700,
                background: running === `suite-${s}` ? 'rgba(99,252,241,0.15)' : 'var(--surface-hover)',
                border: `1px solid ${running === `suite-${s}` ? 'rgba(99,252,241,0.4)' : 'var(--ui-border-default)'}`,
                borderRadius: 4,
                color: running === `suite-${s}` ? '#63fcf1' : 'rgba(255,255,255,0.35)',
                cursor: running !== null ? 'not-allowed' : 'pointer',
                opacity: running !== null && running !== `suite-${s}` ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              {running === `suite-${s}` ? '…' : `Run ${s}`}
            </button>
          ))}
          <button
            onClick={() => void fetchGrades()}
            disabled={loading}
            style={{
              padding: '2px 7px',
              fontSize: 9,
              fontFamily: 'monospace',
              background: 'var(--surface-hover)',
              border: '1px solid var(--ui-border-default)',
              borderRadius: 4,
              color: 'rgba(255,255,255,0.3)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            ↺
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '5px 8px',
          background: 'var(--status-error-bg)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 5,
          fontSize: 9,
          color: 'rgba(239,68,68,0.75)',
          marginBottom: 8,
        }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && grades.length === 0 && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', padding: '6px 0' }}>
          Loading…
        </div>
      )}

      {/* Empty state */}
      {!loading && grades.length === 0 && !error && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', padding: '6px 0' }}>
          No conformance results yet. Run a suite to generate data.
        </div>
      )}

      {/* Results table */}
      {grades.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 9,
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid color-mix(in srgb, var(--accent-primary) 10%, transparent)' }}>
                {['Adapter', 'Suite A', 'Suite D', 'Suite F', 'Grade'].map((h) => (
                  <th key={h} style={{
                    padding: '3px 6px',
                    textAlign: 'left',
                    color: 'rgba(212,176,140,0.45)',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grades.map((adapter) => (
                <tr
                  key={adapter.adapter_id}
                  style={{ borderBottom: '1px solid var(--surface-hover)' }}
                >
                  <td style={{
                    padding: '4px 6px',
                    color: 'rgba(212,176,140,0.8)',
                    fontFamily: 'monospace',
                    maxWidth: 140,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {adapter.adapter_id}
                  </td>
                  {(['suite_a', 'suite_d', 'suite_f'] as const).map((sk) => {
                    const suite = adapter[sk];
                    return (
                      <td key={sk} style={{ padding: '4px 6px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                        {suite ? (
                          <>
                            <span style={{ marginRight: 4 }}>{passRateLabel(suite)}</span>
                            <span style={gradeStyle(suite.grade)}>{suite.grade}</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--ui-border-strong)' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ padding: '4px 6px' }}>
                    <span style={gradeStyle(adapter.overall_grade)}>{adapter.overall_grade}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ConformanceDashboard;
