"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { CodeCanvas } from './CodeCanvas';
import { CodePreviewPane } from './CodePreviewPane';
import { useSurfaceAgentModeEnabled } from '@/lib/agents/surface-agent-context';
import { AgentModeBackdrop } from '../chat/agentModeSurfaceTheme';
import { ChatIdProvider } from '@/providers/chat-id-provider';
import { DataStreamProvider } from '@/providers/data-stream-provider';
import { MessageTreeProvider } from '@/providers/message-tree-provider';
import type { CodeWorkspaceRecord } from './CodeModeStore';

const BASE_ROOT_INSET = 12;
const PREVIEW_DEFAULT_WIDTH = 380;
const PREVIEW_MIN_WIDTH = 260;
const PREVIEW_MAX_WIDTH = 700;

interface CodeThreadViewProps {
  workspace: CodeWorkspaceRecord | undefined;
}

export function CodeThreadView({ workspace }: CodeThreadViewProps) {
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(PREVIEW_DEFAULT_WIDTH);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const codeAgentModeEnabled = useSurfaceAgentModeEnabled('code');

  const togglePreview = useCallback(() => {
    setIsPreviewCollapsed((prev) => !prev);
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
        background: embeddedAgentSession?.isEmbedded
          ? 'radial-gradient(circle at top right, rgba(121,196,124,0.08), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 18%)'
          : 'transparent',
      }}
    >
      <AgentModeBackdrop
        active={codeAgentModeEnabled}
        surface="code"
        dataTestId="agent-mode-code-backdrop"
      />

      {/* Preview toggle button */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          right: 18,
          zIndex: 4,
          pointerEvents: 'none',
        }}
      >
        <button
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
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
        >
          {isPreviewCollapsed ? <CaretLeft size={12} /> : <CaretRight size={12} />}
          {isPreviewCollapsed ? 'Show Preview' : 'Hide Preview'}
        </button>
      </div>

      {/* Main layout: canvas fills space, preview pane on right */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 0, overflow: 'hidden' }}>
        {/* Canvas */}
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
                <CodeCanvas isPreviewCollapsed={isPreviewCollapsed} />
              </MessageTreeProvider>
            </DataStreamProvider>
          </ChatIdProvider>
        </div>

        {/* Resize handle + Preview pane */}
        {!isPreviewCollapsed && (
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
                height: '100%',
                boxSizing: 'border-box',
                paddingLeft: 6,
              }}
            >
              <div
                style={{
                  height: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 18,
                  background: 'rgba(16, 19, 22, 0.08)',
                  boxShadow: '0 14px 34px rgba(0, 0, 0, 0.12)',
                }}
              >
                <CodePreviewPane />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
