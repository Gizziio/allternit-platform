'use client';

import React, { useState } from 'react';
import { Play, ArrowClockwise, CheckCircle, XCircle, Spinner } from '@phosphor-icons/react';
import { useTeamSession } from '@/lib/cowork/useTeamSession';

export function AgentExecutionResultsPanel() {
  const { task, results, summary, isRunning, error, execute, reset } = useTeamSession();
  const [inputTask, setInputTask] = useState('');

  const handleRun = () => {
    const t = inputTask.trim();
    if (!t || isRunning) return;
    execute(t);
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--ui-text-primary)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--ui-border-muted)', flexShrink: 0 }}>
        <h2 style={{
          fontFamily: "'Allternit Serif', Georgia, ui-serif, serif",
          fontSize: 18,
          fontWeight: 600,
          margin: '0 0 4px',
        }}>
          Team Execute
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ui-text-muted)' }}>
          Run a task across all configured personas in parallel
        </p>
      </div>

      {/* Task input */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--ui-border-muted)', flexShrink: 0 }}>
        <textarea
          value={inputTask}
          onChange={(e) => setInputTask(e.target.value)}
          disabled={isRunning}
          placeholder="Describe the task for all agents to work on simultaneously…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRun();
          }}
          style={{
            width: '100%',
            minHeight: 80,
            padding: '10px 12px',
            background: 'var(--surface-raised, rgba(255,255,255,0.04))',
            border: '1px solid var(--ui-border-muted)',
            borderRadius: 8,
            color: 'var(--ui-text-primary)',
            fontSize: 13,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          {(results.length > 0 || error) && (
            <button onClick={reset} style={btnStyle('ghost')}>
              <ArrowClockwise size={14} />
              Reset
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={isRunning || !inputTask.trim()}
            style={btnStyle('primary', isRunning || !inputTask.trim())}
          >
            {isRunning ? <Spinner size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
            {isRunning ? 'Running…' : 'Run (⌘↵)'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ margin: '12px 24px 0', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {isRunning && results.length === 0 && (
          <div style={{ color: 'var(--ui-text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Spinner size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Agents working on: <em>{task}</em>
          </div>
        )}

        {summary && (
          <div style={{
            display: 'flex',
            gap: 16,
            marginBottom: 16,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--ui-border-muted)',
            borderRadius: 8,
            fontSize: 13,
          }}>
            <span style={{ color: 'var(--ui-text-muted)' }}>{summary.total} agents</span>
            <span style={{ color: '#4ade80' }}>{summary.completed} completed</span>
            {summary.errors > 0 && <span style={{ color: '#f87171' }}>{summary.errors} errors</span>}
          </div>
        )}

        {results.map((result) => (
          <AgentResultCard key={result.personaId} result={result} />
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AgentResultCard({ result }: { result: import('@/lib/cowork/useTeamSession').TeamAgentResult }) {
  const [expanded, setExpanded] = useState(true);
  const isOk = result.status === 'completed';

  return (
    <div style={{
      marginBottom: 12,
      border: `1px solid ${isOk ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.2)'}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.03)',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ui-text-primary)',
          textAlign: 'left',
        }}
      >
        {isOk
          ? <CheckCircle size={15} color="#4ade80" weight="fill" />
          : <XCircle size={15} color="#f87171" weight="fill" />}
        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{result.personaName}</span>
        <span style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>{(result.durationMs / 1000).toFixed(1)}s</span>
        <span style={{ fontSize: 11, color: 'var(--ui-text-muted)', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {isOk ? (
            <pre style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--ui-text-secondary)',
              fontFamily: 'inherit',
            }}>
              {result.output || '(no output)'}
            </pre>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: '#f87171' }}>{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function btnStyle(variant: 'primary' | 'ghost', disabled = false): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    fontSize: 12,
    fontWeight: 600,
    border: variant === 'primary' ? 'none' : '1px solid var(--ui-border-muted)',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: variant === 'primary' ? 'var(--accent-primary, #7c6af7)' : 'transparent',
    color: variant === 'primary' ? '#fff' : 'var(--ui-text-secondary)',
    transition: 'opacity 0.15s',
  };
}
