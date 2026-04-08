/**
 * Terminal Grid Component
 * 
 * Displays multiple terminal panes in a grid layout.
 * Connects to workspace service for pane management.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { workspaceClient, Pane } from '../../services/workspace/client';
import { GlassCard } from '../../design/GlassCard';

interface TerminalPaneProps {
  pane: Pane;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

function TerminalPane({ pane, isActive, onClick, onClose }: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    const term = new Terminal({
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
        cyan: '#06b6d4',
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
      fontSize: 12,
      fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
      rows: 10,
      cols: 40,
    });

    term.open(terminalRef.current);

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Connect to workspace service WebSocket
    const socket = workspaceClient.createLogStream(pane.id);
    socketRef.current = socket;

    socket.onopen = () => {
      term.writeln(`\x1b[1;32mConnected to pane ${pane.id}\x1b[0m`);
    };

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      }
    };

    socket.onclose = () => {
      term.writeln('\r\n\x1b[1;31mDisconnected\x1b[0m');
    };

    socket.onerror = () => {
      term.writeln('\r\n\x1b[1;31mConnection error\x1b[0m');
    };

    // Handle input
    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    // Store refs
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fit after delay
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.warn('Fit failed:', e);
      }
    }, 100);

    return () => {
      socket.close();
      term.dispose();
    };
  }, [pane.id]);

  return (
    <div onClick={onClick} style={{ flex: 1, minWidth: 300, minHeight: 200 }}>
      <GlassCard
        style={{
          height: '100%',
          background: '#1f2937',
          border: isActive ? '2px solid #3b82f6' : '1px solid #374151',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '6px 12px',
            background: isActive ? '#2563eb' : '#161b22',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flex: '0 0 auto',
          }}
        >
          <span style={{ fontSize: 11, color: '#f3f4f6', fontWeight: 500 }}>
            {pane.title || `Pane ${pane.pane_index}`}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                fontSize: 10,
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              ● {pane.id}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 4px',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Terminal */}
        <div
          ref={terminalRef}
          style={{
            flex: 1,
            padding: 8,
            backgroundColor: '#1f2937',
            overflow: 'hidden',
          }}
        />
      </GlassCard>
    </div>
  );
}

interface TerminalGridProps {
  sessionId?: string;
}

export function TerminalGrid({ sessionId }: TerminalGridProps) {
  const [panes, setPanes] = useState<Pane[]>([]);
  const [activePaneId, setActivePaneId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Load panes
  const loadPanes = useCallback(async () => {
    if (!sessionId) return;
    try {
      const paneList = await workspaceClient.listPanes(sessionId);
      setPanes(paneList);
      if (paneList.length > 0 && !activePaneId) {
        setActivePaneId(paneList[0].id);
      }
    } catch (error) {
      console.error('Failed to load panes:', error);
    }
  }, [sessionId, activePaneId]);

  // Initial load and health check
  useEffect(() => {
    workspaceClient.healthCheck().then(setIsConnected);
    loadPanes();

    // Refresh every 5 seconds
    const interval = setInterval(loadPanes, 5000);
    return () => clearInterval(interval);
  }, [loadPanes]);

  // Create new pane
  const handleCreatePane = async () => {
    if (!sessionId) return;
    try {
      await workspaceClient.createPane(sessionId, {
        name: `Agent ${panes.length + 1}`,
        metadata: { pane_type: 'agent' },
      });
      loadPanes();
    } catch (error) {
      console.error('Failed to create pane:', error);
    }
  };

  // Close pane
  const handleClosePane = async (paneId: string) => {
    try {
      await workspaceClient.deletePane(paneId);
      setPanes((prev) => prev.filter((p) => p.id !== paneId));
      if (activePaneId === paneId) {
        setActivePaneId(null);
      }
    } catch (error) {
      console.error('Failed to close pane:', error);
    }
  };

  if (!sessionId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#9ca3af',
        }}
      >
        No session selected
      </div>
    );
  }

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
        </div>
        <button
          onClick={handleCreatePane}
          style={{
            padding: '6px 12px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          + New Pane
        </button>
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          padding: 12,
          overflow: 'auto',
          alignContent: 'flex-start',
        }}
      >
        {panes.length === 0 ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span>No panes yet</span>
            <button
              onClick={handleCreatePane}
              style={{
                padding: '8px 16px',
                background: '#374151',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Create First Pane
            </button>
          </div>
        ) : (
          panes.map((pane) => (
            <TerminalPane
              key={pane.id}
              pane={pane}
              isActive={pane.id === activePaneId}
              onClick={() => setActivePaneId(pane.id)}
              onClose={() => handleClosePane(pane.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
