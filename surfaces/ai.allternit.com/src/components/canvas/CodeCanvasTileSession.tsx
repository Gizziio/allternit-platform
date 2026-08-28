"use client";

import React, { useCallback, useState } from 'react';
import { useCodeSessionStore } from '@/views/code/CodeSessionStore';
import { CompactChatComposer } from './CompactChatComposer';
import { StreamingChatComposer } from '@/components/chat/StreamingChatComposer';
import { mapNativeMessagesToStreamMessages } from '@/lib/agents/embedded-agent-chat';
import { useH5iContext } from '@/components/h5i/useH5iContext';
import { H5iContextPanel } from '@/components/h5i/H5iContextPanel';
import { ChatIdProvider } from '@/providers/chat-id-provider';
import { DataStreamProvider } from '@/providers/data-stream-provider';
import { MessageTreeProvider } from '@/providers/message-tree-provider';
import { useDefaultModelSelection } from '@/hooks/use-default-model-selection';
import { Brain, WarningCircle } from '@phosphor-icons/react';

interface CodeCanvasTileSessionProps {
  sessionId?: string;
  workspaceId: string;
  workspacePath?: string;
  onSessionCreated?: (sessionId: string) => void;
}

const DEFAULT_CODE_MODEL = 'claude-cli/claude-sonnet-4-6';

export function CodeCanvasTileSession(props: CodeCanvasTileSessionProps) {
  const defaultSelection = useDefaultModelSelection();
  const modelId = defaultSelection?.providerId
    ? defaultSelection.modelId
      ? defaultSelection.modelId.includes("/")
        ? defaultSelection.modelId
        : `${defaultSelection.providerId}/${defaultSelection.modelId}`
      : defaultSelection.providerId
    : DEFAULT_CODE_MODEL;
  const providerKey = props.sessionId || `canvas-session-${props.workspaceId}`;

  return (
    <ChatIdProvider chatId={providerKey} isPersisted={false} source="local">
      <DataStreamProvider>
        <MessageTreeProvider>
          <CodeCanvasTileSessionContent {...props} modelId={modelId} />
        </MessageTreeProvider>
      </DataStreamProvider>
    </ChatIdProvider>
  );
}

function CodeCanvasTileSessionContent({
  sessionId,
  workspaceId,
  workspacePath,
  onSessionCreated,
  modelId,
}: CodeCanvasTileSessionProps & { modelId: string }) {
  const session = useCodeSessionStore((s) => s.sessions.find((ses) => ses.id === sessionId));
  const isStreaming = useCodeSessionStore(
    (s) => (sessionId ? s.streamingBySession[sessionId]?.isStreaming ?? false : false),
  );
  const sendMessageStream = useCodeSessionStore((s) => s.sendMessageStream);
  const abortGeneration = useCodeSessionStore((s) => s.abortGeneration);
  const createSession = useCodeSessionStore((s) => s.createSession);
  const setActiveSession = useCodeSessionStore((s) => s.setActiveSession);
  const [showContext, setShowContext] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // h5i Tier 2: Auto-start context for this session
  useH5iContext(workspacePath, session?.id, session?.name || 'Canvas Session');

  const messages = session?.messages ?? [];
  const streamMessages = mapNativeMessagesToStreamMessages(messages);

  const handleSend = useCallback(
    async (text: string) => {
      setSessionError(null);
      let targetSessionId = session?.id;

      try {
        if (!targetSessionId) {
          setIsCreatingSession(true);
          targetSessionId = await createSession({
            name: text.slice(0, 64) || 'Canvas Session',
            workspaceId,
            isolation: 'none',
          });
          onSessionCreated?.(targetSessionId);
        }

        setActiveSession(targetSessionId);
        await sendMessageStream(targetSessionId, { text, modelId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to send message';
        setSessionError(message);
        throw error;
      } finally {
        setIsCreatingSession(false);
      }
    },
    [
      createSession,
      modelId,
      onSessionCreated,
      sendMessageStream,
      session?.id,
      setActiveSession,
      workspaceId,
    ],
  );

  const handleStop = useCallback(() => {
    if (session?.id) abortGeneration(session.id);
  }, [session?.id, abortGeneration]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* h5i Context button (subtle, top-right of tile content area) */}
      {workspacePath && session?.id && (
        <button type="button"
          onClick={() => setShowContext(true)}
          title="View h5i context trace"
          style={{
            position: 'absolute',
            top: 40,
            right: 8,
            zIndex: 10,
            width: 26,
            height: 26,
            borderRadius: 6,
            border: '1px solid rgba(139,92,246,0.2)',
            background: 'rgba(139,92,246,0.08)',
            color: '#8b5cf6',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
          }}
        >
          <Brain size={13} />
        </button>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          padding: '10px 12px',
        }}
      >
        {streamMessages.length === 0 && (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            {session ? 'Start a conversation…' : 'Send a message to start a live Code session…'}
          </div>
        )}
        {streamMessages.map((message, index) => (
          <StreamingChatComposer
            key={message.id}
            message={message}
            isLoading={isStreaming && index === streamMessages.length - 1}
            isLast={index === streamMessages.length - 1}
          />
        ))}
      </div>

      {sessionError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 7,
            padding: '7px 10px',
            borderTop: '1px solid color-mix(in srgb, var(--status-error) 24%, transparent)',
            background: 'var(--status-error-bg)',
            color: 'var(--status-error)',
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          <WarningCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{sessionError}</span>
        </div>
      )}

      {/* Composer */}
      <CompactChatComposer
        onSend={handleSend}
        isLoading={isStreaming || isCreatingSession}
        onStop={handleStop}
        placeholder="Ask anything…"
      />

      {/* Context Panel */}
      {showContext && workspacePath && session?.id && (
        <H5iContextPanel
          workspacePath={workspacePath}
          sessionId={session.id}
          onClose={() => setShowContext(false)}
        />
      )}
    </div>
  );
}
