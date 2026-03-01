import { useState, useEffect, useRef, useCallback } from 'react';

// Simplified Patch Type based on A2UI
export interface A2UIPatch {
  op: 'add' | 'remove' | 'update' | 'replace';
  path: string[];
  value?: unknown;
}

interface AgUiEvent {
  type: string;
  payload: any;
}

// Simple schema patcher (mutable for performance, or returns new object)
export function applyPatch(schema: any, patch: A2UIPatch): any {
  if (!schema) return schema;
  const newSchema = JSON.parse(JSON.stringify(schema)); // Deep clone for safety
  
  let current = newSchema;
  const path = patch.path;
  
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (key === 'props' && !current.props) current.props = {};
    if (key === 'children' && !current.children) current.children = [];
    
    if (current[key] === undefined) {
      // Create intermediate objects if missing
      // If next key is a number, assume array
      if (!isNaN(Number(path[i+1]))) {
        current[key] = [];
      } else {
        current[key] = {};
      }
    }
    current = current[key];
  }
  
  const lastKey = path[path.length - 1];
  
  switch (patch.op) {
    case 'add':
    case 'replace':
    case 'update':
      current[lastKey] = patch.value;
      break;
    case 'remove':
      if (Array.isArray(current)) {
        const idx = Number(lastKey);
        if (!isNaN(idx)) current.splice(idx, 1);
      } else {
        delete current[lastKey];
      }
      break;
  }
  
  return newSchema;
}

export function useAgUi(gatewayUrl: string = 'ws://localhost:8010') {
  const [patches, setPatches] = useState<A2UIPatch[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(gatewayUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[AG-UI] Connected to gateway');
        setIsConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', channels: ['browser.patches'] }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'patch' || msg.type === 'browser.patch') {
            console.log('[AG-UI] Received patch:', msg.payload);
            setPatches(prev => [...prev, msg.payload]);
          } else if (msg.type === 'patches') {
             setPatches(prev => [...prev, ...msg.payload]);
          }
        } catch (e) {
          console.error('[AG-UI] Failed to parse message', e);
        }
      };

      ws.onclose = () => {
        console.log('[AG-UI] Disconnected');
        setIsConnected(false);
        // Retry connection
        retryTimeoutRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.warn('[AG-UI] WebSocket error', err);
        ws.close();
      };

    } catch (e) {
      console.error('[AG-UI] Connection failed', e);
      retryTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, [gatewayUrl]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [connect]);

  // Helper to apply all current patches to a schema
  const applyPatchesToSchema = useCallback((baseSchema: any) => {
    if (patches.length === 0) return baseSchema;
    
    let result = baseSchema;
    for (const patch of patches) {
      try {
        result = applyPatch(result, patch);
      } catch (e) {
        console.error('[AG-UI] Failed to apply patch', patch, e);
      }
    }
    return result;
  }, [patches]);

  const injectPatch = useCallback((patch: A2UIPatch) => {
    console.log('[AG-UI] Manually injecting patch:', patch);
    setPatches(prev => [...prev, patch]);
  }, []);

  useEffect(() => {
    const handleInject = (e: any) => {
      if (e.detail && e.detail.patch) {
        injectPatch(e.detail.patch);
      }
    };
    window.addEventListener('agui:inject-patch', handleInject);
    return () => window.removeEventListener('agui:inject-patch', handleInject);
  }, [injectPatch]);

  return {
    isConnected,
    patches,
    applyPatchesToSchema,
    injectPatch
  };
}
