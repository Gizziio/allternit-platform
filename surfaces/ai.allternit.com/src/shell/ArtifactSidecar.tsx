import React, { useEffect, useMemo, useState } from 'react';
import { useSidecarStore } from '../stores/sidecar-store';
import { ChangeSetReview } from '../components/changeset-review/ChangeSetReview';
import type { Icon } from '@phosphor-icons/react';
import {
  AppWindow,
  FileCode,
  FolderOpen,
  GitDiff,
  Lightning,
  ClockClockwise,
  FileText,
  NotePencil,
  PlugsConnected,
  ChatCircleText,
  ChatCenteredText,
  X,
} from '@phosphor-icons/react';
import { useMode } from '../providers/mode-provider';
import { useChatStore } from '../views/chat/ChatStore';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { useCodeSessionStore } from '../views/code/CodeSessionStore';
import { useCoworkSessionStore } from '../views/cowork/CoworkSessionStore';
import { CoworkRightRail } from '../views/cowork/CoworkRightRail';
import { ArtifactDetailView } from '../views/cowork/ArtifactDetailView';
import { useMiniAppDiscovery } from '../views/aci/use-mini-app-discovery';
import type { InstalledMiniApp } from '../views/aci/mini-app.types';
import type { ModeSession } from '../lib/agents/mode-session-store';

export function ArtifactSidecar(): JSX.Element | null {
  const { mode } = useMode();
  const {
    isOpen,
    activePanel,
    width,
    setOpen,
    setActivePanel,
    panels,
  } = useSidecarStore();
  const hasActiveArtifact = Boolean(panels.artifact.activeArtifactId);

  useEffect(() => {
    if (activePanel === 'artifact' && !hasActiveArtifact) {
      setActivePanel('context');
    }
  }, [activePanel, hasActiveArtifact, setActivePanel]);

  if (!isOpen) return null;

  return (
    <div style={{ width, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        borderBottom: '1px solid var(--border-subtle)',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <TabButton
            active={activePanel === 'context'}
            onClick={() => setActivePanel('context')}
            icon={AppWindow}
            title="Workspace"
          />
          {hasActiveArtifact ? (
            <TabButton
              active={activePanel === 'artifact'}
              onClick={() => setActivePanel('artifact')}
              icon={FileCode}
              title="Artifact"
            />
          ) : null}
          <TabButton
            active={activePanel === 'agent'}
            onClick={() => setActivePanel('agent')}
            icon={Lightning}
            title="Activity"
          />
          <TabButton
            active={activePanel === 'changeset'}
            onClick={() => setActivePanel('changeset')}
            icon={GitDiff}
            title="Changes"
          />
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <SidecarPanel panel={activePanel} mode={mode} />
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: Icon;
  title: string;
}

function TabButton({ active, onClick, icon: Icon, title }: TabButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '6px 10px',
        borderRadius: 6,
        border: 'none',
        background: active ? 'var(--bg-primary)' : 'transparent',
        color: active ? 'var(--accent-chat)' : 'var(--text-tertiary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
      }}
    >
      <Icon size={18} weight={active ? 'fill' : 'regular'} />
    </button>
  );
}

function SidecarPanel({ panel, mode }: { panel: string; mode: string }): JSX.Element | null {
  const { panels } = useSidecarStore();

  switch (panel) {
    case 'artifact':
      return panels.artifact.activeArtifactId ? (
        <div style={{ padding: 16 }}>
          <ArtifactDetailView artifactId={panels.artifact.activeArtifactId} />
        </div>
      ) : (
        <EmptyPanel
          icon={<FileCode size={18} />}
          title="No artifact selected"
          description="Artifacts appear here only when a real artifact is generated or selected."
        />
      );
    case 'context':
      return mode === 'cowork' ? <CoworkRightRail /> : <WorkspaceOverviewPanel mode={mode} />;
    case 'changeset':
      return panels.changeset.activeChangeSetId ? (
        <ChangeSetReview changeSetId={panels.changeset.activeChangeSetId} />
      ) : (
        <EmptyPanel
          icon={<GitDiff size={18} />}
          title="No pending changeset"
          description="Reviewable code changes appear here when a real changeset is active."
        />
      );
    case 'agent':
      return <ActivityPanel mode={mode} />;
    default: return null;
  }
}

