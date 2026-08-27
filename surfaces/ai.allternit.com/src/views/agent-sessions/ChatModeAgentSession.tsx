'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PaperPlaneTilt,
  Paperclip,
  Sparkle,
  Robot,
  User,
  CircleNotch,
  Copy,
  DotsThreeOutline,
  GearSix,
  CaretLeft,
} from '@phosphor-icons/react';

import {
  MODE_COLORS,
  TEXT,
} from '@/design/allternit.tokens';

import {
  useToolCallAccent,
} from '@/components/agents';

import { AgentSessionLayout, CanvasPanel } from './AgentSessionLayout';
import type { ChatModeAgentSessionProps, AgentSessionCanvas } from './types';
import type { ModeSessionMessage } from '@/lib/agents/mode-session-store';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { UnifiedMessageRenderer } from '@/components/ai-elements/UnifiedMessageRenderer';
import { parseStructuredContent } from '@/lib/ai/rust-stream-adapter-extended';
import { BotRoutinesPanel } from '@/views/chat/panels/BotRoutinesPanel';
import { BotRuntimeConfigModal } from '@/views/bots/BotRuntimeConfigModal';
import { AgentContextStrip } from '@/components/agents/context-strip/AgentContextStrip';
import type { AgentContextStripProps } from '@/components/agents/context-strip/context-strip.types';
import { useAgentStore } from '@/lib/agents/agent.store';
import { buildBotRuntimeEnv } from '@/lib/bots/bot-runtime-env';
import { getBotAccentColor } from '@/lib/bots/bot-profile';
import type { ResolvedEnvEntry } from '@/components/agents/context-strip/context-strip.types';
import type { Agent } from '@/lib/agents/agent.types';

// ============================================================================
// Runtime metadata helpers
// ============================================================================

function buildRuntimeEnvEntries(agent?: Agent, sessionMetadata?: Record<string, unknown>): ResolvedEnvEntry[] {
  const resolvedSecrets = (sessionMetadata?.resolvedSecrets ?? []) as Array<{ key?: string; value?: string }>;
  const resolvedConnectors = (sessionMetadata?.resolvedConnectors ?? []) as Array<{ key?: string; value?: string }>;

  const runtimeEnv = buildBotRuntimeEnv({
    harness: agent?.harness,
    resolvedSecrets: resolvedSecrets as import('@/lib/agents/agent-secrets-resolver').ResolvedSecret[],
    resolvedConnectors: resolvedConnectors as import('@/lib/agents/agent-connectors-resolver').ResolvedConnectorCredential[],
    vmOperator: sessionMetadata?.vmOperator as Agent['vmOperator'] | undefined,
    agentId: agent?.id,
    characterLayer: agent?.characterLayer,
  }).env;

  const entries: ResolvedEnvEntry[] = [];

  // Harness env vars first
  for (const [key, value] of Object.entries(runtimeEnv)) {
    let source: ResolvedEnvEntry['source'] = 'runtime';
    if (resolvedSecrets.some((s) => s.key === key)) source = 'secret';
    else if (resolvedConnectors.some((c) => c.key === key)) source = 'connector';
    else if (agent?.harness) source = 'harness';
    entries.push({ key, value, source });
  }

  return entries;
}

function missingRuntimeKeys(agent?: Agent, sessionMetadata?: Record<string, unknown>): string[] {
  const missingFromSession = (sessionMetadata?.missingSecrets ?? []) as string[];
  if (missingFromSession.length > 0) return missingFromSession;

  const secretRefs = (agent?.secretRefs ?? sessionMetadata?.secretRefs ?? []) as Array<{ key: string; required?: boolean; vaultRef?: string }>;
  return secretRefs
    .filter((s) => s.required && !s.vaultRef)
    .map((s) => s.key);
}

// ============================================================================
// Component
// ============================================================================

