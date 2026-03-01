import React, { useMemo } from 'react';
import { Globe } from '@phosphor-icons/react';
import { GizziMascot } from '@/components/ai-elements/GizziMascot';
import { getActiveSession, useCodeModeStore } from './CodeModeStore';

export function CodePreviewPane() {
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
  const hasPreviewSession = previewSessions.length > 0;

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
        {hasPreviewSession ? (
          <iframe
            src="http://localhost:3000"
            title="Web Preview"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 14,
              background: 'rgba(10,12,14,0.5)',
            }}
          />
        ) : (
          <>
            <GizziMascot size={50} emotion="steady" />
            <div style={{ marginTop: 14, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              Setting up preview
            </div>
            <div
              style={{
                marginTop: 8,
                maxWidth: 240,
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
              }}
            >
              Start or attach a preview session and the web surface will stay docked here without adding extra chrome to the workspace.
            </div>
          </>
        )}
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}
      >
        View session logs
      </div>
    </div>
  );
}
