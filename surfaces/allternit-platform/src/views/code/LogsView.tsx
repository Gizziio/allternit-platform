import React, { useState, useEffect } from 'react';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import {
  Funnel,
  DownloadSimple,
  Trash,
} from '@phosphor-icons/react';

interface LogEntry {
  id: string;
  timestamp: number;
  level: string;
  message: string;
  source: string;
  runId?: string;
}

export function LogsView() {
  const { 
    logs,
    clearLogs,
    fetchLedgerEvents,
  } = useUnifiedStore();

  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Fetch ledger events on mount
  useEffect(() => {
    fetchLedgerEvents(50);
  }, [fetchLedgerEvents]);

  const filteredLogs = logs.filter((log: LogEntry) => {
    const matchesSearch = filter === '' || 
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.runId?.toLowerCase().includes(filter.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesSource = sourceFilter === 'all' || log.source === sourceFilter;
    return matchesSearch && matchesLevel && matchesSource;
  });

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'var(--bg-primary)'
    }}>
      {/* Toolbar */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: 12,
        alignItems: 'center'
      }}>
        <div style={{ 
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6
        }}>
          <Funnel size={14} color="#888" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter logs..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none'
            }}
          />
        </div>
        
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontSize: 13
          }}
        >
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontSize: 13
          }}
        >
          <option value="all">All Sources</option>
          <option value="local">Local</option>
          <option value="rails">Rails</option>
        </select>

        <button
          onClick={handleExport}
          style={{
            padding: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Export logs"
        >
          <DownloadSimple size={16} color="#888" />
        </button>

        <button
          onClick={clearLogs}
          style={{
            padding: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Clear logs"
        >
          <Trash size={16} color="#888" />
        </button>
      </div>

      {/* Log List */}
      <div style={{ 
        flex: 1,
        overflow: 'auto',
        padding: '8px 0'
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ 
            padding: 40, 
            textAlign: 'center', 
            color: '#666' 
          }}>
            No logs match your filters
          </div>
        ) : (
          filteredLogs.map((log: LogEntry) => (
            <div 
              key={log.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '6px 16px',
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.6,
                borderBottom: '1px solid rgba(255,255,255,0.03)'
              }}
            >
              <span style={{ 
                opacity: 0.5, 
                minWidth: 80,
                fontSize: 11
              }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span style={{ 
                color: getLevelColor(log.level), 
                fontWeight: 700, 
                width: 50,
                textTransform: 'uppercase'
              }}>
                {log.level}
              </span>
              <span style={{ 
                color: getSourceColor(log.source),
                width: 50,
                fontSize: 10,
                opacity: 0.7
              }}>
                [{log.source}]
              </span>
              <span style={{ 
                color: 'var(--text-secondary)', 
                flex: 1,
                wordBreak: 'break-word'
              }}>
                {log.runId && <span style={{ opacity: 0.5, marginRight: 8 }}>[{log.runId}]</span>}
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getLevelColor(level: string): string {
  switch (level) {
    case 'debug': return '#888';
    case 'info': return '#34c759';
    case 'warn': return '#ff9500';
    case 'error': return '#ff3b30';
    default: return '#888';
  }
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'rails': return '#0a84ff';
    case 'local': return '#888';
    default: return '#888';
  }
}