export function ChatModeAgentSession({
  sessionId: sessionIdProp,
  agentId,
  enableStreaming = true,
  showSuggestions = true,
  context,
  onClose,
}: ChatModeAgentSessionProps) {
  const mode = 'chat';
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.chat;
  const accentColor = useToolCallAccent(mode);

  // ── Store wiring ──────────────────────────────────────────────────────────
  const activeSessionId = useChatSessionStore((s) => s.activeSessionId);
  const sessionId = sessionIdProp ?? activeSessionId;

  const sessions = useChatSessionStore((s) => s.sessions);
  const session = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId]
  );
  const messages = session?.messages ?? [];

  // ── Bot session metadata ──────────────────────────────────────────────────
  const isBotSession = Boolean(session?.metadata?.isBot);
  const botSessionId = session?.metadata?.agentId as string | undefined;
  const botDisplayName = (session?.metadata?.botProfile as Record<string, unknown> | undefined)?.displayName as string | undefined;

  const [isRuntimeModalOpen, setIsRuntimeModalOpen] = useState(false);

  // ── Agent/bot runtime context for the context strip ─────────────────────────
  const agents = useAgentStore((s) => s.agents);
  const bot = useMemo(
    () => (isBotSession ? agents.find((a) => a.id === botSessionId) : undefined),
    [agents, botSessionId, isBotSession]
  );

  const runtimeEnvEntries = useMemo(
    () => (isBotSession ? buildRuntimeEnvEntries(bot, session?.metadata) : []),
    [bot, isBotSession, session?.metadata]
  );

  const stripMissingRuntimeKeys = useMemo(
    () => (isBotSession ? missingRuntimeKeys(bot, session?.metadata) : []),
    [bot, isBotSession, session?.metadata]
  );

  const streamingState = useChatSessionStore((s) =>
    sessionId ? s.streamingBySession?.[sessionId] : null
  );
  const isStreaming = streamingState?.isStreaming ?? false;

  const sendMessageStream = useChatSessionStore((s) => s.sendMessageStream);
  const createSession = useChatSessionStore((s) => s.createSession);
  const setActiveSession = useChatSessionStore((s) => s.setActiveSession);
  const fetchMessages = useChatSessionStore((s) => s.fetchMessages);

  // ── Local UI state ────────────────────────────────────────────────────────
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadedSessionRef = useRef<string | null>(null);

  const canvases = useMemo<AgentSessionCanvas[]>(() => {
    const result: AgentSessionCanvas[] = [];
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      const parts = (msg.metadata?.agentElementsParts ?? []) as Array<Record<string, unknown>>;
      for (const part of parts) {
        const partType = part.type as string;
        if (partType === 'code' || partType === 'markdown' || partType === 'diagram' || partType === 'browser' || partType === 'image') {
          result.push({
            id: (part.id as string) || `canvas-${msg.id}-${result.length}`,
            type: partType as AgentSessionCanvas['type'],
            title: (part.title as string) || 'Canvas',
            content: (part.content as string) || '',
            language: part.language as string | undefined,
          });
        }
      }
    }
    return result;
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  // Deep-link: when opened with an existing backend session id, load its
  // messages from the backend (messages are not persisted locally) instead of
  // showing the empty/suggestions state. Create-new behavior is unchanged —
  // non-backend ids (and no sessionId) skip this and still create on send.
  useEffect(() => {
    if (!sessionId || !sessionId.startsWith('ses')) return;
    if (loadedSessionRef.current === sessionId) return;
    loadedSessionRef.current = sessionId;
    void fetchMessages(sessionId);
  }, [sessionId, fetchMessages]);

  // ── Send handler ──────────────────────────────────────────────────────────
  const handleOpenBotHome = useCallback(() => {
    if (!botSessionId) return;
    window.dispatchEvent(
      new CustomEvent('allternit:open-view', {
        detail: { viewType: 'bot-home', context: { botId: botSessionId } },
      })
    );
  }, [botSessionId]);

  const handleBackToBotHome = handleOpenBotHome;

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput('');

    let sid = sessionId;
    if (!sid) {
      sid = await createSession({ name: 'Agent Chat', sessionMode: 'agent', agentId });
      setActiveSession(sid);
    }

    await sendMessageStream(sid, { text });
  }, [input, isStreaming, sessionId, createSession, agentId, setActiveSession, sendMessageStream]);

  // ── Suggested prompts ─────────────────────────────────────────────────────
  const suggestions = [
    'Help me understand this codebase',
    'Create a new React component',
    'Debug this error message',
    'Optimize this function',
  ];

  return (
    <AgentSessionLayout
      mode={mode}
      title={isBotSession ? `${botDisplayName ?? 'Bot'} Session` : 'Agent Chat Session'}
      agentName={isBotSession ? botDisplayName ?? 'Bot' : 'Allternit Assistant'}
      status={isStreaming ? 'streaming' : 'idle'}
      onClose={onClose}
      computerView={
        isBotSession && botSessionId ? (
          <BotRoutinesPanel botId={botSessionId} />
        ) : (
          <ChatCanvasPanel mode={mode} canvases={canvases} />
        )
      }
      headerActions={
        <>
          <button type="button"
            className="p-2 rounded-lg transition-colors"
            style={{ color: TEXT.tertiary }}
            title="Session Settings"
          >
            <GearSix size={16} />
          </button>
        </>
      }
    >
      {/* Chat Interface */}
      <div
        className="flex flex-col h-full relative"
        style={{ background: '#0D0B09' }}
      >
        {/* Mode wash */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            background: `radial-gradient(120% 88% at 50% 0%, ${modeColors.fog} 0%, transparent 58%)`,
          }}
        />

        {/* Bot home breadcrumb (bot sessions only) */}
        {isBotSession && botSessionId && (
          <div className="relative z-[2] px-4 pt-4">
            <button
              type="button"
              onClick={handleBackToBotHome}
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <CaretLeft size={14} />
              {botDisplayName ?? bot?.name ?? 'Bot'}
            </button>
          </div>
        )}

        {/* Agent context strip (bot sessions only) */}
        {isBotSession && session ? (
          <div className="relative z-[2] px-4 pt-3">
            <AgentContextStrip
              surface="chat"
              sessionName={session.name}
              sessionDescription={session.description || (session.metadata?.botProfile as Record<string, unknown> | undefined)?.welcomeMessage as string | undefined}
              agentName={botDisplayName ?? bot?.name}
              harnessMode={bot?.harness?.mode}
              statusLabel={isStreaming ? 'streaming' : 'idle'}
              messageCount={session.messageCount}
              workspaceScope={session.metadata?.workspaceId as string | undefined}
              canvasCount={canvases.length}
              tags={(session.metadata?.tags as string[] | undefined) ?? bot?.tags}
              toolsEnabled={Boolean(session.metadata?.agentFeatures?.tools ?? bot?.allowedTools?.length)}
              automationEnabled={Boolean(session.metadata?.agentFeatures?.automation)}
              runtimeEnvEntries={runtimeEnvEntries}
              connectorBindings={(session.metadata?.connectorBindings as AgentContextStripProps['connectorBindings']) ?? bot?.connectorBindings}
              secretRefs={(session.metadata?.secretRefs as AgentContextStripProps['secretRefs']) ?? bot?.secretRefs}
              missingRuntimeKeys={stripMissingRuntimeKeys}
              botId={botSessionId}
              vmOperator={(session.metadata?.vmOperator as Agent['vmOperator']) ?? bot?.vmOperator}
              vmSandbox={(session.metadata?.vmSandbox as AgentContextStripProps['vmSandbox']) ?? undefined}
              accentColor={bot ? getBotAccentColor(bot) ?? undefined : undefined}
              onDismiss={onClose}
              onEditRuntime={() => setIsRuntimeModalOpen(true)}
            />
          </div>
        ) : null}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-1">
          {messages.length === 0 && showSuggestions && (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div
                className="size-16  rounded-2xl flex items-center justify-center"
                style={{ background: modeColors.soft }}
              >
                <Sparkle size={32} style={{ color: modeColors.accent }} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2" style={{ color: TEXT.primary }}>
                  How can I help you today?
                </h3>
                <p className="text-sm" style={{ color: TEXT.secondary }}>
                  Start a conversation or try one of these suggestions
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                {suggestions.map((suggestion, idx) => (
                  <button type="button"
                    key={`chatmodeagentsession-${idx}`}
                    onClick={() => setInput(suggestion)}
                    className="p-3 rounded-xl text-left text-sm transition-all"
                    style={{
                      background: 'var(--surface-hover)',
                      border: `1px solid ${modeColors.border}`,
                      color: TEXT.secondary,
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              mode={mode}
              accentColor={accentColor}
            />
          ))}

          {isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 p-4"
            >
              <CircleNotch size={16} className="animate-spin" style={{ color: modeColors.accent }} />
              <span className="text-sm" style={{ color: TEXT.tertiary }}>
                Agent is thinking...
              </span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className="p-4 border-t"
          style={{ borderColor: modeColors.border, background: 'var(--surface-panel)' }}
        >
          <div className="flex items-end gap-2">
            <button type="button"
              className="p-3 rounded-xl transition-colors shrink-0"
              style={{ background: 'var(--surface-hover)', color: TEXT.tertiary }}
              title="Attach file"
            >
              <Paperclip size={20} />
            </button>

            <div className="flex-1 relative">
              <textarea aria-label="Text Area" value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Type your message…"
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
              title="Send message"
            >
              <PaperPlaneTilt size={20} />
            </button>
          </div>
        </div>
      </div>

      {bot && (
        <BotRuntimeConfigModal
          bot={bot}
          isOpen={isRuntimeModalOpen}
          onClose={() => setIsRuntimeModalOpen(false)}
          onSaved={() => {
            // agent store will refresh via updateAgent; no-op is fine
          }}
        />
      )}
    </AgentSessionLayout>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function ChatMessage({
  message,
  mode,
  accentColor,
}: {
  message: ModeSessionMessage;
  mode: 'chat';
  accentColor: string;
}) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.chat;
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div
        className="size-8  rounded-lg flex items-center justify-center shrink-0"
        style={{ background: isUser ? modeColors.soft : `${accentColor}20` }}
      >
        {isUser ? (
          <User size={16} style={{ color: modeColors.accent }} />
        ) : (
          <Robot size={16} style={{ color: accentColor }} />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div
          className="inline-block px-4 py-3 rounded-2xl text-left"
          style={{
            background: isUser ? modeColors.soft : 'var(--surface-hover)',
            border: `1px solid ${isUser ? modeColors.border : 'transparent'}`,
            color: TEXT.primary,
            borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
          }}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <UnifiedMessageRenderer
              parts={parseStructuredContent(message.content)}
              className="text-sm"
            />
          )}
        </div>

        {/* Timestamp */}
        <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: TEXT.tertiary }}>
          <span>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {!isUser && (
            <button type="button"
              className="hover:text-white transition-colors"
              onClick={() => void navigator.clipboard.writeText(message.content)}
            >
              <Copy size={12} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ChatCanvasPanel({ mode, canvases }: { mode: 'chat'; canvases: AgentSessionCanvas[] }) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.chat;

  if (canvases.length === 0) {
    return (
      <CanvasPanel title="Canvas" mode={mode}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div
            className="size-12  rounded-xl flex items-center justify-center mb-3"
            style={{ background: modeColors.soft }}
          >
            <Sparkle size={24} style={{ color: modeColors.accent }} />
          </div>
          <p className="text-sm" style={{ color: TEXT.secondary }}>
            Agent outputs will appear here
          </p>
          <p className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
            Code, images, and other artifacts
          </p>
        </div>
      </CanvasPanel>
    );
  }

  return (
    <CanvasPanel
      title="Canvas"
      mode={mode}
      actions={
        <button type="button" style={{ color: TEXT.tertiary }}>
          <DotsThreeOutline size={16} />
        </button>
      }
    >
      <div className="space-y-4">
        {canvases.map((canvas) => (
          <div
            key={canvas.id}
            className="p-3 rounded-xl"
            style={{
              background: 'var(--surface-hover)',
              border: `1px solid ${modeColors.border}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: TEXT.primary }}>
                {canvas.title}
              </span>
              {canvas.isPinned && (
                <Sparkle size={12} style={{ color: modeColors.accent }} />
              )}
            </div>
            <pre
              className="text-xs overflow-auto p-2 rounded"
              style={{
                background: 'var(--surface-panel)',
                color: TEXT.secondary,
                maxHeight: 200,
              }}
            >
              {canvas.content}
            </pre>
          </div>
        ))}
      </div>
    </CanvasPanel>
  );
}

export default ChatModeAgentSession;
