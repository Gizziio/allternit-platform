'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { GearSix, Paperclip, PaperPlaneTilt, CircleNotch } from '@phosphor-icons/react';
import { TEXT, MODE_COLORS } from '@/design/allternit.tokens';
import { AgentSessionLayout } from './AgentSessionLayout';
import type { BaseAgentSessionProps } from './types';
import { useDesignSessionStore, createDesignSession } from '@/views/design/DesignSessionStore';
import { UnifiedMessageRenderer } from '@/components/ai-elements/UnifiedMessageRenderer';
import { parseStructuredContent } from '@/lib/ai/rust-stream-adapter-extended';
import DesignModeView from '../design/DesignModeView';

export interface DesignModeAgentSessionProps {
  sessionId?: string;
  agentId?: string;
  onClose?: () => void;
}

export function DesignModeAgentSession({
  sessionId: sessionIdProp,
  agentId,
  onClose,
}: DesignModeAgentSessionProps) {
  const mode = 'design';
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.design;

  const activeSessionId = useDesignSessionStore((s) => s.activeSessionId);
  const sessionId = sessionIdProp ?? activeSessionId;

  const sessions = useDesignSessionStore((s) => s.sessions);
  const session = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId]
  );
  const messages = session?.messages ?? [];

  const streamingState = useDesignSessionStore((s) =>
    sessionId ? s.streamingBySession?.[sessionId] : null
  );
  const isStreaming = streamingState?.isStreaming ?? false;

  const sendMessageStream = useDesignSessionStore((s) => s.sendMessageStream);
  const setActiveSession = useDesignSessionStore((s) => s.setActiveSession);
  const fetchMessages = useDesignSessionStore((s) => s.fetchMessages);

  const loadedSessionRef = useRef<string | null>(null);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  // Deep-link: when opened with an existing backend session id, load its
  // messages from the backend instead of showing the empty state.
  useEffect(() => {
    if (!sessionId || !sessionId.startsWith('ses')) return;
    if (loadedSessionRef.current === sessionId) return;
    loadedSessionRef.current = sessionId;
    void fetchMessages(sessionId);
  }, [sessionId, fetchMessages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput('');

    let sid = sessionId;
    if (!sid) {
      sid = await createDesignSession({ name: 'Design Agent', sessionMode: 'agent', agentId });
      setActiveSession(sid);
    }

    await sendMessageStream(sid, { text });
  }, [input, isStreaming, sessionId, agentId, setActiveSession, sendMessageStream]);

  return (
    <AgentSessionLayout
      mode={mode}
      title="Design Agent Session"
      agentName="Canvas Architect"
      status={isStreaming ? 'streaming' : 'idle'}
      onClose={onClose}
      computerView={
        <div className="flex-1 h-full overflow-hidden relative">
          <DesignModeView />
        </div>
      }
      headerActions={
        <button type="button" className="p-2 rounded-lg transition-colors" style={{ color: TEXT.tertiary }}>
          <GearSix size={16} />
        </button>
      }
    >
      {/* Left Chat Pane */}
      <div className="flex flex-col h-full bg-[#0D0B09] relative">
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <h3 style={{ color: 'var(--text-primary)' }} className="text-lg font-semibold mb-2">Design Mode Agent</h3>
              <p style={{ color: 'var(--text-secondary)' }} className="text-sm max-w-md">
                Architectural design workspace. Type prompt to generate canvas elements and layouts.
              </p>
            </div>
          ) : (
            messages.map(msg => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className="p-3 rounded-xl max-w-[85%]"
                    style={{
                      background: isUser ? 'var(--accent-primary)' : 'var(--surface-hover)',
                      color: isUser ? '#0d0b09' : 'var(--text-primary)',
                    }}
                  >
                    {isUser ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <UnifiedMessageRenderer
                        parts={parseStructuredContent(msg.content)}
                        className="text-sm"
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
          
          {isStreaming && (
            <div className="flex items-center gap-2 p-2">
              <CircleNotch size={16} className="animate-spin" style={{ color: modeColors.accent }} />
              <span className="text-sm" style={{ color: TEXT.tertiary }}>
                Agent is designing...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Textarea */}
        <div className="p-4 border-t" style={{ borderColor: modeColors.border, background: 'var(--surface-panel)' }}>
          <div className="flex items-end gap-2">
            <button type="button"
              className="p-3 rounded-xl transition-colors shrink-0"
              style={{ background: 'var(--surface-hover)', color: TEXT.tertiary }}
              title="Attach file"
            >
              <Paperclip size={20} />
            </button>

            <div className="flex-1 relative">
              <textarea aria-label="Input Area" value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Instruct the designer..."
                rows={1}
                className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${modeColors.border}`,
                  color: TEXT.primary,
                  minHeight: '48px',
                  maxHeight: '120px',
                }}
              />
            </div>

            <button type="button"
              onClick={() => void handleSend()}
              disabled={!input.trim() || isStreaming}
              className="p-3 rounded-xl transition-all disabled:opacity-50 shrink-0"
              style={{ background: modeColors.accent, color: '#0D0B09' }}
              title="Send instruction"
            >
              <PaperPlaneTilt size={20} />
            </button>
          </div>
        </div>
      </div>
    </AgentSessionLayout>
  );
}

export default DesignModeAgentSession;
