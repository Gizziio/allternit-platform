import React, { useEffect, useRef } from 'react';
import { GlassCard } from '../design/GlassCard';
import { tokens } from '../design/tokens';

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

export function TerminalView({ noPadding = false }: { noPadding?: boolean }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('xterm').Terminal | null>(null);
  const fitAddonRef = useRef<import('xterm-addon-fit').FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    let mounted = true;

    async function initTerminal() {
      const loaded = await loadXterm();
      if (!loaded || !mounted || !terminalRef.current) return;

      // Initialize xterm.js terminal with proper theme
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
        fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
        rows: 24,
        cols: 80
      });

      // Open terminal first
      term.open(terminalRef.current);
      
      // Add fit addon after terminal is opened
      const fitAddon = new FitAddon!();
      term.loadAddon(fitAddon);
      
      // Fit after a delay to ensure everything is ready
      setTimeout(() => {
        if (fitAddon) {
          try {
            fitAddon.fit();
          } catch (error) {
            console.warn('Fit addon failed to fit:', error);
          }
        }
      }, 100);

      // Initialize WebSocket connection to terminal backend via gateway
      const gatewayUrl = (window as any).__A2R_GATEWAY_URL || 'ws://127.0.0.1:8013';
      const wsUrl = `${gatewayUrl}/api/v1/terminal/ws`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        term.writeln('\x1b[1;32mConnected to A2R Kernel Terminal.\x1b[0m');
        term.write('$ ');
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
        term.writeln('\r\n\x1b[1;31mWebSocket connection error.\x1b[0m');
        console.error('WebSocket Error:', error);
      };

      term.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(data);
        }
      });

      // Store references
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Handle window resize
      let resizeObserver: ResizeObserver | null = null;
      
      // Set up resize observer after a delay
      setTimeout(() => {
        if (terminalRef.current && fitAddon) {
          resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => {
              if (fitAddonRef.current) {
                try {
                  fitAddonRef.current.fit();
                } catch (error) {
                  console.warn('Resize fit failed:', error);
                }
              }
            });
          });
          resizeObserver.observe(terminalRef.current);
        }
      }, 150);

      return () => {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (socketRef.current) {
          socketRef.current.close();
        }
        if (termRef.current) {
          termRef.current.dispose();
        }
      };
    }

    initTerminal();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ height: '100%', padding: noPadding ? 0 : tokens.space.lg, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <GlassCard style={{
        flex: 1,
        background: '#1f2937',
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: noPadding ? 0 : 12,
        border: noPadding ? 'none' : '1px solid var(--border-strong)'
      }}>
        <div style={{ padding: '8px 12px', background: '#161b22', fontSize: 11, display: 'flex', gap: 12, flex: '0 0 auto' }}>
          <span style={{ opacity: 0.7, color: '#f3f4f6' }}>Terminal</span>
          <span style={{ color: '#10b981' }}>
            ● connected
          </span>
        </div>
        <div
          ref={terminalRef}
          style={{
            flex: 1,
            padding: 16,
            backgroundColor: '#1f2937',
          }}
        />
      </GlassCard>
    </div>
  );
}
