"use client";

import { useEffect, useState, useCallback } from 'react';

const BROADCAST_CHANNEL_NAME = 'allternit-office-addin';
const POLL_INTERVAL_MS = 3000;

export interface OfficeAddinState {
  status: 'idle' | 'running' | 'error';
  host: 'word' | 'excel' | 'powerpoint' | 'unknown';
  pageLabel: string;
  currentTask?: string | null;
  historyCount: number;
  connected: boolean;
}

export function useOfficeAddinBridge() {
  const [state, setState] = useState<OfficeAddinState>({
    status: 'idle',
    host: 'unknown',
    pageLabel: 'Office Add-in',
    currentTask: null,
    historyCount: 0,
    connected: false,
  });

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.source !== 'allternit-office-addin') return;
    const payload = event.data.payload;
    if (!payload) return;

    setState({
      status: payload.status ?? 'idle',
      host: payload.host ?? 'unknown',
      pageLabel: payload.pageLabel ?? 'Office Add-in',
      currentTask: payload.currentTask ?? null,
      historyCount: payload.historyCount ?? 0,
      connected: true,
    });
  }, []);

  useEffect(() => {
    // Try BroadcastChannel first (same-machine, cross-tab)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (ev) => handleMessage(ev as unknown as MessageEvent);
    } catch {
      // BroadcastChannel not supported
    }

    // Fallback: listen for postMessage from iframe or popup
    window.addEventListener('message', handleMessage);

    // Poll for heartbeat in case add-in is running but silent
    const heartbeatInterval = setInterval(() => {
      try {
        bc?.postMessage({ source: 'allternit-platform', type: 'heartbeat' });
      } catch {
        // ignore
      }
    }, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener('message', handleMessage);
      bc?.close();
      clearInterval(heartbeatInterval);
    };
  }, [handleMessage]);

  return state;
}
