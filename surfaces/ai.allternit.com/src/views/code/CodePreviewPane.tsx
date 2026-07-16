import React, { useEffect, useMemo, useState } from 'react';
import { Globe, ArrowSquareOut } from '@phosphor-icons/react';
import { GizziMascot } from '@/components/ai-elements/GizziMascot';
import { getActiveSession, useCodeModeStore } from './CodeModeStore';
import { useDrawerStore } from '@/drawers/drawer.store';

function isValidPreviewUrl(value: string): boolean {
  return /^https?:\/\//.test(value);
}

export function CodePreviewPane(): React.ReactNode {
  const workspaces = useCodeModeStore((state) => state.workspaces);
  const sessions = useCodeModeStore((state) => state.sessions);
  const activeWorkspaceId = useCodeModeStore((state) => state.activeWorkspaceId);
  const activeSessionId = useCodeModeStore((state) => state.activeSessionId);

  const activeSession = useMemo(
    () => getActiveSession({ workspaces, sessions, activeWorkspaceId, activeSessionId }),
    [activeSessionId, activeWorkspaceId, sessions, workspaces],
  );
  const previewSessions = Array.isArray(activeSession?.preview_sessions)
    ? activeSession.preview_sessions
    : [];
  const configuredUrl = previewSessions.find(isValidPreviewUrl);
  const hasPreviewSession = Boolean(configuredUrl);

  const [urlInput, setUrlInput] = useState(configuredUrl ?? '');
  const [loadedUrl, setLoadedUrl] = useState(configuredUrl ?? '');
  const openDrawer = useDrawerStore((state) => state.openDrawer);
  const setConsoleTab = useDrawerStore((state) => state.setConsoleTab);

  // Keep input in sync if the active session changes and supplies a new URL.
  useEffect(() => {
    if (configuredUrl && configuredUrl !== loadedUrl) {
      setLoadedUrl(configuredUrl);
      setUrlInput(configuredUrl);
    }
  }, [configuredUrl, loadedUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidPreviewUrl(urlInput)) {
      setLoadedUrl(urlInput);
    }
  };

  return (
    <div
      data-testid="code-preview-pane"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(12, 15, 18, 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '12px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(12, 15, 18, 0.12)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          <Globe size={14} />
          Preview
        </div>
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            justifyContent: 'flex-end',
            minWidth: 0,
          }}
        >
          <input
            aria-label="Preview URL"
            data-testid="code-preview-url-input"
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://localhost:3000"
            style={{
              width: '100%',
              maxWidth: 320,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.03)',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            data-testid="code-preview-url-go"
            disabled={!isValidPreviewUrl(urlInput)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-primary)',
              cursor: isValidPreviewUrl(urlInput) ? 'pointer' : 'not-allowed',
              opacity: isValidPreviewUrl(urlInput) ? 1 : 0.5,
            }}
          >
            <ArrowSquareOut size={14} />
          </button>
        </form>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          textAlign: 'center',
        }}
      >
        {loadedUrl ? (
          <iframe
            data-testid="code-preview-frame"
            src={loadedUrl}
            title="Web Preview"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 14,
              background: 'rgba(10,12,14,0.5)',
            }}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <>
            <GizziMascot size={50} emotion="steady" />
            <div style={{ marginTop: 14, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              No preview session
            </div>
            <div
              style={{
                marginTop: 8,
                maxWidth: 260,
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
              }}
            >
              Start or attach a preview session, or enter a URL above to load a preview here without adding extra chrome to the workspace.
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setConsoleTab('mission-control');
          openDrawer('console', { tab: 'mission-control', minHeight: 320 });
        }}
        style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: 12,
          color: 'var(--text-tertiary)',
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        View session activity
      </button>
    </div>
  );
}
