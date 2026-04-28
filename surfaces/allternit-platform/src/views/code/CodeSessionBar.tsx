import React, { useMemo } from 'react';
import { ArrowBendUpRight, ClockCounterClockwise, GitBranch, WarningCircle } from '@phosphor-icons/react';
import { ContextWindowCard } from '@/components/ai-elements/ContextWindowCard';
import {
  getActiveSession,
  getActiveWorkspace,
  getSessionsForWorkspace,
  useCodeModeStore,
} from './CodeModeStore';

const fieldShellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 170,
  padding: '10px 12px',
  borderRadius: 16,
  background: 'rgba(17, 20, 24, 0.26)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
};

const selectStyle: React.CSSProperties = {
  maxWidth: '100%',
  padding: '8px 10px',
  background: 'rgba(9, 12, 14, 0.32)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 12,
  color: 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 700,
};

const helperTextStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--text-tertiary)',
  letterSpacing: 0.2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function pillStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 10px',
    borderRadius: 999,
    background: `${color}18`,
    border: `1px solid ${color}40`,
    color,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.2,
    whiteSpace: 'nowrap',
  };
}

function statChipStyle(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: 'var(--text-tertiary)',
    fontSize: 10,
    fontWeight: 600,
  };
}

export function CodeSessionBar() {
  const workspaces = useCodeModeStore((state) => state.workspaces);
  const sessions = useCodeModeStore((state) => state.sessions);
  const activeWorkspaceId = useCodeModeStore((state) => state.activeWorkspaceId);
  const activeSessionId = useCodeModeStore((state) => state.activeSessionId);
  const setActiveWorkspace = useCodeModeStore((state) => state.setActiveWorkspace);
  const setActiveSession = useCodeModeStore((state) => state.setActiveSession);

  const stateShape = useMemo(
    () => ({ workspaces, sessions, activeWorkspaceId, activeSessionId }),
    [activeSessionId, activeWorkspaceId, sessions, workspaces],
  );
  const activeWorkspace = useMemo(() => getActiveWorkspace(stateShape), [stateShape]);
  const activeSession = useMemo(() => getActiveSession(stateShape), [stateShape]);
  const workspaceSessions = useMemo(
    () => getSessionsForWorkspace(stateShape, activeWorkspaceId),
    [activeWorkspaceId, stateShape],
  );

  return (
    <div
      data-testid="code-session-bar"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 10,
        flexWrap: 'wrap',
        minWidth: 0,
      }}
    >
      <div style={fieldShellStyle}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 0.45,
          }}
        >
          Workspace
        </span>
        <select
          aria-label="Code workspace selector"
          data-testid="code-sessionbar-workspace-selector"
          value={activeWorkspaceId}
          onChange={(event) => setActiveWorkspace(event.target.value)}
          style={selectStyle}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.workspace_id} value={workspace.workspace_id}>
              {workspace.display_name}
            </option>
          ))}
        </select>
        <span style={helperTextStyle}>{activeWorkspace?.root_path ?? 'No active workspace'}</span>
      </div>

      <div style={fieldShellStyle}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 0.45,
          }}
        >
          Session
        </span>
        <select
          aria-label="Code session selector"
          data-testid="code-sessionbar-session-selector"
          value={activeSessionId}
          onChange={(event) => setActiveSession(event.target.value)}
          style={selectStyle}
        >
          {workspaceSessions.map((session) => (
            <option key={session.session_id} value={session.session_id}>
              {session.title}
            </option>
          ))}
        </select>
        <span style={helperTextStyle}>{activeSession?.wih_id ?? 'No WIH attached'}</span>
      </div>

      <div
        style={{
          ...fieldShellStyle,
          flex: 1,
          minWidth: 220,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {activeWorkspace && (
            <span
              data-testid="code-sessionbar-workspace-pill"
              style={pillStyle(activeWorkspace.repo_status.dirty ? '#ffb24c' : '#58d68d')}
            >
              <GitBranch size={12} weight="bold" />
              {`${activeWorkspace.repo_status.branch}${activeWorkspace.repo_status.dirty ? 'DIRTY' : 'CLEAN'}`}
            </span>
          )}

          {activeSession && (
            <ContextWindowCard>
              <button style={{ ...pillStyle('#7db8ff'), cursor: 'pointer', outline: 'none' }}>
                <ClockCounterClockwise size={12} weight="bold" />
                {`${activeSession.mode}${activeSession.state}`}
              </button>
            </ContextWindowCard>
          )}

          {activeSession && activeSession.pending_approvals_count > 0 && (
            <span data-testid="code-sessionbar-pending-pill" style={pillStyle('var(--status-warning)')}>
              <WarningCircle size={12} weight="fill" />
              {`${activeSession.pending_approvals_count} pending`}
            </span>
          )}
        </div>

        {activeWorkspace && activeSession && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span style={statChipStyle()}>
              <ArrowBendUpRight size={11} weight="bold" />
              {`+${activeWorkspace.repo_status.ahead}/-${activeWorkspace.repo_status.behind}`}
            </span>
            <span style={statChipStyle()}>{`${activeSession.files_touched.length} files`}</span>
            {activeSession.preview_sessions.length > 0 && (
              <span style={statChipStyle()}>{`${activeSession.preview_sessions.length} previews`}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
