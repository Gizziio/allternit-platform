import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalTabProps {
  isActive: boolean;
  onClose?: () => void;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({ isActive }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1f2937',
        foreground: '#f3f4f6',
        cursor: '#f3f4f6',
        selection: '#4b5563',
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
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    // Initialize WebSocket - connect through proxy to kernel
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/v1/terminal/ws`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      term.writeln('\x1b[1;32mConnected to Persistent Kernel Shell.\x1b[0m');
    };

    socket.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        const text = await event.data.text();
        term.write(text);
      } else {
        term.write(event.data);
      }
    };

    socket.onclose = () => {
      term.writeln('\r\n\x1b[1;31mConnection closed.\x1b[0m');
    };

    socket.onerror = (error) => {
      term.writeln('\r\n\x1b[1;31mWebSocket error occurred.\x1b[0m');
      console.error('WebSocket Error:', error);
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
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
      socket.close();
      term.dispose();
      xtermRef.current = null;
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 100);
    }
  }, [isActive]);

  return (
    <div className="terminal-tab-wrapper" style={{ height: '100%', width: '100%', background: '#000' }}>
      <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};