"use client";

import { useCallback, useRef, useState } from "react";
import type { Message, SessionSummary, StreamEvent } from "./gizzi-claw-api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  toolCalls: Array<{ id: string; name: string; arguments: unknown; result?: unknown; error?: string }>;
  timestamp: string;
  streaming?: boolean;
}

export interface GizziKernelApi {
  healthCheck(): Promise<{ healthy: boolean; version?: string }>;
  listSessions(): Promise<SessionSummary[]>;
  createSession(name?: string, description?: string): Promise<{ id: string; name?: string }>;
  deleteSession(sessionId: string): Promise<void>;
  getMessages(sessionId: string): Promise<Message[]>;
  abortGeneration(sessionId: string): Promise<void>;
}

export type ChatStreamFn = (
  sessionId: string,
  message: string,
  signal?: AbortSignal,
) => AsyncGenerator<StreamEvent>;

function apiMessageToChatMessage(m: Message): ChatMessage {
  return {
    id: m.id,
    role: m.role as ChatMessage["role"],
    content: m.content,
    toolCalls: [],
    timestamp: m.timestamp,
  };
}

export function useGizziChat(api: GizziKernelApi, streamFn: ChatStreamFn) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      setSessions(await api.listSessions());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
    } finally {
      setLoadingSessions(false);
    }
  }, [api]);

  const selectSession = useCallback(
    async (sessionId: string) => {
      setActiveSessionId(sessionId);
      setMessages([]);
      setLoadingMessages(true);
      setError(null);
      try {
        const msgs = await api.getMessages(sessionId);
        setMessages(msgs.map(apiMessageToChatMessage));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load messages");
      } finally {
        setLoadingMessages(false);
      }
    },
    [api],
  );

  const createSession = useCallback(async () => {
    setError(null);
    try {
      const session = await api.createSession(`Session ${new Date().toLocaleString()}`);
      await Promise.all([
        loadSessions(),
        selectSession(session.id)
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session");
    }
  }, [api, loadSessions, selectSession]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await api.deleteSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
          setMessages([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete session");
      }
    },
    [api, activeSessionId],
  );

  const sendMessage = useCallback(async () => {
    if (!activeSessionId || !draft.trim() || streaming) return;

    const text = draft.trim();
    setDraft("");
    setStreaming(true);
    setError(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      toolCalls: [],
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const assistantId = `asst-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      toolCalls: [],
      timestamp: new Date().toISOString(),
      streaming: true,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      for await (const event of streamFn(activeSessionId, text, abortRef.current.signal)) {
        if (event.type === "message_delta") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: m.content + (event.delta.content ?? ""),
                    reasoning: event.delta.reasoning
                      ? (m.reasoning ?? "") + event.delta.reasoning
                      : m.reasoning,
                  }
                : m,
            ),
          );
        } else if (event.type === "tool_call") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    toolCalls: [
                      ...m.toolCalls,
                      {
                        id: event.tool_call.id,
                        name: event.tool_call.name,
                        arguments: event.tool_call.arguments,
                      },
                    ],
                  }
                : m,
            ),
          );
        } else if (event.type === "tool_result") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    toolCalls: m.toolCalls.map((tc) =>
                      tc.id === event.tool_result.tool_call_id
                        ? { ...tc, result: event.tool_result.result }
                        : tc,
                    ),
                  }
                : m,
            ),
          );
        } else if (event.type === "tool_error") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    toolCalls: m.toolCalls.map((tc) =>
                      tc.id === event.tool_call_id ? { ...tc, error: event.error } : tc,
                    ),
                  }
                : m,
            ),
          );
        } else if (event.type === "error") {
          setError(event.error);
          break;
        } else if (event.type === "done") {
          break;
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message);
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
      );
      setStreaming(false);
      abortRef.current = null;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, message_count: s.message_count + 2 }
            : s,
        ),
      );
    }
  }, [activeSessionId, draft, streaming, streamFn]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    if (activeSessionId) api.abortGeneration(activeSessionId).catch(() => {});
  }, [api, activeSessionId]);

  return {
    sessions,
    activeSessionId,
    messages,
    draft,
    setDraft,
    streaming,
    loadingSessions,
    loadingMessages,
    error,
    loadSessions,
    selectSession,
    createSession,
    deleteSession,
    sendMessage,
    abort,
  };
}
