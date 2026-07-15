"use client";

import React, { useMemo } from 'react';
import { useOnboardingStore } from '../stores/onboarding-store';
import { useChatStore } from '../views/chat/ChatStore';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { ChatIdProvider } from '../providers/chat-id-provider';
import { DataStreamProvider } from '../providers/data-stream-provider';
import { MessageTreeProvider } from '../providers/message-tree-provider';
import { ChatInputProvider } from '../providers/chat-input-provider';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import { ChatModelsProvider } from '../providers/chat-models-provider';
import { ModelSelectionProvider } from '../providers/model-selection-provider';
import { ErrorBoundary } from '../components/error-boundary';
import { ChatErrorFallback } from './ShellFallbacks';
import { useDefaultModelSelection } from '../hooks/use-default-model-selection';
import type { AppMode } from './ShellHeader';
import type { CanonicalAgentModeId } from '@/lib/agents/agent-mode-contracts';

const lazy = <T extends React.ComponentType<any>>(
  factory: () => Promise<any>,
  key?: string
) => React.lazy(
  key
    ? () => factory().then(m => ({ default: m[key] }))
    : factory as () => Promise<{ default: T }>
);

const ChatView = lazy(() => import('../views/ChatView'), 'ChatView');
const ProjectView = lazy(() => import('../views/ProjectView'), 'ProjectView');

export const ChatViewWrapper = React.memo(function ChatViewWrapper({
  onOpenAgentSession
}: {
  onOpenAgentSession?: (text: string, surface: AppMode, execution?: { modeId: CanonicalAgentModeId; templateTitle?: string }) => void;
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

  const effectiveChatId = useMemo(() => 
    embeddedChatSessionId || activeThreadId || `temp-${Date.now()}`, 
    [activeThreadId, embeddedChatSessionId]
  );
  
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
                    <ChatView key={effectiveChatId} onOpenAgentSession={onOpenAgentSession} />
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
