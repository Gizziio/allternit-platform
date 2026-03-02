import React, { useState, useCallback, memo, useEffect } from 'react';
import { 
  CaretDown, 
  CaretRight, 
  Gear, 
  ChatTeardropText, 
  FolderOpen, 
  FolderPlus, 
  MagnifyingGlass, 
  Robot, 
  Sparkle,
  Globe,
  DotsThree,
  Pencil,
  Folder,
  Trash,
  Archive,
  Cpu,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import { useChatStore, ChatThread, ChatProject } from '../views/chat/ChatStore';
import { useArtifactStore } from '../views/cowork/ArtifactStore';
import { RAIL_CONFIG, type RailConfigSection } from './rail/rail.config';
import { COWORK_RAIL_CONFIG } from './rail/cowork.config';
import { CODE_RAIL_CONFIG } from './rail/code.config';
import { useFeaturePlugins } from '../plugins/useFeaturePlugins';
import { useBrowserStore } from '../capsules/browser/browser.store';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { RailRowMenu } from './rail/RailRowMenu';
import {
  getOpenClawWorkspacePathFromAgent,
  useAgentStore,
  useEmbeddedAgentSessionStore,
  useNativeAgentStore,
  type NativeSession,
} from '../lib/agents';
import {
  formatAgentSessionMetaLabel,
  getAgentSessionDescriptor,
  type AgentSessionSurface,
} from '../lib/agents/session-metadata';
import { useAgentSurfaceModeStore } from '../stores/agent-surface-mode.store';
import { useSidecarStore } from '../stores/sidecar-store';

interface ShellRailProps {
  activeViewType?: string;
  onOpen?: (view: string) => void;
  onNew?: () => void;
  mode?: 'chat' | 'cowork' | 'code';
  isCollapsed?: boolean;
  onToggle?: () => void;
  onModeChange?: (mode: 'chat' | 'cowork' | 'code') => void;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
  onOpenControlCenter?: () => void;
  onSidecarToggle?: () => void;
  sidecarOpen?: boolean;
}

export function ShellRail({
  activeViewType,
  onOpen,
  onNew,
  mode = 'chat',
  isCollapsed,
  onModeChange,
}: ShellRailProps) {
  const [foldedCategories, setFoldedCategories] = useState<Set<string>>(new Set(['workspace', 'ai_vision', 'infrastructure', 'security', 'execution', 'observability', 'services']));
  const [isLoading, setIsLoading] = useState(false);

  const { 
    threads, 
    projects, 
    activeThreadId, 
    activeProjectId, 
    setActiveThread, 
    setActiveProject, 
    createProject,
    renameThread,
    deleteThread,
    moveThreadToProject,
    renameProject,
    deleteProject,
  } = useChatStore();
  const nativeSessions = useNativeAgentStore((state) => state.sessions);
  const activeNativeSessionId = useNativeAgentStore((state) => state.activeSessionId);
  const fetchNativeSessions = useNativeAgentStore((state) => state.fetchSessions);
  const createNativeSession = useNativeAgentStore((state) => state.createSession);
  const setActiveNativeSession = useNativeAgentStore((state) => state.setActiveSession);
  const embeddedSessionIdBySurface = useEmbeddedAgentSessionStore(
    (state) => state.sessionIdBySurface,
  );
  const setEmbeddedSession = useEmbeddedAgentSessionStore(
    (state) => state.setSurfaceSession,
  );
  const clearEmbeddedSession = useEmbeddedAgentSessionStore(
    (state) => state.clearSurfaceSession,
  );
  const selectedAgentIdBySurface = useAgentSurfaceModeStore(
    (state) => state.selectedAgentIdBySurface,
  );
  const setAgentModeEnabled = useAgentSurfaceModeStore((state) => state.setEnabled);
  const setSelectedSurfaceAgent = useAgentSurfaceModeStore(
    (state) => state.setSelectedAgent,
  );
  const agents = useAgentStore((state) => state.agents);
  const { artifacts, activeArtifactId, setActiveArtifact } = useArtifactStore();
  const { tabs, activeTabId, setActiveTab } = useBrowserStore();
  const setSidecarOpen = useSidecarStore((state) => state.setOpen);

  const isBrowser = activeViewType === 'browser';
  const { enabledPlugins } = useFeaturePlugins();

  // Build active config, then inject any enabled-plugin rail items
  let activeConfig: RailConfigSection[];
  if (mode === 'cowork') activeConfig = COWORK_RAIL_CONFIG;
  else if (mode === 'code') activeConfig = CODE_RAIL_CONFIG;
  else {
    // Deep-clone so we don't mutate the static constant
    activeConfig = RAIL_CONFIG.map(section => ({ ...section, items: [...section.items] }));
    // Inject views contributed by enabled plugins
    enabledPlugins.forEach(plugin => {
      plugin.views.forEach(view => {
        const section = activeConfig.find(s => s.id === view.railSection);
        if (section && !section.items.some(item => item.id === view.viewType)) {
          // Use a generic grid icon for plugin-injected items (icon resolved at render via RailConfigItem)
          // Use Sparkle as the default plugin-injected rail icon
          const existingIcon = RAIL_CONFIG.flatMap(s => s.items).find(i => i.id === view.viewType)?.icon;
          section.items.push({
            id: view.viewType,
            label: view.label,
            icon: (existingIcon ?? Sparkle) as any,
            payload: view.viewType,
          });
        }
      });
    });
  }

  const toggleFold = useCallback((id: string) => {
    setFoldedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateProject = useCallback(() => {
    createProject('New Project');
  }, [createProject]);

  useEffect(() => {
    void fetchNativeSessions().catch(() => {});
  }, [fetchNativeSessions]);

  if (isCollapsed) return null;

  const currentAgentSurface: AgentSessionSurface =
    activeViewType === 'browser' || activeViewType === 'browserview'
      ? 'browser'
      : mode === 'cowork'
        ? 'cowork'
        : mode === 'code'
          ? 'code'
          : 'chat';
  const selectedAgentId = selectedAgentIdBySurface[currentAgentSurface];
  const selectedAgent =
    selectedAgentId
      ? agents.find((agent) => agent.id === selectedAgentId) ?? null
      : null;

  const openChatSurface = useCallback(() => {
    clearEmbeddedSession('chat');
    if (onModeChange) {
      onModeChange('chat');
      return;
    }
    onOpen?.('chat');
  }, [clearEmbeddedSession, onModeChange, onOpen]);

  const openNativeSessionSurface = useCallback((session: NativeSession) => {
    const descriptor = getAgentSessionDescriptor(session.metadata);
    const originSurface = descriptor.originSurface;

    setActiveNativeSession(session.id);

    if (
      originSurface === 'chat' ||
      originSurface === 'code' ||
      originSurface === 'cowork' ||
      originSurface === 'browser'
    ) {
      setEmbeddedSession(originSurface, session.id);
      setAgentModeEnabled(originSurface, true);
      if (descriptor.agentId) {
        setSelectedSurfaceAgent(originSurface, descriptor.agentId);
      }

      if (originSurface === 'browser') {
        setSidecarOpen(true);
        onOpen?.('browser');
        return;
      }

      if (onModeChange) {
        if (originSurface === 'code') {
          onModeChange('code');
        } else if (originSurface === 'cowork') {
          onModeChange('cowork');
        } else {
          onModeChange('chat');
        }
        return;
      }

      if (originSurface === 'cowork') {
        onOpen?.('workspace');
      } else {
        onOpen?.(originSurface === 'code' ? 'code' : 'chat');
      }
      return;
    }

    onOpen?.('native-agent');
  }, [
    onModeChange,
    onOpen,
    setActiveNativeSession,
    setAgentModeEnabled,
    setEmbeddedSession,
    setSelectedSurfaceAgent,
    setSidecarOpen,
  ]);

  const isCodeMode = mode === 'code';

  return (
    <div style={{ 
      width: 284, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      background: isCodeMode 
        ? 'transparent' 
        : 'linear-gradient(180deg, rgba(24,21,20,0.98) 0%, rgba(31,27,25,0.98) 48%, rgba(20,18,18,0.98) 100%)',
      borderRadius: isCodeMode ? 0 : 24, 
      border: isCodeMode ? 'none' : '1px solid rgba(212,176,140,0.14)',
      boxShadow: isCodeMode ? 'none' : '0 18px 48px rgba(16,12,10,0.28)',
      position: 'relative', 
      overflow: 'hidden',
      outline: 'none',
    }}>
      {!isCodeMode && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at top left, rgba(217,119,87,0.14), transparent 30%), radial-gradient(circle at top right, rgba(176,141,110,0.1), transparent 32%)',
            opacity: 0.9,
          }}
        />
      )}
      {/* SPACER FOR FIXED CONTROLS */}
      <div style={{ height: 104 }} />

      {/* SEARCH BAR */}
      <div style={{ padding: '0 16px 12px 16px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          background: isCodeMode 
            ? 'rgba(255,255,255,0.03)' 
            : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))', 
          borderRadius: 14, 
          padding: '9px 12px', 
          border: isCodeMode 
            ? '1px solid rgba(255,255,255,0.06)' 
            : '1px solid rgba(212,176,140,0.12)',
          boxShadow: isCodeMode ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
          <MagnifyingGlass size={16} color="#b08d6e" weight="bold" />
          <input 
            placeholder="Search..." 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              outline: 'none', 
              color: '#ececec', 
              fontSize: 13, 
              width: '100%',
              fontWeight: 500
            }} 
          />
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {activeConfig.map((category) => {
          const isFolded = foldedCategories.has(category.id);
          const isCore = category.id === 'core';

          return (
            <div key={category.id} style={{ marginBottom: 4 }}>
              {!isCore ? (
                <button 
                  onClick={() => toggleFold(category.id)}
                  style={{ 
                    width: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    padding: '8px 12px', 
                    background: 'transparent', 
                    border: 'none', 
                    cursor: 'pointer', 
                    color: '#b08d6e',
                    borderRadius: 12,
                    transition: 'background 0.2s, color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.color = '#d4b08c';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#b08d6e';
                  }}
                >
                  {isFolded ? <CaretRight size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />}
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{category.title}</span>
                </button>
              ) : null}

              {!isFolded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                  {category.id === 'sessions' ? (
                    <SessionsSection
                      projects={projects}
                      threads={threads}
                      activeProjectId={activeProjectId}
                      activeThreadId={activeThreadId}
                      onCreateProject={handleCreateProject}
                      onSetActiveProject={setActiveProject}
                      onSetActiveThread={setActiveThread}
                      onOpenChatSurface={openChatSurface}
                      onOpen={onOpen}
                      onRenameThread={renameThread}
                      onDeleteThread={deleteThread}
                      onArchiveThread={(id: string) => {
                        // Archive by moving to a special "archived" project or mark as archived
                        // For now, we'll just show an alert - you can implement proper archiving
                        console.log('Archive thread:', id);
                      }}
                      onMoveThreadToProject={moveThreadToProject}
                      onRenameProject={renameProject}
                      onDeleteProject={deleteProject}
                      activeViewType={activeViewType}
                      nativeSessions={nativeSessions}
                      activeNativeSessionId={activeNativeSessionId}
                      onOpenHistory={() => onOpen?.('history')}
                      onOpenArchived={() => onOpen?.('archived')}
                      onOpenNativeWorkspace={() => onOpen?.('native-agent')}
                      embeddedSessionIdBySurface={embeddedSessionIdBySurface}
                      onOpenNativeSession={openNativeSessionSurface}
                      onCreateNativeSession={async () => {
                        try {
                          const session = await createNativeSession(
                            undefined,
                            undefined,
                            {
                              originSurface: currentAgentSurface,
                              sessionMode: 'agent',
                              agentId: selectedAgent?.id,
                              agentName: selectedAgent?.name,
                              workspaceScope: getOpenClawWorkspacePathFromAgent(selectedAgent),
                              runtimeModel: selectedAgent?.model,
                              agentFeatures: {
                                workspace: true,
                                tools: true,
                              },
                            },
                          );
                          openNativeSessionSurface(session);
                          return;
                        } catch (_error) {}
                        onOpen?.('native-agent');
                      }}
                    />
                  ) : (
                    category.items.map((item: any) => (
                      <RailItem
                        key={item.id}
                        id={item.id}
                        icon={item.icon}
                        label={item.label}
                        isActive={activeViewType === item.payload}
                        onClick={() => {
                          onOpen?.(item.payload);
                          if (item.payload === 'chat') onModeChange?.('chat');
                          else if (item.payload === 'workspace') onModeChange?.('cowork');
                          else if (item.payload === 'code') onModeChange?.('code');
                        }}
                      />
                    ))
                  )}

                  {category.id === 'core' && isBrowser && tabs.length > 0 && (
                    <div style={{ paddingLeft: 8, borderLeft: '1px solid #333', marginTop: 4, marginLeft: 8 }}>
                      {tabs.map(tab => (
                        <RailItem 
                          key={tab.id}
                          icon={Globe}
                          label={tab.title || 'New Tab'}
                          isActive={activeTabId === tab.id}
                          onClick={() => { setActiveTab(tab.id); onOpen?.('browser'); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div style={{ 
        padding: '16px 20px', 
        borderTop: '1px solid #333', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12,
        background: 'rgba(255,255,255,0.02)'
      }}>
        <div style={{ 
          width: 32, 
          height: 32, 
          borderRadius: 10, 
          background: 'linear-gradient(135deg, #D97757 0%, #B08D6E 100%)', 
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 14,
          fontWeight: 'bold'
        }}>U</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#ececec', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>User Name</div>
          <div style={{ color: '#6e6e6e', fontSize: 11, fontWeight: 500 }}>Pro Plan</div>
        </div>
        <Gear size={18} color="#6e6e6e" weight="bold" />
      </div>
    </div>
  );
}

function formatNativeSessionTimestamp(value?: string): string {
  if (!value) {
    return 'Waiting';
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'Waiting';
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return 'Now';
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

const SessionsSection = memo(function SessionsSection({
  projects,
  threads,
  activeProjectId,
  activeThreadId,
  onCreateProject,
  onSetActiveProject,
  onSetActiveThread,
  onOpenChatSurface,
  onOpen,
  onRenameThread,
  onDeleteThread,
  onArchiveThread,
  onMoveThreadToProject,
  onRenameProject,
  onDeleteProject,
  activeViewType,
  nativeSessions,
  activeNativeSessionId,
  embeddedSessionIdBySurface,
  onOpenHistory,
  onOpenArchived,
  onOpenNativeWorkspace,
  onOpenNativeSession,
  onCreateNativeSession,
}: {
  projects: ChatProject[];
  threads: ChatThread[];
  activeProjectId: string | null;
  activeThreadId: string | null;
  onCreateProject: () => void;
  onSetActiveProject: (id: string | null) => void;
  onSetActiveThread: (id: string | null) => void;
  onOpenChatSurface: () => void;
  onOpen?: (view: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
  onArchiveThread: (id: string) => void;
  onMoveThreadToProject: (threadId: string, projectId: string | null) => void;
  onRenameProject: (id: string, title: string) => void;
  onDeleteProject: (id: string) => void;
  activeViewType?: string;
  nativeSessions: NativeSession[];
  activeNativeSessionId: string | null;
  embeddedSessionIdBySurface: Record<AgentSessionSurface, string | null>;
  onOpenHistory?: () => void;
  onOpenArchived?: () => void;
  onOpenNativeWorkspace?: () => void;
  onOpenNativeSession: (session: NativeSession) => void;
  onCreateNativeSession: () => Promise<void>;
}) {
  const seenKeys = new Set<string>();
  const getUniqueKey = (type: string, id: string, index: number) => {
    const baseKey = `${type}-${id}`;
    if (seenKeys.has(baseKey)) {
      return `${baseKey}-${index}`;
    }
    seenKeys.add(baseKey);
    return baseKey;
  };

  const conversationThreads = threads.filter((thread) => !thread.projectId);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 6 }}>
      <ConversationSurfaceHeader
        conversationCount={conversationThreads.length}
        agentSessionCount={nativeSessions.length}
        projectCount={projects.length}
        activeViewType={activeViewType}
        onOpenHistory={onOpenHistory}
        onOpenArchived={onOpenArchived}
      />

      <ProjectsStack
        projects={projects}
        activeProjectId={activeProjectId}
        onCreateProject={onCreateProject}
        onOpenProject={(projectId: string) => {
          onSetActiveProject(projectId);
          onOpenChatSurface();
        }}
        onRenameProject={onRenameProject}
        onDeleteProject={onDeleteProject}
      />

      <WorkstreamSectionLabel
        title="Chats"
        count={conversationThreads.length}
        caption="Regular chat threads"
      />
      {conversationThreads.length > 0 ? (
        conversationThreads.map((thread, idx) => (
          <ThreadRailItem
            key={getUniqueKey('thread', thread.id, idx)}
            id={`thread-${thread.id}`}
            thread={thread}
            icon={thread.mode === 'agent' ? Robot : ChatTeardropText}
            label={thread.title}
            isActive={activeThreadId === thread.id}
            projects={projects}
            metaLabel={thread.mode === 'agent' ? 'Agent chat' : undefined}
            onClick={() => {
              onSetActiveThread(thread.id);
              onOpenChatSurface();
            }}
            onRename={(newTitle: string) => onRenameThread?.(thread.id, newTitle)}
            onDelete={() => onDeleteThread?.(thread.id)}
            onArchive={() => onArchiveThread?.(thread.id)}
            onMoveToProject={(projectId: string) => onMoveThreadToProject?.(thread.id, projectId)}
          />
        ))
      ) : (
        <GhostRailNotice
          icon={ChatTeardropText}
          title="No conversation sessions yet"
          description="Start a chat to create the first regular session."
          actionLabel="Open chat"
          onClick={() => onOpen?.('chat')}
        />
      )}

      <SectionDivider />

      <WorkstreamSectionLabel
        title="Agent Sessions"
        count={nativeSessions.length}
        caption="Persistent operator workspaces"
        actionLabel="New"
        onAction={() => {
          void onCreateNativeSession();
        }}
      />
      {nativeSessions.length > 0 ? (
        nativeSessions.map((session, idx) => (
          <NativeSessionRailItem
            key={getUniqueKey('native', session.id, idx)}
            session={session}
            isActive={
              (activeViewType === 'native-agent' && activeNativeSessionId === session.id) ||
              (activeViewType === 'chat' &&
                embeddedSessionIdBySurface.chat === session.id) ||
              (activeViewType === 'code' &&
                embeddedSessionIdBySurface.code === session.id)
            }
            onClick={() => onOpenNativeSession(session)}
          />
        ))
      ) : (
        <GhostRailNotice
          icon={Cpu}
          title="No agent sessions yet"
          description="Open the agent-session workspace or create a durable operator session with its own brief and canvas state."
          actionLabel="Open agent sessions"
          onClick={() => {
            onOpenNativeWorkspace?.();
          }}
        />
      )}
    </div>
  );
});

function SectionDivider() {
  return (
    <div
      style={{
        height: 1,
        background:
          'linear-gradient(90deg, transparent, rgba(212,176,140,0.18), transparent)',
        margin: '4px 8px',
      }}
    />
  );
}

function ConversationSurfaceHeader({
  conversationCount,
  agentSessionCount,
  projectCount,
  activeViewType,
  onOpenHistory,
  onOpenArchived,
}: {
  conversationCount: number;
  agentSessionCount: number;
  projectCount: number;
  activeViewType?: string;
  onOpenHistory?: () => void;
  onOpenArchived?: () => void;
}) {
  const pills = [
    `Chats ${conversationCount}`,
    `Agent Sessions ${agentSessionCount}`,
    `Projects ${projectCount}`,
  ];

  return (
    <div
      style={{
        padding: '2px 8px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', minWidth: 0, flex: 1, alignItems: 'center', gap: 8, color: '#f0c8aa' }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              border: '1px solid rgba(212,176,140,0.16)',
              background: 'rgba(217,119,87,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkle size={13} weight="fill" />
          </div>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#d4b08c' }}>
              Unified Sessions
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {pills.map((label) => (
                <CompactMetaPill key={label} label={label} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconWidgetButton
            icon={ClockCounterClockwise}
            label="Recent"
            isActive={activeViewType === 'history'}
            onClick={onOpenHistory}
          />
          <IconWidgetButton
            icon={Archive}
            label="Archived"
            isActive={activeViewType === 'archived'}
            onClick={onOpenArchived}
          />
        </div>
      </div>
    </div>
  );
}

function CompactMetaPill({ label }: { label: string }) {
  return (
    <span
      style={{
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.03)',
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: 600,
        color: '#b8b0aa',
      }}
    >
      {label}
    </span>
  );
}

function IconWidgetButton({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ComponentType<any>;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9,
        border: '1px solid',
        borderColor: isActive ? 'rgba(212,176,140,0.22)' : 'rgba(255,255,255,0.06)',
        background: isActive ? 'rgba(217,119,87,0.12)' : 'rgba(255,255,255,0.03)',
        color: isActive ? '#f0c8aa' : '#b08d6e',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <Icon size={15} weight={isActive ? 'fill' : 'bold'} />
    </button>
  );
}

function ProjectsStack({
  projects,
  activeProjectId,
  onCreateProject,
  onOpenProject,
  onRenameProject,
  onDeleteProject,
}: {
  projects: ChatProject[];
  activeProjectId: string | null;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
  onRenameProject: (id: string, title: string) => void;
  onDeleteProject: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <WorkstreamSectionLabel
        title="Projects"
        count={projects.length}
        caption="Shared organizer"
      />
      <div style={{ padding: '0 8px' }}>
        <button
          type="button"
          onClick={onCreateProject}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            borderRadius: 12,
            border: '1px solid rgba(212,176,140,0.16)',
            background: 'rgba(255,255,255,0.03)',
            color: '#ececec',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              color: '#d4b08c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FolderPlus size={12} weight="bold" />
          </div>
          <div style={{ minWidth: 0, fontSize: 12, fontWeight: 700 }}>New Project</div>
        </button>
      </div>

      {projects.map((proj, idx) => (
        <ProjectRailItem
          key={`project-${proj.id}-${idx}`}
          id={`project-${proj.id}`}
          project={proj}
          icon={FolderOpen}
          label={proj.title}
          isActive={activeProjectId === proj.id}
          onClick={() => onOpenProject(proj.id)}
          onRename={(newTitle: string) => onRenameProject(proj.id, newTitle)}
          onDelete={() => onDeleteProject(proj.id)}
        />
      ))}
    </div>
  );
}

function WorkstreamSectionLabel({
  title,
  count,
  caption,
  actionLabel,
  onAction,
}: {
  title: string;
  count?: number;
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '0 8px',
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 1,
              borderRadius: 999,
              background: 'linear-gradient(90deg, rgba(217,119,87,0.9), rgba(176,141,110,0.2))',
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#b08d6e',
            }}
          >
            {title}
          </span>
          {count !== undefined ? (
            <span
              style={{
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                padding: '2px 6px',
                fontSize: 9,
                color: '#9b9b9b',
              }}
            >
              {count}
            </span>
          ) : null}
        </div>
        {caption ? (
          <div style={{ fontSize: 11, color: '#6e6e6e' }}>{caption}</div>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#d4b08c',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function GhostRailNotice({
  icon: Icon,
  title,
  description,
  actionLabel,
  onClick,
}: {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  actionLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        border: '1px dashed rgba(212,176,140,0.16)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))',
        borderRadius: 14,
        padding: '9px 10px',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          border: '1px solid rgba(212,176,140,0.14)',
          background: 'rgba(217,119,87,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
            color: '#d97757',
            flexShrink: 0,
          }}
        >
          <Icon size={14} weight="bold" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#ececec' }}>{title}</div>
          <div style={{ marginTop: 1, fontSize: 10.5, color: '#8a8a8a', lineHeight: 1.35 }}>
            {description}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          fontWeight: 700,
          color: '#d4b08c',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {actionLabel}
      </div>
    </button>
  );
}

function NativeSessionRailItem({
  session,
  isActive,
  onClick,
}: {
  session: NativeSession;
  isActive: boolean;
  onClick: () => void;
}) {
  const metaLabel = formatAgentSessionMetaLabel(session.metadata);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 14,
        border: '1px solid',
        borderColor: isActive ? 'rgba(212,176,140,0.24)' : 'rgba(212,176,140,0.08)',
        background: isActive
          ? 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, rgba(255,255,255,0.05) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02))',
        color: '#ececec',
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: isActive ? '0 10px 24px rgba(24,18,16,0.18)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          background: isActive ? 'rgba(217,119,87,0.2)' : 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isActive ? '#f0c8aa' : '#b08d6e',
          flexShrink: 0,
        }}
      >
        <Cpu size={16} weight={isActive ? 'fill' : 'bold'} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {session.name || 'Untitled Session'}
          </span>
          <span
            style={{
              flexShrink: 0,
              borderRadius: 999,
              background: session.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
              color: session.isActive ? '#7ee787' : '#8a8a8a',
              padding: '2px 6px',
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {session.isActive ? 'Live' : 'Paused'}
          </span>
        </div>
        <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#6e6e6e', flexWrap: 'wrap' }}>
          {metaLabel ? (
            <>
              <span
                style={{
                  flexShrink: 0,
                  borderRadius: 999,
                  border: '1px solid rgba(212,176,140,0.14)',
                  background: 'rgba(217,119,87,0.08)',
                  color: '#d4b08c',
                  padding: '2px 6px',
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {metaLabel}
              </span>
              <span>•</span>
            </>
          ) : null}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 116,
            }}
          >
            {session.description || 'Brief + canvas state'}
          </span>
          <span>•</span>
          <span>{session.messageCount} msg</span>
          <span>•</span>
          <span>{formatNativeSessionTimestamp(session.lastAccessedAt || session.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}

function RailItem({ id, icon: Icon, label, isActive, onClick }: any) {
  return (
    <button
      onClick={onClick}
      data-rail-item={id}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 14,
        border: '1px solid',
        borderColor: isActive ? 'rgba(212,176,140,0.22)' : 'rgba(255,255,255,0.04)',
        background: isActive
          ? 'linear-gradient(135deg, rgba(217, 119, 87, 0.16), rgba(255,255,255,0.04))'
          : 'rgba(255,255,255,0.015)',
        color: isActive ? '#f0c8aa' : '#b8b0aa',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s',
        fontWeight: isActive ? 700 : 500,
        boxShadow: isActive ? '0 8px 18px rgba(24,18,16,0.14)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} />}
      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{label}</span>
    </button>
  );
}

// Project item with ellipsis menu for actions
function ProjectRailItem({ 
  id, 
  project,
  icon: Icon, 
  label, 
  isActive, 
  onClick,
  onRename,
  onDelete,
}: any) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(label);

  const handleRename = () => {
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveRename = () => {
    if (editTitle.trim() && editTitle !== label) {
      onRename?.(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditTitle(label);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 10,
          background: isActive ? 'rgba(217, 119, 87, 0.1)' : 'transparent',
        }}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} color={isActive ? '#D97757' : '#9b9b9b'} />}
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveRename}
          autoFocus
          style={{
            flex: 1,
            fontSize: 13,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: isActive ? '#D97757' : '#9b9b9b',
            fontWeight: isActive ? 700 : 500,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px',
        borderRadius: 16,
        border: '1px solid',
        borderColor: isActive ? 'rgba(212,176,140,0.22)' : 'rgba(255,255,255,0.04)',
        background: isActive
          ? 'linear-gradient(135deg, rgba(217, 119, 87, 0.16), rgba(255,255,255,0.04))'
          : 'rgba(255,255,255,0.015)',
        position: 'relative',
        boxShadow: isActive ? '0 8px 18px rgba(24,18,16,0.14)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <button
        onClick={onClick}
        data-rail-item={id}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 8px',
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: isActive ? '#f0c8aa' : '#b8b0aa',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s',
          fontWeight: isActive ? 700 : 500,
        }}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} />}
        <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{label}</span>
      </button>

      {/* Ellipsis Menu Button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: 'none',
            background: showMenu ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: '#8f8a86',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.6,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
        >
          <DotsThree size={18} weight="bold" />
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
              }}
              onClick={() => setShowMenu(false)}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                minWidth: 160,
                background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
                borderRadius: 14,
                border: '1px solid rgba(212,176,140,0.14)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                zIndex: 9999,
                overflow: 'hidden',
              }}
            >
              {/* Rename Option */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRename();
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: '#9b9b9b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Pencil size={16} />
                Rename
              </button>

              <div style={{ height: 1, background: '#333', margin: '4px 0' }} />

              {/* Delete Option */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                  setShowMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Trash size={16} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Thread item with ellipsis menu for actions
function ThreadRailItem({ 
  id, 
  thread,
  icon: Icon, 
  label, 
  isActive, 
  projects,
  metaLabel,
  onClick,
  onRename,
  onDelete,
  onArchive,
  onMoveToProject,
}: any) {
  const [showMenu, setShowMenu] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(label);

  const handleRename = () => {
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveRename = () => {
    if (editTitle.trim() && editTitle !== label) {
      onRename?.(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditTitle(label);
      setIsEditing(false);
    }
  };

  const handleMoveToProject = (projectId: string) => {
    onMoveToProject?.(projectId);
    setShowProjects(false);
    setShowMenu(false);
  };

  if (isEditing) {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 10,
          background: isActive ? 'rgba(217, 119, 87, 0.1)' : 'transparent',
        }}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} color={isActive ? '#D97757' : '#9b9b9b'} />}
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveRename}
          autoFocus
          style={{
            flex: 1,
            fontSize: 13,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: isActive ? '#D97757' : '#9b9b9b',
            fontWeight: isActive ? 700 : 500,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px',
        borderRadius: 16,
        border: '1px solid',
        borderColor: isActive ? 'rgba(212,176,140,0.22)' : 'rgba(255,255,255,0.04)',
        background: isActive
          ? 'linear-gradient(135deg, rgba(217, 119, 87, 0.16), rgba(255,255,255,0.04))'
          : 'rgba(255,255,255,0.015)',
        position: 'relative',
        boxShadow: isActive ? '0 8px 18px rgba(24,18,16,0.14)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <button
        onClick={onClick}
        data-rail-item={id}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 8px',
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: isActive ? '#f0c8aa' : '#b8b0aa',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s',
          fontWeight: isActive ? 700 : 500,
        }}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} />}
        <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{label}</span>
        {metaLabel ? (
          <span
            style={{
              flexShrink: 0,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              padding: '2px 6px',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#d4b08c',
            }}
          >
            {metaLabel}
          </span>
        ) : null}
      </button>

      {/* Ellipsis Menu Button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
            setShowProjects(false);
          }}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: 'none',
            background: showMenu ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: '#8f8a86',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.6,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
        >
          <DotsThree size={18} weight="bold" />
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
              }}
              onClick={() => setShowMenu(false)}
            />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                minWidth: 180,
                background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
                borderRadius: 14,
                border: '1px solid rgba(212,176,140,0.14)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                zIndex: 9999,
                overflow: 'hidden',
              }}
            >
              {/* Rename Option */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRename();
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: '#9b9b9b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Pencil size={16} />
                Rename
              </button>

              {/* Move to Project Submenu */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProjects(!showProjects);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'transparent',
                    color: '#9b9b9b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    textAlign: 'left',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Folder size={16} />
                  Move to Project
                </button>

                {/* Projects Submenu */}
                {showProjects && projects?.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '100%',
                      top: 0,
                      marginLeft: 4,
                      minWidth: 160,
                      background: 'linear-gradient(180deg, rgba(37,33,31,0.98), rgba(26,23,22,0.98))',
                      borderRadius: 14,
                      border: '1px solid rgba(212,176,140,0.14)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                      zIndex: 10000,
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveToProject('');
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        color: '#9b9b9b',
                        cursor: 'pointer',
                        fontSize: 12,
                        textAlign: 'left',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      (No Project)
                    </button>
                    {projects.map((proj: any) => (
                      <button
                        key={proj.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveToProject(proj.id);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background: 'transparent',
                          color: '#9b9b9b',
                          cursor: 'pointer',
                          fontSize: 12,
                          textAlign: 'left',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {proj.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: '#333', margin: '4px 0' }} />

              {/* Archive Option */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive?.();
                  setShowMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: '#9b9b9b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Archive size={16} />
                Archive
              </button>

              {/* Delete Option */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                  setShowMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Trash size={16} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
