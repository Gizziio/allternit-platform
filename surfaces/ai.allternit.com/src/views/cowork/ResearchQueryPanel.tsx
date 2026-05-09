'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MagnifyingGlass, ArrowClockwise, Spinner, WarningCircle } from '@phosphor-icons/react';
import { useResearchThread } from '@/lib/cowork/useResearchThread';
import { UnifiedMessageRenderer } from '@/components/ai-elements/UnifiedMessageRenderer';
import { parseStructuredContent } from '@/lib/ai/rust-stream-adapter-extended';

export function ResearchQueryPanel() {
  const { messages, isStreaming, streamBuffer, error, isHealthy, query, reset, checkHealth } = useResearchThread();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { checkHealth(); }, [checkHealth]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  const handleSubmit = () => {
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput('');
    query(q);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      border: '1px solid var(--ui-border-muted)',
      borderRadius: 12,
      overflow: 'hidden',
      background: 'var(--surface-raised, rgba(255,255,255,0.02))',
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--ui-border-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MagnifyingGlass size={16} style={{ color: 'var(--accent-primary)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Deep Research</span>
          {isHealthy !== null && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '1px 6px',
              borderRadius: 4,
              background: isHealthy ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isHealthy ? '#4ade80' : '#f87171',
            }}>
              {isHealthy ? 'Online' : 'Offline'}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={reset}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ui-text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
          >
            <ArrowClockwise size={13} />
            New thread
          </button>
        )}
      </div>

      {/* Messages */}
      {messages.length > 0 || isStreaming ? (
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: 10, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {msg.role === 'user' ? 'You' : 'Research'}
              </span>
              <div style={{
                maxWidth: '90%',
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.6,
                background: msg.role === 'user' ? 'var(--accent-primary, #7c6af7)' : 'rgba(255,255,255,0.05)',
                color: msg.role === 'user' ? '#fff' : 'var(--ui-text-primary)',
                whiteSpace: msg.role === 'user' ? 'pre-wrap' : undefined,
                wordBreak: 'break-word',
              }}>
                {msg.role === 'user' ? msg.content : (
                  <UnifiedMessageRenderer
                    parts={parseStructuredContent(msg.content)}
                    className="text-[13px]"
                  />
                )}
              </div>
            </div>
          ))}

          {/* Live stream buffer */}
          {isStreaming && streamBuffer && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Research</span>
              <div style={{
                maxWidth: '90%',
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.6,
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--ui-text-primary)',
                wordBreak: 'break-word',
              }}>
                <UnifiedMessageRenderer
                  parts={parseStructuredContent(streamBuffer)}
                  isStreaming
                  className="text-[13px]"
                />
              </div>
            </div>
          )}

          {isStreaming && !streamBuffer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ui-text-muted)', fontSize: 12 }}>
              <Spinner size={13} style={{ animation: 'spin 1s linear infinite' }} />
              Researching…
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      ) : null}

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', color: '#f87171', fontSize: 12 }}>
          <WarningCircle size={13} />
          {error}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: messages.length > 0 ? '1px solid var(--ui-border-muted)' : 'none', display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder={isHealthy === false ? 'Research service offline (start docker sidecar)' : 'Ask a deep research question…'}
          disabled={isStreaming || isHealthy === false}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--ui-border-muted)',
            borderRadius: 8,
            color: 'var(--ui-text-primary)',
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isStreaming || !input.trim() || isHealthy === false}
          style={{
            padding: '8px 16px',
            background: 'var(--accent-primary, #7c6af7)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: isStreaming || !input.trim() || isHealthy === false ? 'not-allowed' : 'pointer',
            opacity: isStreaming || !input.trim() || isHealthy === false ? 0.5 : 1,
          }}
        >
          {isStreaming ? <Spinner size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Ask'}
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
      `}</style>
    </div>
  );
}