function WorkspaceOverviewPanel({ mode }: { mode: string }): JSX.Element {
  const { projects, activeProjectId, threads } = useChatStore((state) => ({
    projects: state.projects,
    activeProjectId: state.activeProjectId,
    threads: state.threads,
  }));
  const chatActiveSessionId = useChatSessionStore((state) => state.activeSessionId);
  const chatSessions = useChatSessionStore((state) => state.sessions ?? []);
  const codeActiveSessionId = useCodeSessionStore((state) => state.activeSessionId);
  const codeSessions = useCodeSessionStore((state) => state.sessions ?? []);
  const coworkActiveSessionId = useCoworkSessionStore((state) => state.activeSessionId);
  const coworkSessions = useCoworkSessionStore((state) => state.sessions ?? []);
  const { all: miniApps } = useMiniAppDiscovery();
  const [scratchpad, setScratchpad] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('allternit:sidecar:scratchpad') ?? '';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('allternit:sidecar:scratchpad', scratchpad);
  }, [scratchpad]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const activeSession = useMemo(() => {
    if (mode === 'code') {
      return codeSessions.find((session) => session.id === codeActiveSessionId) ?? null;
    }
    if (mode === 'cowork') {
      return coworkSessions.find((session) => session.id === coworkActiveSessionId) ?? null;
    }
    return chatSessions.find((session) => session.id === chatActiveSessionId) ?? null;
  }, [mode, chatSessions, chatActiveSessionId, codeSessions, codeActiveSessionId, coworkSessions, coworkActiveSessionId]);

  const workspaceFiles = activeSession?.metadata.workspaceFiles ?? [];
  const attachedConnectors = (activeProject?.connectors ?? [])
    .map((id) => miniApps.find((app) => app.id === id))
    .filter((app): app is InstalledMiniApp => app != null);

  const progressLabel = getProgressLabel(activeSession, threads.length);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PanelSection
        title="Progress"
        icon={<ClockClockwise size={16} />}
        subtitle={progressLabel}
      >
        <StatRow label="Mode" value={mode} />
        <StatRow label="Session" value={activeSession?.name ?? 'No active session'} />
        <StatRow label="Messages" value={String(activeSession?.messageCount ?? 0)} />
      </PanelSection>

      <PanelSection
        title="Working Folder"
        icon={<FolderOpen size={16} />}
        subtitle={activeProject?.title ?? 'No active project'}
      >
        {activeProject?.files.length ? (
          activeProject.files.slice(0, 6).map((file) => (
            <ListRow key={file.id} icon={<FileText size={14} />} label={file.name} meta={formatFileSize(file.size)} />
          ))
        ) : workspaceFiles.length ? (
          workspaceFiles.slice(0, 6).map((path) => (
            <ListRow key={path} icon={<FileText size={14} />} label={basename(path)} />
          ))
        ) : (
          <MutedText>No project files or workspace files attached yet.</MutedText>
        )}
      </PanelSection>

      <PanelSection
        title="Scratchpad"
        icon={<NotePencil size={16} />}
        subtitle="Quick notes that stay with the shell"
      >
        <textarea
          value={scratchpad}
          onChange={(event) => setScratchpad(event.target.value)}
          placeholder="Capture notes, prompts, or next steps."
          style={{
            width: '100%',
            minHeight: 110,
            resize: 'vertical',
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            padding: 10,
            fontSize: 12,
            lineHeight: 1.45,
          }}
        />
      </PanelSection>

      <PanelSection
        title="Context"
        icon={<ChatCenteredText size={16} />}
        subtitle="Files, connectors, and workspace context"
      >
        <StatRow label="Threads" value={String(activeProject?.threadIds.length ?? 0)} />
        <StatRow label="Workspace files" value={String(workspaceFiles.length)} />
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachedConnectors.length ? (
            attachedConnectors.map((connector) => (
              <ListRow
                key={connector.id}
                icon={<PlugsConnected size={14} />}
                label={connector.name}
                meta={connector.status}
              />
            ))
          ) : (
            <MutedText>No connectors attached to the active project.</MutedText>
          )}
        </div>
      </PanelSection>
    </div>
  );
}

function ActivityPanel({ mode }: { mode: string }): JSX.Element {
  const sessions = useMemo(() => {
    if (mode === 'code') return useCodeSessionStore.getState().sessions ?? [];
    if (mode === 'cowork') return useCoworkSessionStore.getState().sessions ?? [];
    return useChatSessionStore.getState().sessions ?? [];
  }, [mode]);

  const recent = [...sessions]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PanelSection
        title="Recent Activity"
        icon={<Lightning size={16} />}
        subtitle="Latest active sessions in this surface"
      >
        {recent.length ? (
          recent.map((session) => (
            <ListRow
              key={session.id}
              icon={session.metadata.sessionMode === 'agent' ? <Lightning size={14} /> : <ChatCircleText size={14} />}
              label={session.name}
              meta={relativeTime(session.updatedAt)}
            />
          ))
        ) : (
          <MutedText>No sessions recorded for this surface yet.</MutedText>
        )}
      </PanelSection>
    </div>
  );
}

function PanelSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        background: 'var(--bg-secondary)',
        padding: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ color: 'var(--text-secondary)' }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, marginBottom: 6 }}>
      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  );
}

function ListRow({ icon, label, meta }: { icon: React.ReactNode; label: string; meta?: string }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 8px',
        borderRadius: 10,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ color: 'var(--text-tertiary)' }}>{icon}</div>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {meta ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{meta}</span> : null}
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%', textAlign: 'center' }}>
      <div style={{ color: 'var(--text-tertiary)' }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 240 }}>{description}</div>
    </div>
  );
}

function MutedText({ children }: { children: React.ReactNode }): JSX.Element {
  return <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{children}</div>;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function relativeTime(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))}m ago`;
  if (ms < 86_400_000) return `${Math.max(1, Math.round(ms / 3_600_000))}h ago`;
  return `${Math.max(1, Math.round(ms / 86_400_000))}d ago`;
}

function getProgressLabel(session: ModeSession | null, threadCount: number): string {
  if (!session) return threadCount > 0 ? `${threadCount} threads available` : 'No active work yet';
  if (session.metadata.sessionMode === 'agent') return 'Agent-assisted session in progress';
  return 'Direct session active';
}
