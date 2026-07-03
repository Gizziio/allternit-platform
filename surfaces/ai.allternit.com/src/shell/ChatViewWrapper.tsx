"use client";

import React, { useEffect, useMemo, useState } from 'react';
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
import { setupApi } from '@/services/setup-api';
import type { AppMode } from './ShellHeader';

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
  onOpenAgentSession?: (text: string, surface: AppMode) => void;
}): React.ReactNode {
  const { activeProjectId, activeThreadId } = useChatStore();
  const embeddedChatSessionId = useChatSessionStore(
    (state) => state.activeSessionId,
  );

  const onboardingProvider = useOnboardingStore((s) => s.preferences.defaultProvider);
  const [backendDefaultModel, setBackendDefaultModel] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Load the configured brain from the backend so the UI reflects the user's
  // chosen provider even when localStorage/onboarding state is empty.
  useEffect(() => {
    let cancelled = false;
    setupApi
      .getConfig()
      .then((config) => {
        if (cancelled) return;
        const model = config.user.defaultModel;
        // eslint-disable-next-line no-console
        console.log('[ChatViewWrapper] backend config defaultModel:', model);
        if (model) setBackendDefaultModel(model);
      })
      .catch((err: any) => {
        const msg = err?.message || String(err);
        // eslint-disable-next-line no-console
        console.error('[ChatViewWrapper] failed to load backend config:', msg);
        if (!cancelled) setConfigError(msg);
      });
    return () => { cancelled = true; };
  }, []);

  const effectiveDefaultProvider = onboardingProvider
    ? onboardingProvider.replace('/', '::')
    : backendDefaultModel;

  const defaultModelSelection = useMemo(() => {
    if (!effectiveDefaultProvider) return null;
    const sep = effectiveDefaultProvider.indexOf('::');
    if (sep > 0) {
      const providerId = effectiveDefaultProvider.slice(0, sep);
      const modelId = effectiveDefaultProvider.slice(sep + 2);
      return { providerId, profileId: providerId, modelId, modelName: modelId };
    }
    return { providerId: effectiveDefaultProvider, profileId: effectiveDefaultProvider, modelId: '', modelName: '' };
  }, [effectiveDefaultProvider]);

  const effectiveChatId = useMemo(() => 
    embeddedChatSessionId || activeThreadId || `temp-${Date.now()}`, 
    [activeThreadId, embeddedChatSessionId]
  );
  
  if (activeProjectId && !embeddedChatSessionId) {
    return <ProjectView />;
  }

  return (
    <ErrorBoundary fallback={<ChatErrorFallback />}>
      <div className="fixed top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs p-2 z-50 rounded max-w-[80vw]">
        backend: {backendDefaultModel ?? 'null'} | eff: {effectiveDefaultProvider ?? 'null'} | sel: {defaultModelSelection ? `${defaultModelSelection.providerId}/${defaultModelSelection.modelId}` : 'null'} | err: {configError ?? 'none'}
      </div>
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
                    <ChatView key={effectiveChatId} />
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
