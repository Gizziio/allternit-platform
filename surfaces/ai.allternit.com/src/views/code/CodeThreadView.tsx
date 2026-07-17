"use client";

import React, { useCallback, useRef, useState } from 'react';
import { SquaresFour } from '@phosphor-icons/react';
import { CodeCanvas } from './CodeCanvas';
import { CodeSessionSidePane } from './CodeSessionSidePane';
import { CodeSessionLauncher, type CodePaneTarget } from './CodeSessionLauncher';
import { useSurfaceAgentModeEnabled } from '@/lib/agents/surface-agent-context';
import { openCodeSessionWindow } from '@/lib/open-code-session-window';
import { AgentModeBackdrop } from '../chat/agentModeSurfaceTheme';
import { ChatIdProvider } from '@/providers/chat-id-provider';
import { DataStreamProvider } from '@/providers/data-stream-provider';
import { MessageTreeProvider } from '@/providers/message-tree-provider';
import { ChatInputProvider } from '@/providers/chat-input-provider';
import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import { ChatModelsProvider } from '@/providers/chat-models-provider';
import { ModelSelectionProvider } from '@/providers/model-selection-provider';
import { useDefaultModelSelection } from '@/hooks/use-default-model-selection';
import { useCodeModeStore } from './CodeModeStore';
import { useCodeSessionStore } from './CodeSessionStore';
import type { CodeWorkspaceRecord } from './CodeModeStore';

const PREVIEW_DEFAULT_WIDTH = 440;
const PREVIEW_MIN_WIDTH = 260;
const PREVIEW_MAX_WIDTH = 700;

interface CodeThreadViewProps {
  workspace: CodeWorkspaceRecord | undefined;
}

