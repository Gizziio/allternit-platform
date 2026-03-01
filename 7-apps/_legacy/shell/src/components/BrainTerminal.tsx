import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface BrainTerminalProps {
  sessionId: string;
  isActive: boolean;
  onClose?: () => void;
}

export const BrainTerminal: React.FC<BrainTerminalProps> = ({ sessionId, isActive }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const inputBufferRef = useRef<string>('');
  const reconnectTimeoutRef = useRef<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  // Send input to brain session
  const sendInput = useCallback(async (data: string) => {
    if (!data.trim()) return;
    try {
      await fetch(`http://localhost:3004/v1/sessions/${sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.error('Failed to send input to brain:', err);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current || !sessionId) return;

    console.log('[BrainTerminal] Initializing for session:', sessionId);

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0f0f23',
        foreground: '#e2e8f0',
        cursor: '#22d3ee',
        selection: '#3b82f6',
        black: '#1e1e2e',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e2e8f0',
        brightBlack: '#6b7280',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f9fafb',
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    // Welcome message
    term.writeln('\x1b[1;36m╔═══════════════════════════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[1;36m║\x1b[0m\x1b[1;35m 🧠 Neural Runtime Terminal \x1b[1;36m                                 ║\x1b[0m');
    term.writeln('\x1b[1;36m║\x1b[0m\x1b[1;33m Session: \x1b[1;37m' + sessionId.substring(0, 20) + '\x1b[0m'.padEnd(29) + '\x1b[1;36m║\x1b[0m');
    term.writeln('\x1b[1;36m╚═══════════════════════════════════════════════════════════════╝\x1b[0m');
    term.writeln('');

    // Connect to SSE with retry logic
    let connectionAttempts = 0;
    const MAX_ATTEMPTS = 5;
    const CONNECT_URL = `http://localhost:3004/v1/sessions/${sessionId}/events`;

    const connectToSSE = () => {
      console.log('[BrainTerminal] Attempting SSE connection...', connectionAttempts + 1);
      setConnectionStatus('connecting');

      const es = new EventSource(CONNECT_URL);
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[BrainTerminal] SSE connected!');
        setConnectionStatus('connected');
        term.writeln('\x1b[1;32m● Connected to neural runtime\x1b[0m');
        term.writeln('\x1b[2m  Waiting for brain output...\x1b[0m\r\n');
        connectionAttempts = 0;
      };

      es.onmessage = (event) => {
        // Skip empty or keepalive messages
        if (!event.data || event.data.trim() === '') return;

        try {
          const brainEvent = JSON.parse(event.data);
          console.log('[BrainTerminal] Received:', brainEvent.type);

          switch (brainEvent.type) {
            case 'terminal.delta':
              term.write(brainEvent.payload.data);
              break;
            case 'chat.delta':
              term.write(brainEvent.payload.text);
              break;
            case 'chat.message.completed':
              term.writeln('');
              break;
            case 'tool.call':
              term.writeln(`\r\n\x1b[1;35m[Tool]\x1b[0m ${brainEvent.payload.tool_id}`);
              break;
            case 'tool.result':
              term.writeln(`\r\n\x1b[1;32m[Result]\x1b[0m ${brainEvent.payload.result}`);
              break;
            case 'error':
              term.writeln(`\r\n\x1b[1;31m[Error]\x1b[0m ${brainEvent.payload.message}`);
              break;
            default:
              // Log unknown events for debugging
              console.log('[BrainTerminal] Unknown event:', brainEvent.type);
          }
        } catch (err) {
          // Non-JSON events - write as-is
          if (typeof event.data === 'string' && event.data.trim()) {
            term.write(event.data);
          }
        }
      };

      es.onerror = (err) => {
        console.log('[BrainTerminal] SSE error, status:', es.readyState);
        setConnectionStatus('error');

        if (connectionAttempts < MAX_ATTEMPTS) {
          connectionAttempts++;
          const delay = Math.min(500 * Math.pow(2, connectionAttempts), 5000);
          term.writeln(`\x1b[2m● Reconnecting in ${delay/1000}s...\x1b[0m`);

          reconnectTimeoutRef.current = window.setTimeout(() => {
            es.close();
            connectToSSE();
          }, delay);
        } else {
          term.writeln('\x1b[1;31m● Failed to connect. Please restart session.\x1b[0m');
        }
      };
    };

    connectToSSE();

    // Handle terminal input
    term.onData((data) => {
      if (data === '\r') { // Enter
        if (inputBufferRef.current.trim()) {
          term.writeln('');
          sendInput(inputBufferRef.current);
        }
        inputBufferRef.current = '';
      } else if (data === '\x7f') { // Backspace
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data === '\x03') { // Ctrl+C
        inputBufferRef.current = '';
        term.writeln('^C');
        sendInput('\x03');
      } else if (data === '\x1b[A' || data === '\x1b[B') { // Arrow keys
        term.write('\x1b[D');
      } else if (data.length === 1 && data >= ' ' && data <= '~') {
        inputBufferRef.current += data;
        term.write(data);
      }
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
      });
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      term.dispose();
      xtermRef.current = null;
    };
  }, [sessionId, sendInput]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 100);
    }
  }, [isActive]);

  // Connection status indicator
  const statusColor = connectionStatus === 'connected' ? '#10b981' : connectionStatus === 'error' ? '#ef4444' : '#f59e0b';
  const statusText = connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'error' ? 'Error' : 'Connecting...';

  return (
    <div className="brain-terminal-wrapper" style={{ height: '100%', width: '100%', background: '#0f0f23' }}>
      {/* Connection status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 12px',
        background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        fontSize: '11px',
        gap: '8px'
      }}>
        <span style={{ color: '#6b7280' }}>Status:</span>
        <span style={{ color: statusColor, fontWeight: 600 }}>{statusText}</span>
        <span style={{ color: '#6b7280', marginLeft: 'auto' }}>{sessionId.substring(0, 8)}</span>
      </div>
      <div ref={terminalRef} style={{ height: 'calc(100% - 28px)', width: '100%' }} />
    </div>
  );
};
