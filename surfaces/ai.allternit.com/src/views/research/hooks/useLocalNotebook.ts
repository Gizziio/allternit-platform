/**
 * Local Notebook Storage
 *
 * Falls back to localStorage when the Open Notebook Python backend
 * is unavailable. Provides the same CRUD interface so ResearchTab
 * can render a fully functional UI regardless of backend status.
 */

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Notebook, Source, ChatMessage } from './useNotebookApi';

const NB_KEY = 'allternit-local-notebooks';
const SRC_KEY = (nbId: string) => `allternit-local-sources-${nbId}`;
const MSG_KEY = (nbId: string) => `allternit-local-messages-${nbId}`;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or private mode
  }
}

function generateId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useLocalNotebooks() {
  const [sources, setSources] = useState<Source[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const notebooks = useSyncExternalStore(
    useCallback(() => () => {}, []),
    useCallback(() => loadJSON<Notebook[]>(NB_KEY, []), []),
    useCallback(() => [], [])
  );

  const selectNotebook = useCallback((notebookId: string | null) => {
    if (!notebookId) {
      setSources([]);
      setMessages([]);
      return;
    }
    setSources(loadJSON<Source[]>(SRC_KEY(notebookId), []));
    setMessages(loadJSON<ChatMessage[]>(MSG_KEY(notebookId), []));
  }, []);

  const createNotebook = useCallback((title: string, description?: string) => {
    const notebook: Notebook = {
      id: generateId(),
      title,
      description,
      source_count: 0,
      token_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const existing = loadJSON<Notebook[]>(NB_KEY, []);
    const next = [notebook, ...existing];
    setNotebooks(next);
    saveJSON(NB_KEY, next);
    return notebook;
  }, []);

  const deleteNotebook = useCallback((id: string) => {
    const existing = loadJSON<Notebook[]>(NB_KEY, []);
    const next = existing.filter(n => n.id !== id);
    setNotebooks(next);
    saveJSON(NB_KEY, next);
    localStorage.removeItem(SRC_KEY(id));
    localStorage.removeItem(MSG_KEY(id));
  }, []);

  const addSource = useCallback((notebookId: string, source: Partial<Source>) => {
    const newSource: Source = {
      id: generateId(),
      notebook_id: notebookId,
      type: source.type ?? 'text',
      title: source.title ?? 'Untitled Source',
      url: source.url,
      content: source.content,
      token_count: source.token_count ?? 0,
      status: 'extracted',
      metadata: source.metadata,
    };
    const existing = loadJSON<Source[]>(SRC_KEY(notebookId), []);
    const next = [...existing, newSource];
    setSources(next);
    saveJSON(SRC_KEY(notebookId), next);
    return newSource;
  }, []);

  const removeSource = useCallback((notebookId: string, sourceId: string) => {
    const existing = loadJSON<Source[]>(SRC_KEY(notebookId), []);
    const next = existing.filter(s => s.id !== sourceId);
    setSources(next);
    saveJSON(SRC_KEY(notebookId), next);
  }, []);

  const sendMessage = useCallback(async (
    notebookId: string,
    content: string,
    onChunk?: (chunk: { text?: string; citation?: any; done?: boolean }) => void
  ) => {
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    const replyText = `This is a local-mode response. The research backend is offline, so I'm running in browser-only mode.\n\nYour message: "${content}"`;
    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: replyText,
      timestamp: new Date().toISOString(),
    };
    const existing = loadJSON<ChatMessage[]>(MSG_KEY(notebookId), []);
    const next = [...existing, userMsg, assistantMsg];
    saveJSON(MSG_KEY(notebookId), next);

    if (onChunk) {
      // Simulate streaming
      onChunk({ text: replyText });
      onChunk({ done: true });
    }
    return assistantMsg;
  }, []);

  return useMemo(() => ({
    notebooks,
    sources,
    messages,
    selectNotebook,
    createNotebook,
    deleteNotebook,
    addSource,
    removeSource,
    sendMessage,
    setNotebooks,
    setSources,
    setMessages,
  }), [notebooks, sources, messages, selectNotebook, createNotebook, deleteNotebook, addSource, removeSource, sendMessage]);
}
