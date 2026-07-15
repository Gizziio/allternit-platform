"use client";

import React, { useCallback, useRef, useState } from 'react';
import { CaretLeft, CaretRight, TerminalWindow, FolderOpen, Globe, DotsThree, FileCode } from '@phosphor-icons/react';
import { CodeCanvas } from './CodeCanvas';
import { CodeSessionSidePane } from './CodeSessionSidePane';
import { useSurfaceAgentModeEnabled } from '@/lib/agents/surface-agent-context';
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

const BASE_ROOT_INSET = 12;
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
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(PREVIEW_DEFAULT_WIDTH);
  const [activeSideTab, setActiveSideTab] = useState<'files' | 'preview' | 'terminal' | 'git' | 'diff'>('files');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const codeAgentModeEnabled = useSurfaceAgentModeEnabled('code');
  // Chat sessions created from the composer live in CodeSessionStore (the mode
  // session store), not CodeModeStore — derive "has an active session" from the
  // store the send flow actually populates, otherwise the usage dashboard
  // overlay never dismisses and the preview toggle never appears.
  const activeCodeSessionId = useCodeSessionStore((s) => s.activeSessionId);
  const hasSession = Boolean(activeCodeSessionId);

  const togglePreview = useCallback(() => {
    setIsPreviewCollapsed((prev) => !prev);
  }, []);

  const openSideTab = useCallback((tab: 'files' | 'preview' | 'terminal' | 'git' | 'diff') => {
    setActiveSideTab(tab);
    setIsPreviewCollapsed(false);
  }, []);

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

      {/* Integrated toolbar — only shown during an active session */}
      {hasSession && (
        <div
          style={{
            position: 'absolute',
            top: 3,
            right: 18,
            zIndex: 4,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <button
            type="button"
            data-testid="code-toolbar-terminal"
            onClick={() => openSideTab('terminal')}
            title="Terminal"
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: activeSideTab === 'terminal' && !isPreviewCollapsed
                ? 'rgba(255, 255, 255, 0.10)'
                : 'rgba(11, 14, 16, 0.54)',
              color: activeSideTab === 'terminal' && !isPreviewCollapsed
                ? 'var(--text-primary)'
                : 'var(--text-secondary)',
              cursor: 'pointer',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            <TerminalWindow size={16} />
          </button>
          <button
            type="button"
            data-testid="code-toolbar-files"
            onClick={() => openSideTab('files')}
            title="Files & diff"
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: activeSideTab === 'files' && !isPreviewCollapsed
                ? 'rgba(255, 255, 255, 0.10)'
                : 'rgba(11, 14, 16, 0.54)',
              color: activeSideTab === 'files' && !isPreviewCollapsed
                ? 'var(--text-primary)'
                : 'var(--text-secondary)',
              cursor: 'pointer',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            <FolderOpen size={16} />
          </button>
          <button
            type="button"
            data-testid="code-toolbar-diff"
            onClick={() => openSideTab('diff')}
            title="Diff review"
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: activeSideTab === 'diff' && !isPreviewCollapsed
                ? 'rgba(255, 255, 255, 0.10)'
                : 'rgba(11, 14, 16, 0.54)',
              color: activeSideTab === 'diff' && !isPreviewCollapsed
                ? 'var(--text-primary)'
                : 'var(--text-secondary)',
              cursor: 'pointer',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            <FileCode size={16} />
          </button>
          <button
            type="button"
            data-testid="code-toolbar-browser"
            onClick={() => openSideTab('preview')}
            title="Browser preview"
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: activeSideTab === 'preview' && !isPreviewCollapsed
                ? 'rgba(255, 255, 255, 0.10)'
                : 'rgba(11, 14, 16, 0.54)',
              color: activeSideTab === 'preview' && !isPreviewCollapsed
                ? 'var(--text-primary)'
                : 'var(--text-secondary)',
              cursor: 'pointer',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            <Globe size={16} />
          </button>
          <button
            type="button"
            data-testid="code-toolbar-overflow"
            title="More"
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(11, 14, 16, 0.54)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            <DotsThree size={18} />
          </button>
          <button
            type="button"
            data-testid="code-preview-toggle"
            onClick={togglePreview}
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 34,
              padding: '0 10px',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(11, 14, 16, 0.54)',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          >
            {isPreviewCollapsed ? <CaretLeft size={12} /> : <CaretRight size={12} />}
            {isPreviewCollapsed ? 'Show Panel' : 'Hide Panel'}
          </button>
        </div>
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
                        <CodeCanvas isPreviewCollapsed={isPreviewCollapsed} onOpenSideTab={openSideTab} />
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
                paddingLeft: 6,
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
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 18,
                  background: 'rgba(16, 19, 22, 0.08)',
                  boxShadow: '0 14px 34px rgba(0, 0, 0, 0.12)',
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
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