export function CodeThreadView({ workspace }: CodeThreadViewProps) {
  const defaultSelection = useDefaultModelSelection();
  // Side pane (Files/Preview/Terminal/Git) is open by default during a
  // session — code mode should look like a coding session, not a bare chat.
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(true);
  const [previewWidth, setPreviewWidth] = useState(PREVIEW_DEFAULT_WIDTH);
  const [activeSideTab, setActiveSideTab] = useState<CodePaneTarget>('terminal');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const codeAgentModeEnabled = useSurfaceAgentModeEnabled('code');
  // Chat sessions created from the composer live in CodeSessionStore (the mode
  // session store), not CodeModeStore — derive "has an active session" from the
  // store the send flow actually populates, otherwise the usage dashboard
  // overlay never dismisses and the preview toggle never appears.
  const activeCodeSessionId = useCodeSessionStore((s) => s.activeSessionId);
  const activeCodeSession = useCodeSessionStore((s) => s.sessions.find((session) => session.id === s.activeSessionId));
  const hasSession = Boolean(activeCodeSessionId);
  const setWorkspaceLayoutMode = useCodeModeStore((s) => s.setWorkspaceLayoutMode);
  const workspaceId = workspace?.workspace_id;

  const openSideTab = useCallback((tab: CodePaneTarget) => {
    setActiveSideTab(tab);
    setIsPreviewCollapsed(false);
  }, []);

  const renameSession = useCallback(() => {
    if (!activeCodeSessionId || !activeCodeSession) return;
    const name = window.prompt('Rename session', activeCodeSession.name);
    if (name?.trim()) void useCodeSessionStore.getState().updateSession(activeCodeSessionId, { name: name.trim() });
  }, [activeCodeSession, activeCodeSessionId]);

  const forkSession = useCallback(() => {
    if (!activeCodeSession) return;
    void useCodeSessionStore.getState().createSession({
      name: `${activeCodeSession.name} (fork)`,
      workspaceId: activeCodeSession.metadata.workspaceId,
      sessionMode: activeCodeSession.metadata.sessionMode,
      metadata: { ...activeCodeSession.metadata, forkedFrom: activeCodeSession.id },
    });
  }, [activeCodeSession]);

  const openIn = useCallback((target: 'window' | 'vscode' | 'terminal') => {
    if (target === 'window') {
      if (!activeCodeSessionId) return;
      openCodeSessionWindow({
        sessionId: activeCodeSessionId,
        workspaceId: workspace?.workspace_id,
        title: activeCodeSession?.name,
      });
      return;
    }
    const path = workspace?.root_path;
    if (!path) return;
    if (target === 'vscode') window.location.href = `vscode://file/${encodeURI(path)}`;
    else openSideTab('terminal');
  }, [activeCodeSession?.name, activeCodeSessionId, openSideTab, workspace?.root_path, workspace?.workspace_id]);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startW: previewWidth };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startX - ev.clientX;
        const next = Math.min(
          PREVIEW_MAX_WIDTH,
          Math.max(PREVIEW_MIN_WIDTH, dragRef.current.startW + delta),
        );
        setPreviewWidth(next);
      };

      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [previewWidth],
  );

  return (
    <div
      ref={rootRef}
      data-testid="code-thread-view"
      style={{
        height: '100%',
        minHeight: '100%',
        position: 'relative',
        isolation: 'isolate',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--view-code-bg, var(--surface-canvas))',
      }}
    >
      <AgentModeBackdrop
        active={codeAgentModeEnabled}
        surface="code"
        dataTestId="agent-mode-code-backdrop"
      />

      {hasSession && isPreviewCollapsed ? (
        <CodeSessionLauncher
          onOpenPane={openSideTab}
          onRename={renameSession}
          onFork={forkSession}
          onArchive={() => activeCodeSessionId && void useCodeSessionStore.getState().updateSession(activeCodeSessionId, { isActive: false, metadata: { ...activeCodeSession?.metadata, originSurface: 'code', archived: true } })}
          onDelete={() => activeCodeSessionId && window.confirm('Delete this session?') && void useCodeSessionStore.getState().deleteSession(activeCodeSessionId)}
          onOpenIn={openIn}
        />
      ) : null}

      {workspaceId && (
        <button
          type="button"
          data-testid="code-canvas-mode-toggle"
          onClick={() => setWorkspaceLayoutMode(workspaceId, 'canvas')}
          title="Switch to canvas mode"
          aria-label="Switch to canvas mode"
          style={{
            position: 'absolute',
            top: 8,
            right: hasSession && isPreviewCollapsed ? 160 : 18,
            zIndex: 8,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            padding: 0,
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            background: 'var(--glass-bg-thick)',
            boxShadow: 'var(--shadow-sm)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 120ms ease, color 120ms ease, transform 120ms ease',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--surface-hover)';
            event.currentTarget.style.color = 'var(--text-primary)';
            event.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'var(--glass-bg-thick)';
            event.currentTarget.style.color = 'var(--text-secondary)';
            event.currentTarget.style.transform = 'none';
          }}
        >
          <SquaresFour size={17} weight="bold" />
        </button>
      )}

      {/* Main layout: canvas fills all space */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Canvas — always full width */}
        <div
          data-testid="code-pane-canvas"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ChatIdProvider
            chatId={workspace?.workspace_id || 'code'}
            isPersisted={false}
            source="local"
          >
            <DataStreamProvider>
              <MessageTreeProvider>
                <ChatInputProvider>
                  <PromptInputProvider>
                    <ChatModelsProvider>
                      <ModelSelectionProvider defaultSelection={defaultSelection}>
                        <CodeCanvas />
                      </ModelSelectionProvider>
                    </ChatModelsProvider>
                  </PromptInputProvider>
                </ChatInputProvider>
              </MessageTreeProvider>
            </DataStreamProvider>
          </ChatIdProvider>
        </div>

        {/* Resize handle + session side pane (Files/Preview/Terminal/Git) — session only */}
        {hasSession && !isPreviewCollapsed && (
          <>
            <div
              onMouseDown={onResizeStart}
              style={{
                width: 6,
                flexShrink: 0,
                cursor: 'col-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                const indicator = e.currentTarget.firstElementChild as HTMLElement | null;
                if (indicator) indicator.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                const indicator = e.currentTarget.firstElementChild as HTMLElement | null;
                if (indicator) indicator.style.opacity = '0.5';
              }}
            >
              <div
                style={{
                  height: 40,
                  width: 2,
                  background: 'var(--border-strong)',
                  borderRadius: 1,
                  opacity: 0.5,
                  transition: 'opacity 0.15s',
                }}
              />
            </div>

            <div
              data-testid="code-pane-preview"
              style={{
                width: previewWidth,
                flexShrink: 0,
                alignSelf: 'stretch',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'var(--surface-canvas)',
                }}
              >
                <CodeSessionSidePane
                  activeTab={activeSideTab}
                  onTabChange={setActiveSideTab}
                  sessionId={activeCodeSessionId ?? undefined}
                  workingDir={workspace?.root_path}
                  terminalContext={{
                    repoName: workspace?.display_name,
                    branch: workspace?.repo_status?.branch,
                    shortSha: workspace?.repo_status?.last_commit?.slice(0, 7),
                  }}
                  onClose={() => setIsPreviewCollapsed(true)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
