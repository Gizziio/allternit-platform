"use client";
import React, { useCallback, useRef, useState } from 'react';
import { Sparkle, CircleNotch, Warning, CheckCircle, XCircle, UsersThree } from '@phosphor-icons/react';
import { gizziBaseUrl } from '@/lib/agents/api-config';

type Severity = 'info' | 'minor' | 'major' | 'critical';
type Verdict = 'ship' | 'iterate';

interface Dimension {
  name: string;
  score: number;
  severity: Severity;
  findings: { role: string; text: string }[];
}
interface Suggestion {
  role: string;
  text: string;
}
interface Panelist {
  role: string;
  verdict: Verdict;
  overall: number;
  dimensions: { name: string; score: number; severity: Severity; findings: string[] }[];
  suggestions: string[];
  summary: string;
  error?: string;
}

interface CritiqueState {
  status: 'idle' | 'running' | 'done' | 'error';
  model?: { providerID: string; modelID: string };
  roster: string[];
  panelists: Panelist[];
  verdict?: Verdict;
  overall?: number;
  dimensions: Dimension[];
  suggestions: Suggestion[];
  summary?: string;
  error?: string;
}

const INITIAL: CritiqueState = {
  status: 'idle',
  roster: [],
  panelists: [],
  dimensions: [],
  suggestions: [],
};

function severityColor(sev: Severity): string {
  switch (sev) {
    case 'critical':
      return '#ef4444';
    case 'major':
      return '#f59e0b';
    case 'minor':
      return '#eab308';
    default:
      return 'var(--text-secondary)';
  }
}

function scoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

