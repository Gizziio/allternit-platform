/**
 * Terminal Server Hook
 * 
 * Provides React interface to the Terminal Server API for AI models.
 * This hook connects to the Terminal Server running on port 4096
 * to fetch available models, create sessions, and stream responses.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const TERMINAL_SERVER_URL = import.meta.env.VITE_TERMINAL_SERVER_URL || 'http://127.0.0.1:4096';

// Types
export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  cost?: {
    input: number;
    output: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface UseTerminalServerReturn {
  // State
  providers: AIProvider[];
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  isConnected: boolean;
  
  // Actions
  fetchProviders: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  createSession: (title: string, model?: string) => Promise<ChatSession | null>;
  sendMessage: (content: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  selectSession: (session: ChatSession) => void;
  clearError: () => void;
}

export function useTerminalServer(): UseTerminalServerReturn {
  // State
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${TERMINAL_SERVER_URL}/doc`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        setIsConnected(response.ok);
      } catch {
        setIsConnected(false);
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30s
    
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Fetch available AI providers and models
   */
  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${TERMINAL_SERVER_URL}/provider`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch providers: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform the response to our format
      const transformedProviders: AIProvider[] = data.all?.map((p: any) => ({
        id: p.id,
        name: p.name,
        models: Object.entries(p.models || {}).map(([id, m]: [string, any]) => ({
          id: `${p.id}/${id}`,
          name: m.name || id,
          provider: p.id,
          cost: m.cost,
        })),
      })) || [];
      
      setProviders(transformedProviders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch providers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch all chat sessions
   */
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${TERMINAL_SERVER_URL}/session`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSessions(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new chat session
   */
  const createSession = useCallback(async (
    title: string,
    model?: string
  ): Promise<ChatSession | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${TERMINAL_SERVER_URL}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, model }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }
      
      const session: ChatSession = await response.json();
      setSessions(prev => [session, ...prev]);
      setCurrentSession(session);
      setMessages([]);
      
      return session;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Send a message in the current session
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!currentSession) {
      setError('No active session');
      return;
    }

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);
    setError(null);

    // Create placeholder for assistant response
    const assistantMessageId = `msg_${Date.now()}_assistant`;
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }]);

    try {
      // Start SSE connection for streaming
      const eventSource = new EventSource(`${TERMINAL_SERVER_URL}/event`);
      eventSourceRef.current = eventSource;

      let accumulatedContent = '';

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different event types
          if (data.type === 'message.delta' && data.properties?.content) {
            accumulatedContent += data.properties.content;
            
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            ));
          }
          
          if (data.type === 'message.complete') {
            eventSource.close();
            setIsStreaming(false);
          }
        } catch {
          // Ignore parse errors for non-JSON messages
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setIsStreaming(false);
      };

      // Send the message via POST
      abortControllerRef.current = new AbortController();
      
      const response = await fetch(
        `${TERMINAL_SERVER_URL}/session/${currentSession.id}/prompt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: content,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled, not an error
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      }
      setIsStreaming(false);
      eventSourceRef.current?.close();
    }
  }, [currentSession]);

  /**
   * Delete a session
   */
  const deleteSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${TERMINAL_SERVER_URL}/session/${sessionId}`,
        { method: 'DELETE' }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`);
      }
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    } finally {
      setIsLoading(false);
    }
  }, [currentSession]);

  /**
   * Select a session and load its messages
   */
  const selectSession = useCallback(async (session: ChatSession) => {
    setCurrentSession(session);
    setMessages([]);
    setIsLoading(true);
    
    try {
      // Fetch session messages if endpoint exists
      const response = await fetch(
        `${TERMINAL_SERVER_URL}/session/${session.id}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      }
    } catch {
      // Ignore errors, session might not have messages yet
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear any error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    providers,
    sessions,
    currentSession,
    messages,
    isLoading,
    isStreaming,
    error,
    isConnected,
    fetchProviders,
    fetchSessions,
    createSession,
    sendMessage,
    deleteSession,
    selectSession,
    clearError,
  };
}

export default useTerminalServer;
