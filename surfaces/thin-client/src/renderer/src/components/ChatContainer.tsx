/**
 * Chat Container Component
 * 
 * Displays chat messages with auto-scroll
 */

import React, { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { StreamingIndicator } from './StreamingIndicator';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
    source?: 'cloud' | 'desktop';
  };
}

interface ChatContainerProps {
  messages: Message[];
  isStreaming: boolean;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isStreaming,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="chat-container" ref={containerRef}>
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2>Welcome to A2R</h2>
          <p>Press Cmd+Shift+A to toggle this window</p>
          <div className="shortcuts">
            <div className="shortcut">
              <kbd>Cmd+K</kbd>
              <span>Focus input</span>
            </div>
            <div className="shortcut">
              <kbd>Esc</kbd>
              <span>Hide window</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="messages">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
            />
          ))}
          {isStreaming && <StreamingIndicator />}
          <div ref={bottomRef} />
        </div>
      )}

      <style>{`
        .chat-container {
          flex: 1;
          overflow-y: auto;
          padding: var(--spacing-md);
          scroll-behavior: smooth;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: var(--color-text-secondary);
        }
        
        .empty-icon {
          margin-bottom: var(--spacing-lg);
          color: var(--color-border);
        }
        
        .empty-state h2 {
          font-size: var(--font-size-lg);
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: var(--spacing-sm);
        }
        
        .empty-state p {
          margin-bottom: var(--spacing-xl);
        }
        
        .shortcuts {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }
        
        .shortcut {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-md);
          font-size: var(--font-size-sm);
        }
        
        .shortcut kbd {
          padding: 4px 8px;
          background: var(--color-bg-tertiary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: var(--font-size-xs);
          min-width: 60px;
          text-align: center;
        }
        
        .messages {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }
      `}</style>
    </div>
  );
};
