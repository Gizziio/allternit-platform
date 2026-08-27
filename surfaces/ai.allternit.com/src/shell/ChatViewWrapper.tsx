"use client";

import React, { useMemo, useRef } from 'react';
import { useOnboardingStore } from '../stores/onboarding-store';
import { useChatStore } from '../views/chat/ChatStore';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { ChatIdProvider } from '../providers/chat-id-provider';
import { DataStreamProvider } from '../providers/data-stream-provider';
import { MessageTreeProvider } from '../providers/message-tree-provider';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import { ModelSelectionProvider } from '../providers/model-selection-provider';
import { ChatInputProvider } from '../providers/chat-input-provider';
import { ChatModelsProvider } from '../providers/chat-models-provider';
import { ErrorBoundary } from '../components/error-boundary';
import { ChatErrorFallback } from './ShellFallbacks';
import { useDefaultModelSelection } from '../hooks/use-default-model-selection';
import type { AppMode } from './ShellHeader';
import type { CanonicalAgentModeId } from '@/lib/agents/agent-mode-contracts';
import type { Agent } from '@/lib/agents/agent.types';

const lazy = <T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  key?: string
) => React.lazy(
  key
    ? () => factory().then(m => ({ default: m[key] }))
    : factory as () => Promise<{ default: T }>
);

type ChatViewProps = {
  hideEmptyState?: boolean;
  hudMode?: boolean;
  onOpenAgentSession?: (text: string, surface: AppMode, execution?: { modeId: CanonicalAgentModeId; templateTitle?: string }) => void;
  onStartBotSession?: (agent: Agent) => void;
};
const ChatView = React.lazy(async () => {
  const module = await import('../views/ChatView');
  return { default: module.ChatView as React.ComponentType<ChatViewProps> };
});
const ProjectView = lazy(() => import('../views/ProjectView'), 'ProjectView');

export const ChatViewWrapper = React.memo(function ChatViewWrapper({
  onOpenAgentSession,
  onStartBotSession,
  hideEmptyState = false,
  hudMode = false,
}: {
  onOpenAgentSession?: (text: string, surface: AppMode, execution?: { modeId: CanonicalAgentModeId; templateTitle?: string }) => void;
  onStartBotSession?: (agent: Agent) => void;
  hideEmptyState?: boolean;
  hudMode?: boolean;
}): React.ReactNode {
  const { activeProjectId, activeThreadId } = useChatStore();
  const embeddedChatSessionId = useChatSessionStore(
    (state) => state.activeSessionId,
  );

  const onboardingProvider = useOnboardingStore((s) => s.preferences.defaultProvider);
  const backendDefaultSelection = useDefaultModelSelection();

  const defaultModelSelection = useMemo(() => {
    if (onboardingProvider) {
      const raw = onboardingProvider.replace('/', '::');
      const sep = raw.indexOf('::');
      if (sep > 0) {
        const providerId = raw.slice(0, sep);
        const modelId = raw.slice(sep + 2);
        return { providerId, profileId: providerId, modelId, modelName: modelId };
      }
      return { providerId: raw, profileId: raw, modelId: '', modelName: '' };
    }
    return backendDefaultSelection;
  }, [onboardingProvider, backendDefaultSelection]);

  // Lazily-generated once and cached in a ref (not useMemo) so this fallback
  // ID survives re-renders where activeThreadId/embeddedChatSessionId flip
  // between null and undefined (different by reference, same "no session
  // yet" meaning) — that flip was invalidating the useMemo cache and
  // generating a fresh temp-<timestamp> id on almost every render, which
  // remounted the entire ChatView (it's keyed on this id) and wiped all of
  // its local state, including in-flight error banners.
  const fallbackChatIdRef = useRef<string | null>(null);
  if (fallbackChatIdRef.current === null) {
    fallbackChatIdRef.current = `temp-${Date.now()}`;
  }
  const effectiveChatId = embeddedChatSessionId || activeThreadId || fallbackChatIdRef.current;
  
  if (activeProjectId && !embeddedChatSessionId) {
    return <ProjectView />;
  }

  return (
    <ErrorBoundary fallback={<ChatErrorFallback />}>
      <ChatIdProvider
        chatId={effectiveChatId}
        isPersisted={!!embeddedChatSessionId || !!activeThreadId}
        source="local"
      >
        <DataStreamProvider>
          <MessageTreeProvider>
            <PromptInputProvider>
              <ChatInputProvider>
                <ChatModelsProvider>
                  <ModelSelectionProvider defaultSelection={defaultModelSelection}>
                    <ChatView key={effectiveChatId} hideEmptyState={hideEmptyState} hudMode={hudMode} onOpenAgentSession={onOpenAgentSession} onStartBotSession={onStartBotSession} />
                  </ModelSelectionProvider>
                </ChatModelsProvider>
              </ChatInputProvider>
            </PromptInputProvider>
          </MessageTreeProvider>
        </DataStreamProvider>
      </ChatIdProvider>
    </ErrorBoundary>
  );
});
