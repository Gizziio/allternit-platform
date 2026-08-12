'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Terminal, FolderOpen, GitBranch, GearSix, Paperclip, PaperPlaneTilt, CircleNotch } from '@phosphor-icons/react';
import { TEXT, MODE_COLORS } from '@/design/allternit.tokens';
import { AgentSessionLayout } from './AgentSessionLayout';
import type { BaseAgentSessionProps } from './types';
import { useCodeSessionStore, createCodeSession } from '@/views/code/CodeSessionStore';
import { UnifiedMessageRenderer } from '@/components/ai-elements/UnifiedMessageRenderer';
import { parseStructuredContent } from '@/lib/ai/rust-stream-adapter-extended';
import { TerminalView } from '../TerminalView';
import { ExplorerView } from '../code/ExplorerView';
import { GitView } from '../code/GitView';

export interface CodeModeAgentSessionProps {
  sessionId?: string;
  agentId?: string;
  onClose?: () => void;
}

export function CodeModeAgentSession({
  sessionId: sessionIdProp,
  agentId,
  onClose,
}: CodeModeAgentSessionProps) {
  const mode = 'code';
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.code;

  const activeSessionId = useCodeSessionStore((s) => s.activeSessionId);
  const sessionId = sessionIdProp ?? activeSessionId;

  const sessions = useCodeSessionStore((s) => s.sessions);
  const session = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId]
  );
  const messages = session?.messages ?? [];

  const streamingState = useCodeSessionStore((s) =>
    sessionId ? s.streamingBySession?.[sessionId] : null
  );
  const isStreaming = streamingState?.isStreaming ?? false;

  const sendMessageStream = useCodeSessionStore((s) => s.sendMessageStream);
  const setActiveSession = useCodeSessionStore((s) => s.setActiveSession);
  const fetchMessages = useCodeSessionStore((s) => s.fetchMessages);

  const loadedSessionRef = useRef<string | null>(null);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeRightTab, setActiveRightTab] = useState<'terminal' | 'explorer' | 'git'>('terminal');

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
      sid = await createCodeSession({ name: 'Code Agent', sessionMode: 'agent', agentId });
      setActiveSession(sid);
    }

    await sendMessageStream(sid, { text });
  }, [input, isStreaming, sessionId, agentId, setActiveSession, sendMessageStream]);

  const rightPaneContent = useMemo(() => {
    switch (activeRightTab) {
      case 'explorer':
        return <ExplorerView />;
      case 'git':
        return <GitView />;
      default:
        return <TerminalView noPadding />;
    }
  }, [activeRightTab]);

  return (
    <AgentSessionLayout
      mode={mode}
      title="Code Agent Session"
      agentName="Codex Engine"
      status={isStreaming ? 'streaming' : 'idle'}
      onClose={onClose}
      computerView={
        <div className="flex flex-col h-full bg-[#151311]">
          {/* Right Tabs bar */}
          <div className="h-10 flex border-b border-[var(--surface-hover)] bg-[#0d0b09] px-2 items-center justify-between shrink-0">
            <div className="flex gap-1">
              {(['terminal', 'explorer', 'git'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveRightTab(tab)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold capitalize transition-colors"
                  style={{
                    backgroundColor: activeRightTab === tab ? 'var(--surface-hover)' : 'transparent',
                    color: activeRightTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {tab === 'terminal' && <Terminal size={14} />}
                  {tab === 'explorer' && <FolderOpen size={14} />}
                  {tab === 'git' && <GitBranch size={14} />}
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative">
            {rightPaneContent}
          </div>
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
              <h3 style={{ color: 'var(--text-primary)' }} className="text-lg font-semibold mb-2">Code Mode Agent</h3>
              <p style={{ color: 'var(--text-secondary)' }} className="text-sm max-w-md">
                Codex agent execution workspace. Send a prompt to begin editing the files in your workspace.
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
                Agent is coding...
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
                placeholder="Instruct the agent..."
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

export default CodeModeAgentSession;
