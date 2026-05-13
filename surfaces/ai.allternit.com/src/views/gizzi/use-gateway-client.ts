"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GatewayClient, type GatewayEventFrame } from "../openclaw/gateway-client";

export type GatewayStatus = "connecting" | "connected" | "disconnected" | "error";

export function useGatewayClient(wsUrl: string) {
  const clientRef = useRef<GatewayClient | null>(null);
  const [status, setStatus] = useState<GatewayStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const eventHandlers = useRef<Map<string, Array<(payload: unknown) => void>>>(new Map());

  useEffect(() => {
    setStatus("connecting");
    setError(null);

    const client = new GatewayClient({
      url: wsUrl,
      clientName: "allternit-gizzi-view",
      onHello: () => {
        setStatus("connected");
        setError(null);
      },
      onClose: () => {
        setStatus("disconnected");
      },
      onError: (err) => {
        setError(err.message);
        setStatus("error");
      },
      onEvent: (event: GatewayEventFrame) => {
        const handlers = eventHandlers.current.get(event.event) ?? [];
        for (const handler of handlers) {
          try { handler(event.payload); } catch { /* ignore */ }
        }
      },
    });

    client.start();
    clientRef.current = client;

    return () => {
      client.stop();
      clientRef.current = null;
    };
  }, [wsUrl]);

  const request = useCallback(
    <T = unknown>(method: string, params?: unknown): Promise<T> => {
      const client = clientRef.current;
      if (!client) return Promise.reject(new Error("gateway not initialized"));
      return client.request<T>(method, params);
    },
    [],
  );

  const on = useCallback((event: string, handler: (payload: unknown) => void) => {
    const handlers = eventHandlers.current.get(event) ?? [];
    handlers.push(handler);
    eventHandlers.current.set(event, handlers);
    return () => {
      const updated = (eventHandlers.current.get(event) ?? []).filter((h) => h !== handler);
      eventHandlers.current.set(event, updated);
    };
  }, []);

  return { status, error, request, on };
}
