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
import { useIsMobile } from '../hooks/useMediaQuery';
import { useChatStore } from '../views/chat/ChatStore';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { useCodeSessionStore } from '../views/code/CodeSessionStore';
import { useCoworkSessionStore } from '../views/cowork/CoworkSessionStore';
import { CoworkRightRail } from '../views/cowork/CoworkRightRail';
import { ArtifactDetailView } from '../views/cowork/ArtifactDetailView';
import { useMiniAppDiscovery } from '../views/aci/use-mini-app-discovery';
import type { InstalledMiniApp } from '../views/aci/mini-app.types';
import type { ModeSession } from '../lib/agents/mode-session-store';
import { cn } from '@/lib/utils';

export function ArtifactSidecar(): React.ReactNode | null {
  const { mode } = useMode();
  const isMobile = useIsMobile();
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
    <div className="flex flex-col h-full bg-[var(--bg-primary)] border-l border-solid border-[var(--border-subtle)]" style={{ width: isMobile ? '100%' : width }}>
      <div className="h-12 flex items-center px-3 border-b border-solid border-[var(--border-subtle)] justify-between bg-[var(--bg-secondary)]">
        <div className="flex gap-1">
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
        <button type="button"
          onClick={() => setOpen(false)}
          className="bg-transparent border-none text-[var(--text-tertiary)] cursor-pointer p-1 max-md:p-3.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
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

function TabButton({ active, onClick, icon: Icon, title }: TabButtonProps): React.ReactNode {
  return (
    <button type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-[6px_10px] max-md:min-h-11 max-md:min-w-11 rounded-md border-none flex items-center justify-center cursor-pointer transition-all duration-200",
        active ? "bg-[var(--bg-primary)] text-[var(--accent-chat)]" : "bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"
      )}
    >
      <Icon size={18} weight={active ? 'fill' : 'regular'} />
    </button>
  );
}

function SidecarPanel({ panel, mode }: { panel: string; mode: string }): React.ReactNode | null {
  const { panels } = useSidecarStore();

  switch (panel) {
    case 'artifact':
      return panels.artifact.activeArtifactId ? (
        <div className="p-4">
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

function WorkspaceOverviewPanel({ mode }: { mode: string }): React.ReactNode {
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
    <div className="p-4 flex flex-col gap-3">
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
        <textarea aria-label="Text Area" value={scratchpad}
          onChange={(event) => setScratchpad(event.target.value)}
          placeholder="Capture notes, prompts, or next steps…"
          className="w-full min-h-[110px] resize-y rounded-[10px] border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] p-2.5 text-[12px] leading-relaxed outline-none"
        />
      </PanelSection>

      <PanelSection
        title="Context"
        icon={<ChatCenteredText size={16} />}
        subtitle="Files, connectors, and workspace context"
      >
        <StatRow label="Threads" value={String(activeProject?.threadIds.length ?? 0)} />
        <StatRow label="Workspace files" value={String(workspaceFiles.length)} />
        <div className="mt-2 flex flex-col gap-1.5">
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

function ActivityPanel({ mode }: { mode: string }): React.ReactNode {
  const sessions = useMemo(() => {
    if (mode === 'code') return useCodeSessionStore.getState().sessions ?? [];
    if (mode === 'cowork') return useCoworkSessionStore.getState().sessions ?? [];
    return useChatSessionStore.getState().sessions ?? [];
  }, [mode]);

  const recent = [...sessions]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  return (
    <div className="p-4 flex flex-col gap-3">
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
}): React.ReactNode {
  return (
    <section className="border border-solid border-[var(--border-subtle)] rounded-[14px] bg-[var(--bg-secondary)] p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="text-[var(--text-secondary)]">{icon}</div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-[var(--text-primary)]">{title}</div>
          {subtitle ? (
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{subtitle}</div>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <div className="flex justify-between gap-3 text-[12px] mb-1.5">
      <span className="text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

function ListRow({ icon, label, meta }: { icon: React.ReactNode; label: string; meta?: string }): React.ReactNode {
  return (
    <div className="flex items-center gap-2 p-[7px_8px] rounded-[10px] bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
      <div className="text-[var(--text-tertiary)]">{icon}</div>
      <span className="flex-1 min-w-0 text-[12px] text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap">
        {label}
      </span>
      {meta ? <span className="text-[11px] text-[var(--text-tertiary)]">{meta}</span> : null}
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
}): React.ReactNode {
  return (
    <div className="p-5 flex flex-col items-center justify-center gap-2.5 h-full text-center">
      <div className="text-[var(--text-tertiary)]">{icon}</div>
      <div className="text-[14px] font-bold text-[var(--text-primary)]">{title}</div>
      <div className="text-[12px] text-[var(--text-secondary)] max-w-[240px]">{description}</div>
    </div>
  );
}

function MutedText({ children }: { children: React.ReactNode }): React.ReactNode {
  return <div className="text-[12px] text-[var(--text-tertiary)]">{children}</div>;
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
