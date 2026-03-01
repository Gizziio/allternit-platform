/**
 * useBrainChat Hook
 * 
 * Manages chat sessions with kernel brain runtimes (ACP/JSONL).
 * Handles session creation, streaming, tool calls, and error handling.
 */

import { useState, useCallback, useRef } from 'react';
import { api } from '@/integration/api-client';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

export interface ToolCall {
  id: string;
  toolId: string;
  args: unknown;
  result?: unknown;
  error?: string;
  status: 'running' | 'completed' | 'error';
}

export interface UseBrainChatOptions {
  chatId: string;
  brainProfileId: string;
  runtimeModelId?: string;
  onError?: (error: { code: string; message: string }) => void;
}

export interface UseBrainChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  currentToolCalls: ToolCall[];
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

export function useBrainChat(options: UseBrainChatOptions): UseBrainChatReturn {
  const { chatId, brainProfileId, runtimeModelId, onError } = options;
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (isStreaming) return;
    
    setIsStreaming(true);
    setIsLoading(true);
    setError(null);
    setCurrentToolCalls([]);
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Assistant message placeholder
    const assistantMessageId = `msg-${Date.now() + 1}`;
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: new Date()
    }]);

    try {
      let accumulatedContent = '';
      const activeToolCalls = new Map<string, ToolCall>();

      await api.chat({
        message: content,
        chatId,
        modelId: brainProfileId,
        runtimeModelId,
        onEvent: (event) => {
          switch (event.type) {
            case 'session.started':
              // Session started, begin streaming
              console.log('[useBrainChat] Session started:', event.payload);
              break;
              
            case 'content_block_delta':
              // Text streaming
              const delta = event.delta as { type: string; text?: string };
              if (delta.type === 'text_delta' && delta.text) {
                accumulatedContent += delta.text;
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              }
              break;
              
            case 'tool_call_start':
              // Tool call started
              const toolCall: ToolCall = {
                id: event.call_id as string,
                toolId: event.tool_id as string,
                args: event.args,
                status: 'running'
              };
              activeToolCalls.set(toolCall.id, toolCall);
              setCurrentToolCalls(Array.from(activeToolCalls.values()));
              
              // Add to message tool calls
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, toolCalls: Array.from(activeToolCalls.values()) }
                  : msg
              ));
              break;
              
            case 'tool_call_result':
              // Tool call completed
              const callId = event.call_id as string;
              const existingCall = activeToolCalls.get(callId);
              if (existingCall) {
                existingCall.status = event.error ? 'error' : 'completed';
                existingCall.result = event.result;
                existingCall.error = event.error as string;
                activeToolCalls.set(callId, existingCall);
                setCurrentToolCalls(Array.from(activeToolCalls.values()));
                
                // Update message tool calls
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, toolCalls: Array.from(activeToolCalls.values()) }
                    : msg
                ));
              }
              break;
              
            case 'finish':
              // Stream complete
              setIsStreaming(false);
              setIsLoading(false);
              break;
              
            case 'error':
              // Error in stream
              const errorMsg = event.message as string;
              setError(errorMsg);
              setIsStreaming(false);
              setIsLoading(false);
              toast({
                title: 'Chat error',
                description: errorMsg,
                variant: 'destructive'
              });
              break;
          }
        },
        onError: (err) => {
          setError(err.message);
          setIsStreaming(false);
          setIsLoading(false);
          onError?.(err);
          toast({
            title: 'Chat error',
            description: err.message,
            variant: 'destructive'
          });
        }
      });
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
      setIsStreaming(false);
      setIsLoading(false);
      
      toast({
        title: 'Chat error',
        description: message,
        variant: 'destructive'
      });
    }
  }, [chatId, brainProfileId, runtimeModelId, isStreaming, onError, toast]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setCurrentToolCalls([]);
  }, []);

  return {
    messages,
    isStreaming,
    isLoading,
    error,
    currentToolCalls,
    sendMessage,
    clearMessages
  };
}
