/**
 * Global SSE Manager
 *
 * Prevents duplicate EventSource connections across components.
 * One URL = one EventSource, shared via a listener multicast pattern.
 *
 * Features:
 * - Reference-counted disposal
 * - Custom event type support (addEventListener)
 * - Connection/error callbacks
 * - Automatic JSON parsing
 *
 * Inspired by OpenWork's GlobalSDKProvider event coalescing.
 */

export type SSEMessageHandler = (data: unknown, event: MessageEvent) => void;
export type SSEEventHandler = (event: MessageEvent) => void;
export type SSEErrorHandler = (error: Event) => void;
export type SSEOpenHandler = () => void;

interface SSEListenerSet {
  message: Set<SSEMessageHandler>;
  error: Set<SSEErrorHandler>;
  open: Set<SSEOpenHandler>;
  custom: Map<string, Set<SSEEventHandler>>;
}

interface SSEConnection {
  source: EventSource;
  listeners: SSEListenerSet;
  refCount: number;
}

const connections = new Map<string, SSEConnection>();

function getOrCreateConnection(url: string): SSEConnection {
  let connection = connections.get(url);

  if (!connection) {
    const source = new EventSource(url);
    const listeners: SSEListenerSet = {
      message: new Set(),
      error: new Set(),
      open: new Set(),
      custom: new Map(),
    };

    source.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        data = event.data;
      }
      listeners.message.forEach((cb) => {
        try {
          cb(data, event);
        } catch (err) {
          console.error('[GlobalSSE] Message handler error:', err);
        }
      });
    };

    source.onerror = (error) => {
      listeners.error.forEach((cb) => {
        try {
          cb(error);
        } catch (err) {
          console.error('[GlobalSSE] Error handler error:', err);
        }
      });
    };

    source.onopen = () => {
      listeners.open.forEach((cb) => {
        try {
          cb();
        } catch (err) {
          console.error('[GlobalSSE] Open handler error:', err);
        }
      });
    };

    // Wire up custom event listeners via a single handler that dispatches
    const customHandler = (event: Event) => {
      const msgEvent = event as MessageEvent;
      const type = msgEvent.type;
      const handlers = listeners.custom.get(type);
      if (handlers) {
        handlers.forEach((cb) => {
          try {
            cb(msgEvent);
          } catch (err) {
            console.error(`[GlobalSSE] Custom handler error for ${type}:`, err);
          }
        });
      }
    };

    // Store reference so we can add/remove custom listeners dynamically
    (source as any).__global_sse_custom_handler__ = customHandler;

    connection = { source, listeners, refCount: 0 };
    connections.set(url, connection);
  }

  return connection;
}

export interface SSESubscriptionOptions {
  onMessage?: SSEMessageHandler;
  onError?: SSEErrorHandler;
  onOpen?: SSEOpenHandler;
  onCustom?: Record<string, SSEEventHandler>;
}

/**
 * Subscribe to an SSE endpoint. Returns unsubscribe function.
 * Multiple subscribers to the same URL share one EventSource.
 */
export function subscribeSSE(url: string, options: SSESubscriptionOptions = {}): () => void {
  const connection = getOrCreateConnection(url);
  const { onMessage, onError, onOpen, onCustom } = options;

  if (onMessage) connection.listeners.message.add(onMessage);
  if (onError) connection.listeners.error.add(onError);
  if (onOpen) connection.listeners.open.add(onOpen);

  if (onCustom) {
    for (const [eventType, handler] of Object.entries(onCustom)) {
      let handlers = connection.listeners.custom.get(eventType);
      if (!handlers) {
        handlers = new Set();
        connection.listeners.custom.set(eventType, handlers);
        connection.source.addEventListener(eventType, (connection.source as any).__global_sse_custom_handler__);
      }
      handlers.add(handler);
    }
  }

  connection.refCount++;

  return () => {
    if (onMessage) connection.listeners.message.delete(onMessage);
    if (onError) connection.listeners.error.delete(onError);
    if (onOpen) connection.listeners.open.delete(onOpen);

    if (onCustom) {
      for (const [eventType, handler] of Object.entries(onCustom)) {
        const handlers = connection.listeners.custom.get(eventType);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            connection.listeners.custom.delete(eventType);
            connection.source.removeEventListener(eventType, (connection.source as any).__global_sse_custom_handler__);
          }
        }
      }
    }

    connection.refCount--;

    if (connection.refCount <= 0) {
      connection.source.close();
      connections.delete(url);
    }
  };
}

/**
 * Get the current connection count for debugging.
 */
export function getSSEConnectionStats(): { url: string; refCount: number }[] {
  return Array.from(connections.entries()).map(([url, conn]) => ({
    url,
    refCount: conn.refCount,
  }));
}

/**
 * Close all SSE connections. Useful for logout / cleanup.
 */
export function closeAllSSEConnections(): void {
  connections.forEach((conn) => conn.source.close());
  connections.clear();
}
