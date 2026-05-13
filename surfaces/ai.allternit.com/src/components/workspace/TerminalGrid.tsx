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
import { GlassCard } from '../../design/glass/GlassCard';

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
      fontSize: 12,
      fontFamily: 'var(--font-mono)',
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
    const timer = setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.warn('Fit failed:', e);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      socket.close();
      term.dispose();
    };
  }, [pane.id]);

  return (
    <div onClick={onClick} className="flex-1 min-w-[300px] min-h-[200px]">
      <GlassCard
        className={cn(
          "h-full bg-[#1f2937] border-solid flex flex-col overflow-hidden cursor-pointer",
          isActive ? "border-2 border-[#3b82f6]" : "border border-[#374151]"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "p-1.5 px-3 flex justify-between items-center shrink-0",
            isActive ? "bg-[#2563eb]" : "bg-[#161b22]"
          )}
        >
          <span className="text-[12px] text-[#f3f4f6] font-medium">
            {pane.title || `Pane ${pane.pane_index}`}
          </span>
          <div className="flex gap-2 items-center">
            <span className="text-[12px] text-[#10b981] flex items-center gap-1">
              ● {pane.id}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="bg-transparent border-none text-[#9ca3af] cursor-pointer text-sm p-0 px-1 hover:text-white transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Terminal */}
        <div
          ref={terminalRef}
          className="flex-1 p-2 bg-[#1f2937] overflow-hidden"
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
      <div className="flex items-center justify-center h-full text-[#9ca3af] text-sm">
        No session selected
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-2 px-3 flex justify-between items-center border-b border-solid border-[#374151] bg-[#111827] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold text-[#f3f4f6]">
            Session: {sessionId}
          </span>
          <span className={cn(
            "text-[12px] flex items-center gap-1",
            isConnected ? "text-[#10b981]" : "text-[#ef4444]"
          )}>
            ● {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <button
          onClick={handleCreatePane}
          className="p-1.5 px-3 bg-[#2563eb] text-white border-none rounded-md text-[12px] font-bold cursor-pointer transition-all hover:bg-[#1d4ed8] active:scale-95"
        >
          + New Pane
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-wrap gap-3 p-3 overflow-auto align-content-start">
        {panes.length === 0 ? (
          <div className="size-full flex flex-col items-center justify-center text-[#6b7280] gap-3">
            <span className="text-sm">No panes yet</span>
            <button
              onClick={handleCreatePane}
              className="p-2 px-4 bg-[#374151] text-white border-none rounded-md text-[12px] font-bold cursor-pointer transition-all hover:bg-[#4b5563] active:scale-95"
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
