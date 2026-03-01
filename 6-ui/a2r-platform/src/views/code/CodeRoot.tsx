import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { CodeCanvas } from './CodeCanvas';
import { CodePreviewPane } from './CodePreviewPane';
import { useEmbeddedAgentSession } from '@/lib/agents';
import { AgentModeBackdrop } from '../chat/agentModeSurfaceTheme';
import { useAgentSurfaceModeStore } from '@/stores/agent-surface-mode.store';

const BASE_ROOT_INSET = 12;
const BROWSER_PILL_FALLBACK_TOP = 14;
const TOGGLE_VERTICAL_NUDGE = 6;

const PREVIEW_DEFAULT_WIDTH = 380;
const PREVIEW_MIN_WIDTH = 260;
const PREVIEW_MAX_WIDTH = 700;

function measureWidgetInset(rootElement: HTMLDivElement | null): number {
  if (!rootElement || typeof document === 'undefined') {
    return BASE_ROOT_INSET;
  }

  const controls = document.querySelector('[data-testid="shell-rail-controls"]');
  if (!(controls instanceof HTMLElement)) {
    return BASE_ROOT_INSET;
  }

  const rootRect = rootElement.getBoundingClientRect();
  const controlsRect = controls.getBoundingClientRect();
  const horizontalOverlap =
    Math.min(rootRect.right, controlsRect.right) - Math.max(rootRect.left, controlsRect.left);
  const verticalOverlap =
    Math.min(rootRect.bottom, controlsRect.bottom) - Math.max(rootRect.top, controlsRect.top);

  if (horizontalOverlap <= 0 || verticalOverlap <= 0) {
    return BASE_ROOT_INSET;
  }

  return Math.max(BASE_ROOT_INSET, Math.ceil(controlsRect.bottom - rootRect.top + 10));
}

function measureBrowserPillTop(rootElement: HTMLDivElement | null): number {
  if (!rootElement || typeof document === 'undefined') {
    return BROWSER_PILL_FALLBACK_TOP;
  }

  const browserButton = Array.from(
    document.querySelectorAll('[data-testid="shell-rail-controls"] button'),
  ).find((element) => element.textContent?.trim().includes('Browser'));

  if (!(browserButton instanceof HTMLElement)) {
    return BROWSER_PILL_FALLBACK_TOP;
  }

  const rootRect = rootElement.getBoundingClientRect();
  const browserRect = browserButton.getBoundingClientRect();
  return Math.max(
    BASE_ROOT_INSET,
    Math.ceil(browserRect.top - rootRect.top + TOGGLE_VERTICAL_NUDGE),
  );
}

export function CodeRoot() {
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(PREVIEW_DEFAULT_WIDTH);
  const [topInset, setTopInset] = useState(BASE_ROOT_INSET);
  const [toggleTop, setToggleTop] = useState(BROWSER_PILL_FALLBACK_TOP);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const canvasTopInset = topInset;
  const embeddedAgentSession = useEmbeddedAgentSession('code');
  const codeAgentModeEnabled = useAgentSurfaceModeStore(
    (state) => state.enabledBySurface.code,
  );

  useEffect(() => {
    const updateInset = () => {
      setTopInset((currentInset) => {
        const nextInset = measureWidgetInset(rootRef.current);
        return currentInset === nextInset ? currentInset : nextInset;
      });
      setToggleTop((currentTop) => {
        const nextTop = measureBrowserPillTop(rootRef.current);
        return currentTop === nextTop ? currentTop : nextTop;
      });
    };

    updateInset();
    window.addEventListener('resize', updateInset);

    const controls = document.querySelector('[data-testid="shell-rail-controls"]');
    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateInset);
      if (rootRef.current) {
        resizeObserver.observe(rootRef.current);
      }
      if (controls instanceof Element) {
        resizeObserver.observe(controls);
      }
    }

    return () => {
      window.removeEventListener('resize', updateInset);
      resizeObserver?.disconnect();
    };
  }, []);

  const togglePreview = useCallback(() => {
    setIsPreviewCollapsed((prev) => !prev);
  }, []);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: previewWidth };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      // Dragging left = increasing preview width
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
  }, [previewWidth]);

  return (
    <div
      ref={rootRef}
      data-testid="code-root"
      style={{
        height: '100%',
        padding: '12px',
        boxSizing: 'border-box',
        transition: 'padding 180ms ease',
        position: 'relative',
        isolation: 'isolate',
        background: embeddedAgentSession.isEmbedded
          ? 'radial-gradient(circle at top right, rgba(121,196,124,0.08), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 18%)'
          : 'transparent',
        boxShadow: embeddedAgentSession.isEmbedded
          ? 'inset 0 0 0 1px rgba(121,196,124,0.08), inset 0 24px 120px rgba(121,196,124,0.04)'
          : 'none',
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
          top: toggleTop,
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
      <div style={{ display: 'flex', height: '100%', gap: 0 }}>
        {/* Canvas — fills remaining space, no pane styling */}
        <div
          data-testid="code-pane-canvas"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            boxSizing: 'border-box',
            paddingTop: canvasTopInset,
            paddingRight: isPreviewCollapsed ? 0 : 6,
          }}
        >
          <CodeCanvas isPreviewCollapsed={isPreviewCollapsed} />
        </div>

        {/* Resize handle + Preview pane (only visible when not collapsed) */}
        {!isPreviewCollapsed && (
          <>
            {/* Drag handle */}
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

            {/* Preview pane — the only pane with card styling */}
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
