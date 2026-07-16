/**
 * Unified Terminal Component
 *
 * Multi-tab terminal pane backed by the platform terminal service
 * (`/terminal/*`). Each tab is an independent shell session that streams
 * output over Server-Sent Events and accepts stdin via HTTP POST.
 *
 * The chrome is styled as a liquid-glass surface so it matches the rest of
 * Code Mode instead of the previous heavy solid-grey panels.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SquaresFour,
  Square,
  Plus,
  X,
  Terminal as TerminalIcon,
  Warning,
  ArrowsClockwise,
  GitBranch,
} from '@phosphor-icons/react';

import { createModuleLogger } from '@/lib/logger';
import { GATEWAY_BASE_URL } from '@/lib/agents/api-config';

const logger = createModuleLogger('UnifiedTerminal');

function terminalUrl(path: string): string {
  return `${GATEWAY_BASE_URL}${path}`;
}

// Dynamically import xterm only on the client side.
let Terminal: typeof import('xterm').Terminal | null = null;
let FitAddon: typeof import('xterm-addon-fit').FitAddon | null = null;

async function loadXterm() {
  if (typeof window === 'undefined') return false;
  if (Terminal && FitAddon) return true;

  const [xterm, xtermAddon] = await Promise.all([
    import('xterm'),
    import('xterm-addon-fit'),
  ]);

  Terminal = xterm.Terminal;
  FitAddon = xtermAddon.FitAddon;

  await import('xterm/css/xterm.css');
  return true;
}

type TerminalMode = 'single' | 'grid';

type TerminalTabStatus = 'connecting' | 'connected' | 'error';

interface TerminalContext {
  repoName?: string;
  branch?: string;
  shortSha?: string;
}

interface UnifiedTerminalProps {
  /** Code session id used to namespace terminal sessions. */
  sessionId?: string;
  /** Working directory the shell should start in. */
  workingDir?: string;
  terminalContext?: TerminalContext;
}

interface TerminalSession {
  id: string;
  name: string;
  remoteSessionId: string | null;
  status: TerminalTabStatus;
  errorMsg: string;
}

interface TerminalCreateResponse {
  sessionId?: string;
  session_id?: string;
  data?: { session_id?: string };
}

interface TerminalStreamMessage {
  type: string;
  data?: string;
}

function generateTabId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PTY service API
// ─────────────────────────────────────────────────────────────────────────────

function terminalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('allternit_token') : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function createTerminalSession(options: {
  cwd?: string;
  shell?: string;
  cols?: number;
  rows?: number;
}): Promise<string> {
  const response = await fetch(terminalUrl('/terminal/create'), {
    method: 'POST',
    headers: terminalHeaders(),
    body: JSON.stringify({
      shell: options.shell ?? '/bin/zsh',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as TerminalCreateResponse & { success?: boolean; message?: string; details?: string };

  if (!response.ok || body.success === false) {
    throw new Error(body.message || body.details || `Failed to create terminal: ${response.status}`);
  }

  const sessionId = body.sessionId ?? body.session_id ?? body.data?.session_id;
  if (!sessionId) {
    throw new Error('Terminal service did not return a session id');
  }
  return sessionId;
}

async function sendTerminalInput(remoteSessionId: string, data: string): Promise<void> {
  await fetch(terminalUrl(`/terminal/${remoteSessionId}/input`), {
    method: 'POST',
    headers: terminalHeaders(),
    body: JSON.stringify({ session_id: remoteSessionId, content: data }),
  });
}

async function closeTerminalSession(remoteSessionId: string): Promise<void> {
  await fetch(terminalUrl(`/terminal/${remoteSessionId}/close`), {
    method: 'POST',
    headers: terminalHeaders(),
    body: JSON.stringify({ session_id: remoteSessionId }),
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Single terminal surface
// ─────────────────────────────────────────────────────────────────────────────

export function TerminalSurface({
  remoteSessionId,
  isActive,
  onStatusChange,
}: {
  remoteSessionId: string;
  isActive: boolean;
  onStatusChange: (status: TerminalTabStatus, errorMsg?: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    loadXterm().then((loaded) => {
      if (!loaded || !mounted || !containerRef.current) return;

      const term = new Terminal!({
        cursorBlink: true,
        theme: {
          background: 'rgba(11, 17, 32, 0.55)',
          foreground: 'var(--text-primary, #f3f4f6)',
          cursor: 'var(--text-primary, #f3f4f6)',
          black: '#111827',
          red: 'var(--status-error, #ef4444)',
          green: 'var(--status-success, #10b981)',
          yellow: '#f59e0b',
          blue: 'var(--status-info, #3b82f6)',
          magenta: '#8b5cf6',
          cyan: '#22d3ee',
          white: 'var(--text-primary, #f3f4f6)',
          brightBlack: 'var(--text-tertiary, #6b7280)',
          brightRed: '#f87171',
          brightGreen: '#34d399',
          brightYellow: '#fbbf24',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#67e8f9',
          brightWhite: '#f9fafb',
        },
        fontSize: 13,
        fontFamily: 'var(--font-mono)',
        rows: 24,
        cols: 80,
        allowProposedApi: true,
      });

      term.open(containerRef.current);

      const fitAddon = new FitAddon!();
      term.loadAddon(fitAddon);

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      term.onData((data) => {
        void sendTerminalInput(remoteSessionId, data);
      });

      const es = new EventSource(terminalUrl(`/terminal/${remoteSessionId}/stream`));
      esRef.current = es;

      es.onopen = () => {
        if (!mounted) return;
        onStatusChange('connected');
      };

      es.onmessage = (event) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(event.data) as TerminalStreamMessage;
          if (msg.type === 'data' && msg.data) {
            term.write(msg.data);
          }
        } catch {
          // Raw data fallback.
          term.write(event.data);
        }
      };

      es.onerror = () => {
        if (!mounted) return;
        onStatusChange('error', 'Terminal stream disconnected');
      };

      // Fit after mount.
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch (err) {
          logger.warn({ err }, 'Initial fit failed');
        }
      });
    });

    return () => {
      mounted = false;
      esRef.current?.close();
      esRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [remoteSessionId, onStatusChange]);

  // Refit when the pane becomes active or its container resizes.
  useEffect(() => {
    if (!isActive || !fitAddonRef.current || !containerRef.current) return;
    const fit = () => {
      try {
        fitAddonRef.current?.fit();
      } catch {
        // Ignore fit errors.
      }
    };
    fit();
    const timeout = setTimeout(fit, 100);

    let resizeObserver: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => fit());
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeout);
      resizeObserver?.disconnect();
    };
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 80,
        padding: 8,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome helpers
// ─────────────────────────────────────────────────────────────────────────────

const glassButton: React.CSSProperties = {
  width: 26,
  height: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid transparent',
  borderRadius: 999,
  background: 'transparent',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const glassButtonHover = {
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--text-primary)',
};

function StatusDot({ status }: { status: TerminalTabStatus }) {
  const color =
    status === 'connected'
      ? 'var(--status-success)'
      : status === 'connecting'
        ? 'var(--status-warning)'
        : 'var(--status-error)';
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}`,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function UnifiedTerminal({
  sessionId = 'allternit-session',
  workingDir,
  terminalContext,
}: UnifiedTerminalProps) {
  const [mode, setMode] = useState<TerminalMode>('single');
  const [tabs, setTabs] = useState<TerminalSession[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const tabsRef = useRef<TerminalSession[]>([]);
  tabsRef.current = tabs;

  // Create the first terminal tab on mount.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const remoteSessionId = await createTerminalSession({ cwd: workingDir });
        if (cancelled) {
          void closeTerminalSession(remoteSessionId);
          return;
        }
        const id = generateTabId();
        setTabs([{ id, name: 'Terminal 1', remoteSessionId, status: 'connecting', errorMsg: '' }]);
        setActiveTabId(id);
      } catch (err) {
        if (cancelled) return;
        setServiceError(err instanceof Error ? err.message : 'Terminal service unavailable');
      }
    };

    void init();

    return () => {
      cancelled = true;
      tabsRef.current.forEach((tab) => {
        if (tab.remoteSessionId) void closeTerminalSession(tab.remoteSessionId);
      });
    };
  }, [sessionId, workingDir]);

  const handleCreateTab = useCallback(async () => {
    setIsLoading(true);
    setServiceError(null);
    try {
      const remoteSessionId = await createTerminalSession({ cwd: workingDir });
      const id = generateTabId();
      const next: TerminalSession = {
        id,
        name: `Terminal ${tabs.length + 1}`,
        remoteSessionId,
        status: 'connecting',
        errorMsg: '',
      };
      setTabs((prev) => [...prev, next]);
      setActiveTabId(id);
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : 'Failed to create terminal');
    } finally {
      setIsLoading(false);
    }
  }, [tabs.length, workingDir]);

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const target = prev.find((t) => t.id === tabId);
      if (target?.remoteSessionId) void closeTerminalSession(target.remoteSessionId);
      const remaining = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  }, [activeTabId]);

  const handleStatusChange = useCallback((tabId: string, status: TerminalTabStatus, errorMsg?: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, status, errorMsg: errorMsg || '' } : t))
    );
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const anyConnecting = tabs.some((t) => t.status === 'connecting');
  const allConnected = tabs.length > 0 && tabs.every((t) => t.status === 'connected');

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-canvas)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Liquid-glass telemetry bar */}
      <div
        style={{
          padding: '8px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--glass-bg-thick)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <TerminalIcon size={15} weight="duotone" style={{ color: 'var(--accent-code)' }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {terminalContext?.repoName ?? sessionId}
          </span>

          {terminalContext?.branch && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: 'var(--text-secondary)',
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-panel)',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <GitBranch size={10} />
              {terminalContext.branch}
            </span>
          )}

          {terminalContext?.shortSha && (
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-panel)',
                whiteSpace: 'nowrap',
              }}
            >
              {terminalContext.shortSha}
            </span>
          )}

          {workingDir && (
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-panel)',
                whiteSpace: 'nowrap',
              }}
            >
              {workingDir.split('/').pop()}
            </span>
          )}

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: allConnected ? 'var(--status-success)' : anyConnecting ? 'var(--status-warning)' : 'var(--status-error)',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <StatusDot status={allConnected ? 'connected' : anyConnecting ? 'connecting' : 'error'} />
            {allConnected ? 'ONLINE' : anyConnecting ? 'SYNC' : 'OFFLINE'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Mode toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: 2,
              borderRadius: 999,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-panel)',
            }}
          >
            <button
              type="button"
              aria-label="Single terminal"
              onClick={() => setMode('single')}
              style={{
                ...glassButton,
                width: 24,
                height: 24,
                color: mode === 'single' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                ...(mode === 'single' ? { background: 'var(--surface-active)' } : {}),
              }}
              onMouseEnter={(e) => {
                if (mode !== 'single') Object.assign(e.currentTarget.style, { background: 'var(--surface-hover)', color: 'var(--text-primary)' });
              }}
              onMouseLeave={(e) => {
                if (mode !== 'single') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }
              }}
            >
              <Square size={12} weight={mode === 'single' ? 'fill' : 'regular'} />
            </button>
            <button
              type="button"
              aria-label="Terminal grid"
              onClick={() => setMode('grid')}
              style={{
                ...glassButton,
                width: 24,
                height: 24,
                color: mode === 'grid' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                ...(mode === 'grid' ? { background: 'var(--surface-active)' } : {}),
              }}
              onMouseEnter={(e) => {
                if (mode !== 'grid') Object.assign(e.currentTarget.style, { background: 'var(--surface-hover)', color: 'var(--text-primary)' });
              }}
              onMouseLeave={(e) => {
                if (mode !== 'grid') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }
              }}
            >
              <SquaresFour size={12} weight={mode === 'grid' ? 'fill' : 'regular'} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCreateTab}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 999,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-panel)',
              color: 'var(--accent-code)',
              fontSize: 11,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'var(--surface-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-panel)';
            }}
          >
            <Plus size={13} />
            {isLoading ? '…' : 'New'}
          </button>
        </div>
      </div>

      {/* Service-level error */}
      {serviceError && (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(239,68,68,0.08)',
            borderBottom: '1px solid rgba(239,68,68,0.25)',
            color: 'var(--status-error)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Warning size={14} />
            {serviceError}
          </span>
          <button
            type="button"
            onClick={handleCreateTab}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--border-subtle)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <ArrowsClockwise size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Tabs */}
      {tabs.length > 1 && mode === 'single' && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '6px 10px 0',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface-canvas)',
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {tabs.map((tab) => (
            <div
              role="button"
              tabIndex={0}
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                border: '1px solid var(--border-subtle)',
                borderBottom: 'none',
                background: tab.id === activeTabId ? 'var(--surface-floating)' : 'rgba(255,255,255,0.02)',
                color: tab.id === activeTabId ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <StatusDot status={tab.status} />
              <span>{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close ${tab.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    height: 16,
                    border: 'none',
                    borderRadius: 999,
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
                    e.currentTarget.style.color = 'var(--status-error)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-tertiary)';
                  }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        {tabs.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              gap: 14,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <TerminalIcon size={28} weight="duotone" />
            <span style={{ fontSize: 13 }}>No terminals yet</span>
            <button
              type="button"
              onClick={handleCreateTab}
              style={{
                padding: '7px 14px',
                borderRadius: 999,
                border: '1px solid var(--border-subtle)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Create First Terminal
            </button>
          </div>
        ) : mode === 'single' ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: 8,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                borderRadius: 14,
                border: '1px solid var(--border-subtle)',
                background: 'var(--glass-bg-thick)',
                backdropFilter: 'blur(14px) saturate(160%)',
                WebkitBackdropFilter: 'blur(14px) saturate(160%)',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.28)',
              }}
            >
              {activeTab?.remoteSessionId && (
                <TerminalSurface
                  key={activeTab.remoteSessionId}
                  remoteSessionId={activeTab.remoteSessionId}
                  isActive
                  onStatusChange={(status, errorMsg) =>
                    handleStatusChange(activeTab.id, status, errorMsg)
                  }
                />
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'grid',
              gridTemplateColumns: tabs.length === 1 ? '1fr' : 'repeat(2, 1fr)',
              gridTemplateRows: tabs.length <= 2 ? '1fr' : 'repeat(2, 1fr)',
              gap: 8,
              padding: 8,
              overflow: 'auto',
              boxSizing: 'border-box',
            }}
          >
            {tabs.map((tab) => (
              <div
                key={tab.id}
                style={{
                  borderRadius: 14,
                  border: `1px solid ${tab.id === activeTabId ? 'var(--accent-code)' : 'var(--border-subtle)'}`,
                  background: 'var(--glass-bg-thick)',
                  backdropFilter: 'blur(14px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(14px) saturate(160%)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: 120,
                  boxShadow: tab.id === activeTabId
                    ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px var(--accent-code)22, 0 8px 24px rgba(0,0,0,0.28)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.28)',
                }}
              >
                <div
                  style={{
                    padding: '5px 8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'rgba(255,255,255,0.03)',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <StatusDot status={tab.status} />
                    {tab.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Close ${tab.name}`}
                    onClick={() => handleCloseTab(tab.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      border: 'none',
                      borderRadius: 999,
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
                      e.currentTarget.style.color = 'var(--status-error)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-tertiary)';
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  style={{ flex: 1, minHeight: 0 }}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {tab.remoteSessionId && (
                    <TerminalSurface
                      key={tab.remoteSessionId}
                      remoteSessionId={tab.remoteSessionId}
                      isActive={tab.id === activeTabId}
                      onStatusChange={(status, errorMsg) =>
                        handleStatusChange(tab.id, status, errorMsg)
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UnifiedTerminal;
