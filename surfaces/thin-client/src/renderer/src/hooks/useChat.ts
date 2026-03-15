/**
 * useChat Hook - A2R Platform Integration
 *
 * - Creates a gizzi-code session on first message via @a2r/sdk
 * - Sends prompts via sdk.session.prompt()
 * - Receives events via sdk.global.event() (SSE)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Message } from '../components/ChatContainer';
import { sessionApi } from '../lib/session-api';

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // Subscribe to global events when a session is created
  useEffect(() => {
    if (!sessionIdRef.current) return;

    // Clean up prior subscription
    unsubRef.current?.();

    const unsub = sessionApi.subscribeToEvents((payload: any) => {
      const type = payload?.type as string | undefined;
      const props = payload?.properties;

      // Accumulate streamed text parts (message.part.updated with type=text)
      if (type === 'message.part.updated') {
        const part = props?.part;
        if (part?.type === 'text' && part?.messageID) {
          setMessages(prev => {
            const existing = prev.find(m => m.id === part.messageID);
            if (existing) {
              return prev.map(m =>
                m.id === part.messageID
                  ? { ...m, content: part.text ?? m.content }
                  : m,
              );
            }
            // First chunk — create the message
            return [
              ...prev,
              {
                id: part.messageID,
                role: 'assistant' as const,
                content: part.text ?? '',
                timestamp: new Date(),
              },
            ];
          });
        }
        return;
      }

      // Session went idle → streaming done
      if (type === 'session.status') {
        const status = props?.status;
        if (status?.type === 'idle' || status?.type === 'error') {
          setIsStreaming(false);
        }
        return;
      }
    });

    unsubRef.current = unsub;
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdRef.current]);

  const sendMessage = useCallback(async (content: string) => {
    // Create session on first message
    if (!sessionIdRef.current) {
      try {
        const session = await sessionApi.createSession('Thin Client Chat');
        sessionIdRef.current = session.id;
      } catch (error) {
        console.error('[useChat] Failed to create session:', error);
        setMessages(prev => [
          ...prev,
          {
            id: generateId(),
            role: 'system',
            content: `A2R backend not running.\n\nStart with: ./dev/scripts/start-all.sh\n\nThen try again.`,
            timestamp: new Date(),
          },
        ]);
        return;
      }
    }

    // Optimistic user message
    setMessages(prev => [
      ...prev,
      { id: generateId(), role: 'user', content, timestamp: new Date() },
    ]);
    setIsStreaming(true);

    try {
      await sessionApi.sendMessage(sessionIdRef.current!, content);
      // Response arrives via SSE event subscription above
    } catch (error) {
      console.error('[useChat] Failed to send message:', error);
      setIsStreaming(false);
      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          role: 'system',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [
      ...prev,
      { id: generateId(), role: 'system', content, timestamp: new Date() },
    ]);
  }, []);

  return { messages, isStreaming, sendMessage, clearChat, addSystemMessage };
}