// Parse an SSE byte stream into {type, properties} events.
async function consumeSSE(
  res: Response,
  onEvent: (type: string, properties: any) => void,
  signal?: AbortSignal,
) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const env = JSON.parse(payload);
            const p = env.payload ?? env;
            if (p?.type) onEvent(p.type, p.properties ?? {});
          } catch {
            // ignore malformed frame
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function DesignCritiquePanel({ artifactHtml }: { artifactHtml: string }) {
  const [state, setState] = useState<CritiqueState>(INITIAL);
  const [panelistCount, setPanelistCount] = useState(3);
  const abortRef = useRef<AbortController | null>(null);
  const hasArtifact = Boolean(artifactHtml && artifactHtml.trim().length > 0);

  const run = useCallback(async () => {
    if (!hasArtifact) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ ...INITIAL, status: 'running' });

    try {
      const res = await fetch(`${gizziBaseUrl()}/v1/critique/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: artifactHtml, panelists: panelistCount }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`gizzi /critique/stream returned ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
      }

      await consumeSSE(
        res,
        (type, props) => {
          if (type === 'critique.start') {
            setState((s) => ({
              ...s,
              model: props.model,
              roster: props.panelists ?? [],
              panelists: (props.panelists ?? []).map((role: string) => ({
                role,
                verdict: 'iterate' as Verdict,
                overall: 0,
                dimensions: [],
                suggestions: [],
                summary: '',
                error: undefined,
                _pending: true,
              })) as any,
            }));
          } else if (type === 'critique.panelist') {
            const p: Panelist = props.panelist;
            setState((s) => {
              const next = s.panelists.filter((x: any) => x.role !== p.role);
              return { ...s, panelists: [...next, p] };
            });
          } else if (type === 'critique.done') {
            setState((s) => ({
              ...s,
              status: 'done',
              verdict: props.verdict,
              overall: props.overall,
              dimensions: props.dimensions ?? [],
              suggestions: props.suggestions ?? [],
              summary: props.summary,
            }));
          } else if (type === 'critique.error') {
            setState((s) => ({ ...s, status: 'error', error: props.message ?? 'Critique failed' }));
          }
        },
        ctrl.signal,
      );
      setState((s) => (s.status === 'running' ? { ...s, status: 'done' } : s));
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setState((s) => ({ ...s, status: 'error', error: e?.message ?? String(e) }));
    }
  }, [artifactHtml, hasArtifact, panelistCount]);

  const orderedPanelists = state.roster.length
    ? state.roster.map((role) => state.panelists.find((p: any) => p.role === role)).filter(Boolean) as any[]
    : state.panelists;

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 20, color: 'var(--text-primary)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkle size={20} weight="fill" style={{ color: 'var(--accent, #8b5cf6)' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Allternit Design Critique</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Multi-panelist review powered by your configured brain
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Panelists</label>
            <select
              value={panelistCount}
              onChange={(e) => setPanelistCount(Number(e.target.value))}
              disabled={state.status === 'running'}
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={run}
              disabled={!hasArtifact || state.status === 'running'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                background: !hasArtifact ? 'var(--surface-hover)' : 'var(--accent, #8b5cf6)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: !hasArtifact || state.status === 'running' ? 'not-allowed' : 'pointer',
                opacity: state.status === 'running' ? 0.7 : 1,
              }}
            >
              {state.status === 'running' ? <CircleNotch size={14} className="animate-spin" /> : <Sparkle size={14} weight="fill" />}
              {state.status === 'running' ? 'Reviewing…' : 'Run critique'}
            </button>
          </div>
        </div>

        {!hasArtifact && (
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              border: '1px dashed var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: 13,
            }}
          >
            Generate a design artifact on the Canvas tab first, then run a critique. The review analyzes the latest HTML
            artifact from this session.
          </div>
        )}

        {state.error && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              padding: 12,
              borderRadius: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5',
              fontSize: 12,
              marginTop: 12,
            }}
          >
            <Warning size={16} weight="fill" />
            <span>{state.error}</span>
          </div>
        )}

        {/* Verdict + model + overall */}
        {(state.status === 'done' || state.status === 'running') && state.model && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'stretch',
              marginTop: 16,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                flex: '0 0 auto',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {state.verdict === 'ship' ? (
                <CheckCircle size={22} weight="fill" style={{ color: '#22c55e' }} />
              ) : state.verdict === 'iterate' ? (
                <XCircle size={22} weight="fill" style={{ color: '#f59e0b' }} />
              ) : (
                <CircleNotch size={22} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
              )}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Verdict
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, textTransform: 'capitalize' }}>
                  {state.verdict ?? '…'}
                </div>
              </div>
            </div>

            <div
              style={{
                flex: '0 0 auto',
                minWidth: 120,
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Overall
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: state.overall != null ? scoreColor(state.overall) : 'var(--text-secondary)' }}>
                {state.overall != null ? `${state.overall}/10` : '…'}
              </div>
            </div>

            <div
              style={{
                flex: '1 1 240px',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                Brain: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{state.model.providerID}/{state.model.modelID}</span>
              </div>
              {state.summary && <div style={{ marginTop: 6 }}>{state.summary}</div>}
            </div>
          </div>
        )}

        {/* Dimension scores */}
        {state.dimensions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Dimensions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {state.dimensions.map((d) => (
                <div
                  key={d.name}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(d.score) }}>{d.score}/10</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: 'var(--surface-hover)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, (d.score / 10) * 100)}%`,
                        height: '100%',
                        background: scoreColor(d.score),
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: severityColor(d.severity) }}>
                    {d.severity}
                  </div>
                  {d.findings.length > 0 && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {d.findings.slice(0, 6).map((f, i) => (
                        <li key={i}>
                          <span style={{ color: 'var(--text-primary)' }}>{f.text}</span>
                          {state.dimensions.length > 1 && f.role && (
                            <span style={{ color: 'var(--text-secondary)' }}> · {f.role}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {state.suggestions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Suggestions</div>
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
              }}
            >
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
                {state.suggestions.map((s, i) => (
                  <li key={i}>
                    {s.text}
                    <span style={{ color: 'var(--text-secondary)' }}> · {s.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Panelists */}
        {orderedPanelists.length > 0 && (
          <div style={{ marginTop: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <UsersThree size={16} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Panelists</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {orderedPanelists.map((p: any) => (
                <div
                  key={p.role}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)',
                    opacity: p.error ? 0.8 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{p.role}</span>
                    {p._pending ? (
                      <CircleNotch size={14} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
                    ) : p.error ? (
                      <Warning size={14} weight="fill" style={{ color: '#ef4444' }} />
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: p.verdict === 'ship' ? '#22c55e' : '#f59e0b' }}>
                        {p.verdict}
                      </span>
                    )}
                  </div>
                  {p.error ? (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#fca5a5' }}>{p.error}</div>
                  ) : (
                    p.summary && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.summary}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
