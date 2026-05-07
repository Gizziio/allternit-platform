/**
 * Agentation Provider
 * 
 * DEV-ONLY: Wrapped with NODE_ENV check to prevent production inclusion
 */

import React, { createContext, useState, useCallback, useMemo } from 'react';
import type { AgentationConfig, AgentMessage, AgentationContextValue } from './types';

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

interface AgentationProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<AgentationConfig>;
}

const defaultConfig: AgentationConfig = {
  enabled: isDev,
  role: 'UI_IMPLEMENTER',
  allowedTools: ['file_read', 'file_write', 'storybook_preview'],
  scopePaths: ['src/components/', 'src/app/'],
};

export const AgentationContext = createContext<AgentationContextValue | null>(null);

export function AgentationProvider({ 
  children, 
  initialConfig 
}: AgentationProviderProps): JSX.Element {
  // In production, just render children without any agentation functionality
  if (!isDev) {
    return <>{children}</>;
  }

  const [config, setConfig] = useState<AgentationConfig>({
    ...defaultConfig,
    ...initialConfig,
  });
  
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    if (!config.enabled) return;

    const userMessage: AgentMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Simulate agent processing (replace with actual Allternit adapter call)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const assistantMessage: AgentMessage = {
        id: `msg_${Date.now()}_resp`,
        role: 'assistant',
        content: `Processed as ${config.role}: ${content}`,
        timestamp: Date.now(),
        metadata: {
          toolCalls: [],
        },
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Agentation error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [config.enabled, config.role]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const updateConfig = useCallback((updates: Partial<AgentationConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const value = useMemo<AgentationContextValue>(() => ({
    config,
    messages,
    isProcessing,
    sendMessage,
    clearMessages,
    updateConfig,
  }), [config, messages, isProcessing, sendMessage, clearMessages, updateConfig]);

  return (
    <AgentationContext.Provider value={value}>
      {children}
    </AgentationContext.Provider>
  );
}
