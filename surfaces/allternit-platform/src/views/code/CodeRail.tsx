import React, { useMemo, useState } from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  ClockCounterClockwise,
  Code,
  FileCode,
  Files,
  GitBranch,
  Lightning,
  ShieldCheck,
  Stack,
  WarningCircle,
  Pulse,
} from '@phosphor-icons/react';
import {
  CodeIsolation,
  CodeSessionMode,
  CodeSessionRecord,
  CodeSessionState,
  getActiveWorkspace,
  getSessionsForWorkspace,
  useCodeModeStore,
} from './CodeModeStore';

type RailViewId = 'diff-review' | 'file-tree' | 'tests' | 'pr-monitor' | 'telemetry';

interface CodeRailProps {
  onOpen?: (viewId: RailViewId) => void;
}

const VIEW_ITEMS: Array<{
  id: RailViewId;
  label: string;
  icon: PhosphorIcon;
}> = [
  { id: 'diff-review', label: 'Diff Review', icon: Files },
  { id: 'file-tree', label: 'File Tree', icon: FileCode },
  { id: 'tests', label: 'Tests', icon: Lightning },
  { id: 'pr-monitor', label: 'PR Monitor', icon: GitBranch },
  { id: 'telemetry', label: 'Telemetry', icon: Pulse },
];

const modeColors: Record<CodeSessionMode, string> = {
  SAFE: '#5ec7ff',
  DEFAULT: '#ffbf5e',
  AUTO: '#50d18d',
  PLAN: '#d789ff',
};

const stateColors: Record<CodeSessionState, string> = {
  IDLE: '#8f99ad',
  PLANNING: '#7f8cff',
  PLAN_READY: '#b077ff',
  EXECUTING: '#45c56b',
  AWAITING_APPROVAL: '#f59e0b',
  CHANGESET_READY: '#10b981',
  APPLYING: '#06b6d4',
  VERIFYING: '#22c55e',
  DONE: '#34d399',
  FAILED: '#ff6b6b',
  TERMINATED: '#9ca3af',
};

const isolationColors: Record<CodeIsolation, string> = {
  worktree: '#8ec5ff',
  sandbox: '#ff9d5c',
};

function sectionButtonStyle(expanded: boolean): React.CSSProperties {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    background: expanded ? 'rgba(255,255,255,0.04)' : 'transparent',
    border: 'none',
    borderRadius: 8,
    color: 'var(--text-tertiary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    cursor: 'pointer',
  };
}

function pillStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 6px',
    borderRadius: 999,
    background: `${color}22`,
    border: `1px solid ${color}55`,
    color,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.2,
  };
}

