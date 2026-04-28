/**
 * Unified Terminal Component
 * 
 * Combines single terminal and multi-pane grid modes.
 * Uses workspace-service for both modes (port 3021).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { workspaceClient, Pane } from '../../services/workspace/client';
import { GlassCard } from '../../design/GlassCard';
import { SquaresFour, Square, Plus, X } from '@phosphor-icons/react';

// Dynamically import xterm only on client side
let Terminal: typeof import('xterm').Terminal | null = null;
let FitAddon: typeof import('xterm-addon-fit').FitAddon | null = null;

async function loadXterm() {
  if (typeof window === 'undefined') return false;
  if (Terminal && FitAddon) return true;
  
  const [xterm, xtermAddon] = await Promise.all([
    import('xterm'),
    import('xterm-addon-fit')
  ]);
  
  Terminal = xterm.Terminal;
  FitAddon = xtermAddon.FitAddon;
  
  // Import CSS only on client
  await import('xterm/css/xterm.css');
  
  return true;
}

type TerminalMode = 'single' | 'grid';

interface UnifiedTerminalProps {
  sessionId?: string;
}

// Single terminal component
function TerminalInstance({ pane, isActive }: { 
  pane: Pane; 
  isActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current || !pane.id) return;

    // Check if already initialized
    if (termRef.current) return;

    let mounted = true;

    async function initTerminal() {
      const loaded = await loadXterm();
      if (!loaded || !mounted || !containerRef.current) return;

      console.log('Initializing terminal for pane:', pane.id);

      const term = new Terminal!({
        cursorBlink: true,
        theme: {
          background: '#1f2937',
          foreground: '#f3f4f6',
          cursor: '#f3f4f6',
          black: '#111827',
          red: '#ef4444',
          green: '#10b981',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#8b5cf6',
          cyan: 'var(--status-info)',
          white: '#f3f4f6',
          brightBlack: '#6b7280',
          brightRed: '#f87171',
          brightGreen: '#34d399',
          brightYellow: '#fbbf24',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#f9fafb',
        },
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
        rows: 24,
        cols: 80,
        allowProposedApi: true,
      });

      term.open(containerRef.current!);

      const fitAddon = new FitAddon!();
      term.loadAddon(fitAddon);

      // Store refs
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Connect to workspace service
      const wsUrl = workspaceClient.baseUrl.replace(/^http/, 'ws');
      const encodedPaneId = encodeURIComponent(pane.id);
      const socketUrl = `${wsUrl}/panes/${encodedPaneId}/logs`;
      
      console.log('Connecting WebSocket:', socketUrl);
      
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('WebSocket connected for pane:', pane.id);
        term.writeln(`\x1b[1;32mConnected to ${pane.title || pane.id}\x1b[0m`);
      };

      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          term.write(event.data);
        }
      };

      socket.onclose = (e) => {
        console.log('WebSocket closed:', pane.id, 'code:', e.code);
        term.writeln(`\r\n\x1b[1;31mDisconnected\x1b[0m`);
      };

      socket.onerror = (e) => {
        console.error('WebSocket error:', pane.id, e);
        term.writeln('\r\n\x1b[1;31mConnection error\x1b[0m');
      };

      term.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(data);
        }
      });

      // Fit terminal after mount
      const fitTimeout = setTimeout(() => {
        try {
          fitAddon.fit();
          console.log('Terminal fitted for pane:', pane.id);
        } catch (e) {
          console.warn('Fit failed:', e);
        }
      }, 100);

      return () => {
        clearTimeout(fitTimeout);
        socket.close();
        term.dispose();
      };
    }

    const cleanupPromise = initTerminal();

    return () => {
      mounted = false;
      cleanupPromise.then((cleanup) => {
        if (cleanup) cleanup();
        termRef.current = null;
        fitAddonRef.current = null;
        socketRef.current = null;
      });
    };
  }, [pane.id, pane.title]);

  // Handle resize
  useEffect(() => {
    if (!isActive || !fitAddonRef.current) return;
    
    const timeout = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
      } catch (e) {
        // Ignore fit errors
      }
    }, 100);
    
    return () => clearTimeout(timeout);
  }, [isActive]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        minHeight: 100,
        background: '#1f2937',
      }} 
    />
  );
}

export function UnifiedTerminal({ sessionId = 'allternit-session' }: UnifiedTerminalProps) {
  const [mode, setMode] = useState<TerminalMode>('single');
  const [panes, setPanes] = useState<Pane[]>([]);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPaneCountRef = useRef(0);

  // Ensure session exists
  const ensureSession = useCallback(async () => {
    if (!sessionId) return false;
    try {
      const sessions = await workspaceClient.listSessions();
      const exists = sessions.some(s => s.name === sessionId || s.id === sessionId);
      
      if (!exists) {
        console.log('Creating session:', sessionId);
        await workspaceClient.createSession({ name: sessionId });
      }
      return true;
    } catch (err) {
      console.error('Failed to ensure session:', err);
      setError('Failed to create session');
      return false;
    }
  }, [sessionId]);

  // Load panes - only log when count changes
  const loadPanes = useCallback(async () => {
    if (!sessionId) return;
    try {
      setError(null);
      const paneList = await workspaceClient.listPanes(sessionId);
      
      // Only update state and log if pane count changed
      if (paneList.length !== lastPaneCountRef.current) {
        console.log('Panes changed:', paneList.length, 'panes');
        lastPaneCountRef.current = paneList.length;
        setPanes(paneList);
        if (paneList.length > 0 && !activePaneId) {
          setActivePaneId(paneList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load panes:', err);
      setError('Failed to load terminals');
    }
  }, [sessionId, activePaneId]);

  // Initial load only - no polling
  useEffect(() => {
    workspaceClient.healthCheck().then((healthy) => {
      setIsConnected(healthy);
      if (healthy) {
        ensureSession().then(() => loadPanes());
      }
    });
  }, [ensureSession, loadPanes]);

  // Create new pane
  const handleCreatePane = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const sessionReady = await ensureSession();
      if (!sessionReady) throw new Error('Session could not be created');
      
      const newPane = await workspaceClient.createPane(sessionId, {
        name: `Terminal ${panes.length + 1}`,
      });
      
      // Wait for pane to be ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Refresh panes list
      const updatedPanes = await workspaceClient.listPanes(sessionId);
      setPanes(updatedPanes);
      lastPaneCountRef.current = updatedPanes.length;
      
      setActivePaneId(newPane.id);
    } catch (err) {
      console.error('Failed to create pane:', err);
      setError('Failed to create terminal: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Close pane
  const handleClosePane = async (paneId: string) => {
    try {
      await workspaceClient.deletePane(paneId);
      const remaining = panes.filter(p => p.id !== paneId);
      setPanes(remaining);
      lastPaneCountRef.current = remaining.length;
      if (activePaneId === paneId) {
        setActivePaneId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to close pane:', err);
    }
  };

  const activePane = panes.find(p => p.id === activePaneId) || panes[0];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #374151',
          background: '#111827',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#f3f4f6' }}>
            Session: {sessionId}
          </span>
          <span
            style={{
              fontSize: 10,
              color: isConnected ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ● {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
            <button
              onClick={() => setMode('single')}
              style={{
                padding: '4px 8px',
                background: mode === 'single' ? '#2563eb' : '#374151',
                border: 'none',
                borderRadius: 4,
                color: '#f3f4f6',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Square size={12} weight={mode === 'single' ? 'fill' : 'regular'} />
              Single
            </button>
            <button
              onClick={() => setMode('grid')}
              style={{
                padding: '4px 8px',
                background: mode === 'grid' ? '#2563eb' : '#374151',
                border: 'none',
                borderRadius: 4,
                color: '#f3f4f6',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <SquaresFour size={12} weight={mode === 'grid' ? 'fill' : 'regular'} />
              Grid ({panes.length})
            </button>
          </div>
        </div>

        <button
          onClick={handleCreatePane}
          disabled={isLoading}
          style={{
            padding: '6px 12px',
            background: isLoading ? '#4b5563' : '#2563eb',
            color: 'var(--ui-text-primary)',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Plus size={14} />
          {isLoading ? 'Creating...' : 'New Terminal'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: '8px 12px',
          background: '#ef444420',
          borderBottom: '1px solid #ef4444',
          color: 'var(--status-error)',
          fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {/* Content based on mode */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {panes.length === 0 ? (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            gap: 16,
          }}>
            <span>No terminals yet</span>
            <button
              onClick={handleCreatePane}
              style={{
                padding: '8px 16px',
                background: '#2563eb',
                color: 'var(--ui-text-primary)',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Create First Terminal
            </button>
          </div>
        ) : mode === 'single' ? (
          /* Single Mode */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Pane tabs */}
            {panes.length > 1 && (
              <div style={{
                display: 'flex',
                gap: 2,
                padding: '8px 12px 0',
                background: '#111827',
                borderBottom: '1px solid #374151',
                overflowX: 'auto',
                flexShrink: 0,
              }}>
                {panes.map(pane => (
                  <div
                    key={pane.id}
                    onClick={() => setActivePaneId(pane.id)}
                    style={{
                      padding: '6px 12px',
                      background: pane.id === activePaneId ? '#1f2937' : '#374151',
                      borderTopLeftRadius: 6,
                      borderTopRightRadius: 6,
                      color: pane.id === activePaneId ? '#f3f4f6' : '#9ca3af',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderBottom: pane.id === activePaneId ? '2px solid #3b82f6' : 'none',
                    }}
                  >
                    <span>{pane.title || `Terminal ${pane.pane_index}`}</span>
                    {panes.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClosePane(pane.id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Single terminal view - wrapped in border container */}
            <div style={{ flex: 1, padding: 12, minHeight: 0 }}>
              <div style={{
                width: '100%',
                height: '100%',
                border: '2px solid #3b82f6',
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                {activePane && (
                  <TerminalInstance 
                    key={activePane.id}
                    pane={activePane} 
                    isActive={true}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Grid Mode */
          <div style={{ 
            height: '100%',
            display: 'grid',
            gridTemplateColumns: panes.length === 1 ? '1fr' : 'repeat(2, 1fr)',
            gridTemplateRows: panes.length <= 2 ? '1fr' : 'repeat(2, 1fr)',
            gap: 12,
            padding: 12,
            overflow: 'auto',
          }}>
            {panes.map((pane) => (
              <GlassCard
                key={pane.id}
                style={{
                  background: '#1f2937',
                  border: pane.id === activePaneId ? '2px solid #3b82f6' : '1px solid #374151',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  minHeight: 150,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '6px 12px',
                    background: pane.id === activePaneId ? '#2563eb' : '#161b22',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 11, color: '#f3f4f6', fontWeight: 500 }}>
                    {pane.title || `Terminal ${pane.pane_index}`}
                  </span>
                  <button
                    onClick={() => handleClosePane(pane.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Terminal */}
                <div 
                  style={{ flex: 1, minHeight: 0, padding: 4 }}
                  onClick={() => setActivePaneId(pane.id)}
                >
                  <TerminalInstance 
                    key={pane.id}
                    pane={pane} 
                    isActive={pane.id === activePaneId}
                  />
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
