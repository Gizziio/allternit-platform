/**
 * Message Bubble Component
 * 
 * Displays a single chat message with enhanced markdown rendering
 */

import React, { memo } from 'react';
import { Message } from './ChatContainer';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = memo(({
  message,
  isLast,
}) => {
  const isUser = message.role === 'user';

  return (
    <div 
      className={`message ${isUser ? 'user' : 'assistant'} ${isLast ? 'last' : ''}`}
    >
      <div className="message-avatar">
        {isUser ? (
          <div className="avatar user-avatar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        ) : (
          <div className="avatar ai-avatar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
      </div>

      <div className="message-content">
        <div className="message-header">
          <span className="sender-name">
            {isUser ? 'You' : 'Gizzi'}
          </span>
          <span className="timestamp">
            {formatTime(message.timestamp)}
          </span>
          {message.metadata?.source && (
            <span className="source-badge" data-source={message.metadata.source}>
              {message.metadata.source}
            </span>
          )}
        </div>

        <div className="message-body prose prose-sm dark:prose-invert max-w-none">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                // Enhanced code block rendering
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : 'plaintext';
                  
                  if (!inline && match) {
                    return (
                      <div className="code-block-wrapper">
                        <div className="code-block-header">
                          <span className="code-language">{language}</span>
                          <button 
                            className="copy-code-btn"
                            onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
                          >
                            Copy
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={language}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderRadius: '0 0 8px 8px',
                            fontSize: '13px',
                            lineHeight: '1.5',
                          }}
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  
                  return (
                    <code 
                      className={`inline-code ${className || ''}`} 
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                // Enhanced link rendering
                a({ children, href, ...props }) {
                  return (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="markdown-link"
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },
                // Enhanced heading rendering
                h1({ children }) {
                  return <h1 className="markdown-h1">{children}</h1>;
                },
                h2({ children }) {
                  return <h2 className="markdown-h2">{children}</h2>;
                },
                h3({ children }) {
                  return <h3 className="markdown-h3">{children}</h3>;
                },
                // Enhanced list rendering
                ul({ children }) {
                  return <ul className="markdown-ul">{children}</ul>;
                },
                ol({ children }) {
                  return <ol className="markdown-ol">{children}</ol>;
                },
                li({ children }) {
                  return <li className="markdown-li">{children}</li>;
                },
                // Enhanced blockquote rendering
                blockquote({ children }) {
                  return <blockquote className="markdown-blockquote">{children}</blockquote>;
                },
                // Enhanced table rendering
                table({ children }) {
                  return (
                    <div className="table-wrapper">
                      <table className="markdown-table">{children}</table>
                    </div>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {message.metadata && !isUser && (
          <div className="message-footer">
            {message.metadata.model && (
              <span className="metadata-item">{message.metadata.model}</span>
            )}
            {message.metadata.tokens && (
              <span className="metadata-item">{message.metadata.tokens} tokens</span>
            )}
            {message.metadata.latency && (
              <span className="metadata-item">{message.metadata.latency}ms</span>
            )}
          </div>
        )}
      </div>

      <style>{`
        .message {
          display: flex;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border-radius: var(--radius-lg);
          animation: fadeIn 0.3s ease;
        }
        
        .message.user {
          background: var(--color-bg-message-user);
        }
        
        .message.assistant {
          background: var(--color-bg-message-ai);
        }
        
        .message-avatar {
          flex-shrink: 0;
        }
        
        .avatar {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .user-avatar {
          background: var(--color-bg-tertiary);
          color: var(--color-text-secondary);
        }
        
        .ai-avatar {
          background: var(--color-accent);
          color: white;
        }
        
        .message-content {
          flex: 1;
          min-width: 0;
        }
        
        .message-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-xs);
        }
        
        .sender-name {
          font-weight: 600;
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
        }
        
        .timestamp {
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
        }
        
        .source-badge {
          font-size: var(--font-size-xs);
          padding: 1px 6px;
          border-radius: var(--radius-sm);
          background: var(--color-bg-tertiary);
          color: var(--color-text-secondary);
          text-transform: uppercase;
        }
        
        .source-badge[data-source="cloud"] {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }
        
        .source-badge[data-source="desktop"] {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        
        /* Enhanced message body styles */
        .message-body {
          color: var(--color-text-primary);
          line-height: 1.6;
          font-size: 14px;
        }
        
        .message-body p {
          margin: 0 0 var(--spacing-sm) 0;
        }
        
        .message-body p:last-child {
          margin-bottom: 0;
        }
        
        /* Inline code */
        .inline-code {
          background: var(--color-bg-tertiary);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          font-size: 0.9em;
          color: var(--color-accent);
        }
        
        /* Code block wrapper */
        .code-block-wrapper {
          margin: var(--spacing-md) 0;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 1px solid var(--color-border-light);
        }
        
        .code-block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #1e1e1e;
          border-bottom: 1px solid #333;
        }
        
        .code-language {
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
          font-family: 'SF Mono', Monaco, monospace;
        }
        
        .copy-code-btn {
          font-size: 11px;
          padding: 4px 8px;
          background: #333;
          color: #ccc;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .copy-code-btn:hover {
          background: #444;
          color: #fff;
        }
        
        /* Markdown headings */
        .markdown-h1 {
          font-size: 1.5em;
          font-weight: 600;
          margin: var(--spacing-lg) 0 var(--spacing-sm) 0;
          color: var(--color-text-primary);
        }
        
        .markdown-h2 {
          font-size: 1.25em;
          font-weight: 600;
          margin: var(--spacing-md) 0 var(--spacing-sm) 0;
          color: var(--color-text-primary);
          border-bottom: 1px solid var(--color-border-light);
          padding-bottom: 4px;
        }
        
        .markdown-h3 {
          font-size: 1.1em;
          font-weight: 600;
          margin: var(--spacing-md) 0 var(--spacing-xs) 0;
          color: var(--color-text-primary);
        }
        
        /* Lists */
        .markdown-ul,
        .markdown-ol {
          margin: var(--spacing-sm) 0;
          padding-left: var(--spacing-lg);
        }
        
        .markdown-li {
          margin: var(--spacing-xs) 0;
        }
        
        /* Blockquote */
        .markdown-blockquote {
          margin: var(--spacing-md) 0;
          padding: var(--spacing-sm) var(--spacing-md);
          border-left: 3px solid var(--color-accent);
          background: var(--color-bg-secondary);
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
          font-style: italic;
          color: var(--color-text-secondary);
        }
        
        /* Links */
        .markdown-link {
          color: var(--color-accent);
          text-decoration: none;
          font-weight: 500;
        }
        
        .markdown-link:hover {
          text-decoration: underline;
        }
        
        /* Tables */
        .table-wrapper {
          overflow-x: auto;
          margin: var(--spacing-md) 0;
        }
        
        .markdown-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        
        .markdown-table th,
        .markdown-table td {
          padding: 8px 12px;
          border: 1px solid var(--color-border-light);
          text-align: left;
        }
        
        .markdown-table th {
          background: var(--color-bg-secondary);
          font-weight: 600;
        }
        
        .markdown-table tr:nth-child(even) {
          background: var(--color-bg-secondary);
        }
        
        /* Message footer */
        .message-footer {
          display: flex;
          gap: var(--spacing-md);
          margin-top: var(--spacing-sm);
          padding-top: var(--spacing-sm);
          border-top: 1px solid var(--color-border-light);
        }
        
        .metadata-item {
          font-size: var(--font-size-xs);
          color: var(--color-text-tertiary);
        }
        
        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