function SessionRow({
  session,
  isActive,
  onSelect,
}: {
  session: CodeSessionRecord;
  isActive: boolean;
  onSelect: () => void;
}) {
  const hasError = Boolean(session.last_error);

  return (
    <button
      onClick={onSelect}
      data-testid={`code-session-${session.session_id}`}
      style={{
        width: '100%',
        border: `1px solid ${isActive ? 'var(--accent-chat)' : 'var(--border-subtle)'}`,
        background: isActive ? 'rgba(86, 169, 255, 0.12)' : 'rgba(255,255,255,0.02)',
        borderRadius: 10,
        padding: 10,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: stateColors[session.state],
            boxShadow: `0 0 0 4px ${stateColors[session.state]}22`,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {session.title}
          </div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
            {session.session_id}
          </div>
        </div>
        {session.pending_approvals_count > 0 && (
          <div
            style={{
              minWidth: 20,
              height: 20,
              borderRadius: 999,
              background: '#f59e0b22',
              border: '1px solid #f59e0b77',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {session.pending_approvals_count}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span style={pillStyle(modeColors[session.mode])}>{session.mode}</span>
        <span style={pillStyle(stateColors[session.state])}>{session.state}</span>
        <span style={pillStyle(isolationColors[session.isolation])}>
          {session.isolation}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 6,
          color: 'var(--text-tertiary)',
          fontSize: 11,
        }}
      >
        <div>Files: {session.files_touched.length}</div>
        <div>Previews: {session.preview_sessions.length}</div>
      </div>

      {hasError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            color: '#ff8f8f',
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          <WarningCircle size={14} weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{session.last_error}</span>
        </div>
      )}
    </button>
  );
}

export function CodeRail({ onOpen }: CodeRailProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    workspace: true,
    sessions: true,
    views: true,
  });

  const workspaces = useCodeModeStore((state) => state.workspaces);
  const sessions = useCodeModeStore((state) => state.sessions);
  const activeWorkspaceId = useCodeModeStore((state) => state.activeWorkspaceId);
  const activeSessionId = useCodeModeStore((state) => state.activeSessionId);
  const setActiveWorkspace = useCodeModeStore((state) => state.setActiveWorkspace);
  const setActiveSession = useCodeModeStore((state) => state.setActiveSession);

  const activeWorkspace = useMemo(
    () => getActiveWorkspace({ workspaces, sessions, activeWorkspaceId, activeSessionId }),
    [activeSessionId, activeWorkspaceId, sessions, workspaces],
  );
  const workspaceSessions = useMemo(
    () =>
      getSessionsForWorkspace(
        { workspaces, sessions, activeWorkspaceId, activeSessionId },
        activeWorkspaceId,
      ),
    [activeSessionId, activeWorkspaceId, sessions, workspaces],
  );
  const activeSession = useMemo(
    () => sessions.find((session) => session.session_id === activeSessionId),
    [activeSessionId, sessions],
  );

  const toggle = (sectionId: string) => {
    setExpanded((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: 14,
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Workspace
          </div>
          <select
            aria-label="Code workspace selector"
            data-testid="code-workspace-selector"
            value={activeWorkspaceId}
            onChange={(event) => setActiveWorkspace(event.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.workspace_id} value={workspace.workspace_id}>
                {workspace.display_name}
              </option>
            ))}
          </select>
        </div>

        {activeWorkspace && (
          <div
            style={{
              border: '1px solid var(--border-subtle)',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 10,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitBranch size={14} color="var(--text-secondary)" />
              <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>
                {activeWorkspace.repo_status.branch}
              </span>
              <span
                style={pillStyle(
                  activeWorkspace.repo_status.dirty ? '#ffb24c' : '#58d68d',
                )}
              >
                {activeWorkspace.repo_status.dirty ? 'DIRTY' : 'CLEAN'}
              </span>
            </div>
            <div
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 11,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={activeWorkspace.root_path}
            >
              {activeWorkspace.root_path}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span style={pillStyle('#8ec5ff')}>
                ahead {activeWorkspace.repo_status.ahead}
              </span>
              <span style={pillStyle('#ff9f7a')}>
                behind {activeWorkspace.repo_status.behind}
              </span>
              <span style={pillStyle('#b0b9ca')}>
                staged {activeWorkspace.repo_status.staged_count}
              </span>
              <span style={pillStyle('#b0b9ca')}>
                unstaged {activeWorkspace.repo_status.unstaged_count}
              </span>
              <span style={pillStyle('#b0b9ca')}>
                untracked {activeWorkspace.repo_status.untracked_count}
              </span>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <section>
          <button onClick={() => toggle('workspace')} style={sectionButtonStyle(expanded.workspace)}>
            {expanded.workspace ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
            <Code size={13} weight="fill" />
            Workspace Snapshot
          </button>
          {expanded.workspace && activeSession && (
            <div
              style={{
                marginTop: 8,
                borderLeft: '1px solid var(--border-subtle)',
                marginLeft: 10,
                paddingLeft: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                Active session policy
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={14} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>
                  {activeSession.policy_profile_id}
                </span>
              </div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                {activeWorkspace?.context_anchor ? `Anchor: ${activeWorkspace.context_anchor}` : 'No context anchor declared'}
              </div>
            </div>
          )}
        </section>

        <section>
          <button onClick={() => toggle('sessions')} style={sectionButtonStyle(expanded.sessions)}>
            {expanded.sessions ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
            <ClockCounterClockwise size={13} weight="fill" />
            Sessions
            <span style={{ marginLeft: 'auto', opacity: 0.75 }}>{workspaceSessions.length}</span>
          </button>
          {expanded.sessions && (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {workspaceSessions.map((session) => (
                <SessionRow
                  key={session.session_id}
                  session={session}
                  isActive={session.session_id === activeSessionId}
                  onSelect={() => setActiveSession(session.session_id)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <button onClick={() => toggle('views')} style={sectionButtonStyle(expanded.views)}>
            {expanded.views ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
            <Stack size={13} weight="fill" />
            Views
          </button>
          {expanded.views && (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {VIEW_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onOpen?.(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={14} weight="fill" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {activeSession && (
          <section
            style={{
              marginTop: 'auto',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Current Focus
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>
              <CheckCircle size={14} color={stateColors[activeSession.state]} weight="fill" />
              {activeSession.title}
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
              {activeSession.files_touched.length > 0
                ? activeSession.files_touched.join(', ')
                : 'No files touched yet'}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
