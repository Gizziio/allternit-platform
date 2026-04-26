"use client";

import React, { useCallback, useState } from 'react';
import { useCodeSessionStore } from '@/views/code/CodeSessionStore';
import { CompactChatComposer } from './CompactChatComposer';
import { StreamingChatComposer } from '@/components/chat/StreamingChatComposer';
import { mapNativeMessagesToStreamMessages } from '@/lib/agents/embedded-agent-chat';
import { useH5iContext } from '@/components/h5i/useH5iContext';
import { H5iContextPanel } from '@/components/h5i/H5iContextPanel';
import { Brain } from '@phosphor-icons/react';

interface CodeCanvasTileSessionProps {
  sessionId: string;
  workspacePath?: string;
}

export function CodeCanvasTileSession({ sessionId, workspacePath }: CodeCanvasTileSessionProps) {
  const session = useCodeSessionStore((s) => s.sessions.find((ses) => ses.id === sessionId));
  const isStreaming = useCodeSessionStore(
    (s) => s.streamingBySession[sessionId]?.isStreaming ?? false,
  );
  const sendMessageStream = useCodeSessionStore((s) => s.sendMessageStream);
  const abortGeneration = useCodeSessionStore((s) => s.abortGeneration);
  const [showContext, setShowContext] = useState(false);

  // h5i Tier 2: Auto-start context for this session
  useH5iContext(workspacePath, sessionId, session?.name || 'Canvas Session');

  const messages = session?.messages ?? [];
  const streamMessages = mapNativeMessagesToStreamMessages(messages);

  const handleSend = useCallback(
    async (text: string) => {
      if (!sessionId) return;
      await sendMessageStream(sessionId, { text });
    },
    [sessionId, sendMessageStream],
  );

  const handleStop = useCallback(() => {
    abortGeneration(sessionId);
  }, [sessionId, abortGeneration]);

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
      {workspacePath && (
        <button
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
            fontSize: 11,
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
            Start a conversation...
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

      {/* Composer */}
      <CompactChatComposer
        onSend={handleSend}
        isLoading={isStreaming}
        onStop={handleStop}
        placeholder="Ask anything..."
      />

      {/* Context Panel */}
      {showContext && workspacePath && (
        <H5iContextPanel
          workspacePath={workspacePath}
          sessionId={sessionId}
          onClose={() => setShowContext(false)}
        />
      )}
    </div>
  );
}
