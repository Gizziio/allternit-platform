import React, { useState, useCallback, memo, useEffect, useMemo } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { DeleteConfirmModal } from './DeleteConfirmModal';
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
  CheckSquare,
} from '@phosphor-icons/react';
import { useChatStore, ChatThread, ChatProject } from '../views/chat/ChatStore';
import { useArtifactStore } from '../views/cowork/ArtifactStore';
import { useCoworkStore, Task, TaskProject } from '../views/cowork/CoworkStore';
import { useCodeModeStore } from '../views/code/CodeModeStore';
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
import { SettingsDrilldown } from './SettingsDrilldown';
import { getAgentModeSurfaceTheme } from '../views/chat/agentModeSurfaceTheme';
import type { AgentModeSurface } from '../stores/agent-surface-mode.store';

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
  // Determine current surface for agent mode glow
  const currentSurface: AgentModeSurface = 
    mode === 'cowork' ? 'cowork' : 
    mode === 'code' ? 'code' : 'chat';
  
  const enabledBySurface = useAgentSurfaceModeStore((s) => s.enabledBySurface);
  const isAgentActive = enabledBySurface[currentSurface];
  const surfaceTheme = isAgentActive ? getAgentModeSurfaceTheme(currentSurface) : null;
  const [foldedCategories, setFoldedCategories] = useState<Set<string>>(new Set(['workspace', 'ai_vision', 'infrastructure', 'security', 'execution', 'observability', 'services']));
  const [isLoading, setIsLoading] = useState(false);

  // Use useStoreWithEqualityFn with shallow for array/object selectors to avoid infinite loops in Zustand v4
  const threads = useStoreWithEqualityFn(useChatStore, (s) => s.threads, shallow);
  const projects = useStoreWithEqualityFn(useChatStore, (s) => s.projects, shallow);
  const activeThreadId = useStoreWithEqualityFn(useChatStore, (s) => s.activeThreadId);
  const activeProjectId = useStoreWithEqualityFn(useChatStore, (s) => s.activeProjectId);
  const setActiveThread = useStoreWithEqualityFn(useChatStore, (s) => s.setActiveThread);
  const setActiveProject = useStoreWithEqualityFn(useChatStore, (s) => s.setActiveProject);
  const createProject = useStoreWithEqualityFn(useChatStore, (s) => s.createProject);
  const renameThread = useStoreWithEqualityFn(useChatStore, (s) => s.renameThread);
  const deleteThread = useStoreWithEqualityFn(useChatStore, (s) => s.deleteThread);
  const moveThreadToProject = useStoreWithEqualityFn(useChatStore, (s) => s.moveThreadToProject);
  const renameProject = useStoreWithEqualityFn(useChatStore, (s) => s.renameProject);
  const deleteProject = useStoreWithEqualityFn(useChatStore, (s) => s.deleteProject);
  
  const nativeSessions = useStoreWithEqualityFn(useNativeAgentStore, (s) => s.sessions, shallow);
  const activeNativeSessionId = useStoreWithEqualityFn(useNativeAgentStore, (s) => s.activeSessionId);
  const fetchNativeSessions = useStoreWithEqualityFn(useNativeAgentStore, (s) => s.fetchSessions);
  const createNativeSession = useStoreWithEqualityFn(useNativeAgentStore, (s) => s.createSession);
  const setActiveNativeSession = useStoreWithEqualityFn(useNativeAgentStore, (s) => s.setActiveSession);
  
  const embeddedSessionIdBySurface = useStoreWithEqualityFn(useEmbeddedAgentSessionStore, (s) => s.sessionIdBySurface, shallow);
  const setEmbeddedSession = useStoreWithEqualityFn(useEmbeddedAgentSessionStore, (s) => s.setSurfaceSession);
  const clearEmbeddedSession = useStoreWithEqualityFn(useEmbeddedAgentSessionStore, (s) => s.clearSurfaceSession);
  
  const setAgentModeEnabled = useStoreWithEqualityFn(useAgentSurfaceModeStore, (s) => s.setEnabled);
  const setSelectedSurfaceAgent = useStoreWithEqualityFn(useAgentSurfaceModeStore, (s) => s.setSelectedAgent);
  const selectedAgentIdBySurface = useStoreWithEqualityFn(useAgentSurfaceModeStore, (s) => s.selectedAgentIdBySurface, shallow);
  
  const agents = useStoreWithEqualityFn(useAgentStore, (s) => s.agents, shallow);
  const activeArtifactId = useStoreWithEqualityFn(useArtifactStore, (s) => s.activeArtifactId);
  const setActiveArtifact = useStoreWithEqualityFn(useArtifactStore, (s) => s.setActiveArtifact);
  const tabs = useStoreWithEqualityFn(useBrowserStore, (s) => s.tabs, shallow);
  const activeTabId = useStoreWithEqualityFn(useBrowserStore, (s) => s.activeTabId);
  const setActiveTab = useStoreWithEqualityFn(useBrowserStore, (s) => s.setActiveTab);
  const setSidecarOpen = useStoreWithEqualityFn(useSidecarStore, (s) => s.setOpen);
  
  // Cowork store for tasks
  const coworkStore = useCoworkStore();
  
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

  const openCoworkSurface = useCallback(() => {
    clearEmbeddedSession('cowork');
    if (onModeChange) {
      onModeChange('cowork');
      return;
    }
    onOpen?.('workspace');
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
      background: isAgentActive 
        ? `linear-gradient(180deg, ${surfaceTheme?.wash} 0%, ${surfaceTheme?.soft} 40%, transparent 100%)`
        : 'transparent',
      borderRadius: 0, 
      border: 'none',
      boxShadow: 'none',
      position: 'relative', 
      overflow: 'hidden',
      outline: 'none',
    }}>
      {/* SPACER FOR FIXED CONTROLS */}
      <div style={{ height: 104 }} />

      {/* SEARCH BAR */}
      <div style={{ padding: '0 16px 12px 16px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          background: 'rgba(255,255,255,0.03)', 
          borderRadius: 14, 
          padding: '9px 12px', 
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'none'
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
        {activeConfig.map((category, index) => {
          const isFolded = foldedCategories.has(category.id);
          const isCollapsible = category.collapsible !== false;
          
          // Add separator before 'threads' section in code mode
          const showSeparator = isCodeMode && category.id === 'threads';

          return (
            <div key={category.id} style={{ marginBottom: 4 }}>
              {showSeparator && (
                <div style={{ 
                  padding: '8px 12px', 
                  color: '#b08d6e', 
                  fontSize: 11, 
                  fontWeight: 800,
                  letterSpacing: '0.08em'
                }}>
                  &gt;
                </div>
              )}
              {isCollapsible ? (
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
                              workspaceScope: getOpenClawWorkspacePathFromAgent(selectedAgent) ?? undefined,
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
                  ) : category.id === 'tasks' ? (
                    <TasksSection
                      projects={coworkStore.projects}
                      tasks={coworkStore.tasks}
                      activeProjectId={coworkStore.activeProjectId}
                      activeTaskId={coworkStore.activeTaskId}
                      onCreateProject={() => coworkStore.createProject('New Project')}
                      onSetActiveProject={coworkStore.setActiveProject}
                      onSetActiveTask={coworkStore.setActiveTask}
                      onOpenCoworkSurface={openCoworkSurface}
                      onOpen={onOpen}
                      onRenameTask={coworkStore.renameTask}
                      onDeleteTask={coworkStore.deleteTask}
                      onMoveTaskToProject={coworkStore.moveTaskToProject}
                      onRenameProject={coworkStore.renameProject}
                      onDeleteProject={coworkStore.deleteProject}
                      activeViewType={activeViewType}
                    />
                  ) : category.id === 'threads' && isCodeMode ? (
                    <CodeThreadsSection
                      onOpen={onOpen}
                      activeViewType={activeViewType}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onOpen?.('products')}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#d4b08c';
              e.currentTarget.style.background = 'rgba(212,176,140,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#6e6e6e';
              e.currentTarget.style.background = 'transparent';
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#6e6e6e',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title="A2R Products"
          >
            <Sparkle size={18} weight="bold" />
          </button>
          <SettingsDrilldown>
            <button
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#d4b08c';
                e.currentTarget.style.background = 'rgba(212,176,140,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#6e6e6e';
                e.currentTarget.style.background = 'transparent';
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: '#6e6e6e',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              title="Settings"
            >
              <Gear size={18} weight="bold" />
            </button>
          </SettingsDrilldown>
        </div>
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
  const [activeTab, setActiveTab] = useState<'chats' | 'agents'>('chats');
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 6 }}>
      {/* Tabs for Chats / Agent Sessions */}
      <div style={{ 
        display: 'flex', 
        gap: 6, 
        padding: '3px 8px',
      }}>
        <button
          onClick={() => setActiveTab('chats')}
          onMouseEnter={(e) => {
            if (activeTab !== 'chats') {
              e.currentTarget.style.color = '#d4b08c';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'chats') {
              e.currentTarget.style.color = '#888';
            }
          }}
          style={{
            flex: 1,
            padding: '4px 6px',
            borderRadius: '5px',
            border: 'none',
            background: activeTab === 'chats' 
              ? 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, rgba(212,176,140,0.12) 100%)' 
              : 'transparent',
            color: activeTab === 'chats' ? '#f0c8aa' : '#888',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'chats' ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
          }}
        >
          Chats
          <span style={{ 
            padding: '0px 3px', 
            background: activeTab === 'chats' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', 
            borderRadius: '2px',
            fontSize: '9px',
          }}>
            {conversationThreads.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          onMouseEnter={(e) => {
            if (activeTab !== 'agents') {
              e.currentTarget.style.color = '#d4b08c';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'agents') {
              e.currentTarget.style.color = '#888';
            }
          }}
          style={{
            flex: 1,
            padding: '4px 6px',
            borderRadius: '5px',
            border: 'none',
            background: activeTab === 'agents' 
              ? 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, rgba(212,176,140,0.12) 100%)' 
              : 'transparent',
            color: activeTab === 'agents' ? '#f0c8aa' : '#888',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'agents' ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
          }}
        >
          Agent Sessions
          <span style={{ 
            padding: '0px 3px', 
            background: activeTab === 'agents' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', 
            borderRadius: '2px',
            fontSize: '9px',
          }}>
            {nativeSessions.length}
          </span>
        </button>
      </div>

      {/* Projects - Right under tabs */}
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

      {/* Chats Tab */}
      {activeTab === 'chats' && (
        <div style={{ padding: '0 8px' }}>
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
        </div>
      )}

      {/* Agent Sessions Tab */}
      {activeTab === 'agents' && (
        <div style={{ padding: '0 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>
              Workspaces
            </span>
            <button 
              onClick={() => onCreateNativeSession()}
              style={{
                padding: '4px 8px',
                background: 'rgba(212,176,140,0.1)',
                border: 'none',
                borderRadius: '4px',
                color: '#d4b08c',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              + New
            </button>
          </div>
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
      )}
    </div>
  );
});

// ============================================================================
// Tasks Section (for Cowork mode) - Mirrors SessionsSection structure
// ============================================================================

const TasksSection = memo(function TasksSection({
  projects,
  tasks,
  activeProjectId,
  activeTaskId,
  onCreateProject,
  onSetActiveProject,
  onSetActiveTask,
  onOpenCoworkSurface,
  onOpen,
  onRenameTask,
  onDeleteTask,
  onMoveTaskToProject,
  onRenameProject,
  onDeleteProject,
  activeViewType,
}: {
  projects: TaskProject[];
  tasks: Task[];
  activeProjectId: string | null;
  activeTaskId: string | null;
  onCreateProject: () => void;
  onSetActiveProject: (id: string | null) => void;
  onSetActiveTask: (id: string | null) => void;
  onOpenCoworkSurface: () => void;
  onOpen?: (view: string) => void;
  onRenameTask: (id: string, title: string) => void;
  onDeleteTask: (id: string) => void;
  onMoveTaskToProject: (taskId: string, projectId: string | null) => void;
  onRenameProject: (id: string, title: string) => void;
  onDeleteProject: (id: string) => void;
  activeViewType?: string;
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

  const regularTasks = tasks.filter((task) => !task.projectId && task.mode === 'task');
  const agentTasks = tasks.filter((task) => !task.projectId && task.mode === 'agent');
  const [activeTab, setActiveTab] = useState<'tasks' | 'agent-tasks'>('tasks');
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 6 }}>
      {/* Tabs for Tasks / Agent Tasks */}
      <div style={{ 
        display: 'flex', 
        gap: 6, 
        padding: '3px 8px',
      }}>
        <button
          onClick={() => setActiveTab('tasks')}
          onMouseEnter={(e) => {
            if (activeTab !== 'tasks') {
              e.currentTarget.style.color = '#d4b08c';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'tasks') {
              e.currentTarget.style.color = '#888';
            }
          }}
          style={{
            flex: 1,
            padding: '4px 6px',
            borderRadius: '5px',
            border: 'none',
            background: activeTab === 'tasks' 
              ? 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, rgba(212,176,140,0.12) 100%)' 
              : 'transparent',
            color: activeTab === 'tasks' ? '#f0c8aa' : '#888',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'tasks' ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
          }}
        >
          Tasks
          <span style={{ 
            padding: '0px 3px', 
            background: activeTab === 'tasks' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', 
            borderRadius: '2px',
            fontSize: '9px',
          }}>
            {regularTasks.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('agent-tasks')}
          onMouseEnter={(e) => {
            if (activeTab !== 'agent-tasks') {
              e.currentTarget.style.color = '#d4b08c';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'agent-tasks') {
              e.currentTarget.style.color = '#888';
            }
          }}
          style={{
            flex: 1,
            padding: '4px 6px',
            borderRadius: '5px',
            border: 'none',
            background: activeTab === 'agent-tasks' 
              ? 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, rgba(212,176,140,0.12) 100%)' 
              : 'transparent',
            color: activeTab === 'agent-tasks' ? '#f0c8aa' : '#888',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'agent-tasks' ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
          }}
        >
          Agent Tasks
          <span style={{ 
            padding: '0px 3px', 
            background: activeTab === 'agent-tasks' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', 
            borderRadius: '2px',
            fontSize: '9px',
          }}>
            {agentTasks.length}
          </span>
        </button>
      </div>

      {/* Projects - Right under tabs */}
      <TaskProjectsStack
        projects={projects}
        activeProjectId={activeProjectId}
        onCreateProject={onCreateProject}
        onOpenProject={(projectId: string) => {
          onSetActiveProject(projectId);
          onOpenCoworkSurface();
        }}
        onRenameProject={onRenameProject}
        onDeleteProject={onDeleteProject}
      />

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div style={{ padding: '0 8px' }}>
          {regularTasks.length > 0 ? (
            regularTasks.map((task, idx) => (
              <TaskRailItem
                key={getUniqueKey('task', task.id, idx)}
                id={`task-${task.id}`}
                task={task}
                icon={CheckSquare}
                label={task.title}
                isActive={activeTaskId === task.id}
                projects={projects}
                metaLabel={task.status}
                onClick={() => {
                  onSetActiveTask(task.id);
                  onOpenCoworkSurface();
                }}
                onRename={(newTitle: string) => onRenameTask?.(task.id, newTitle)}
                onDelete={() => onDeleteTask?.(task.id)}
                onMoveToProject={(projectId: string) => onMoveTaskToProject?.(task.id, projectId)}
              />
            ))
          ) : (
            <GhostRailNotice
              icon={CheckSquare}
              title="No tasks yet"
              description="Create a task to get started with your work."
              actionLabel="New Task"
              onClick={() => onOpen?.('cowork-new-task')}
            />
          )}
        </div>
      )}

      {/* Agent Tasks Tab */}
      {activeTab === 'agent-tasks' && (
        <div style={{ padding: '0 8px' }}>
          {agentTasks.length > 0 ? (
            agentTasks.map((task, idx) => (
              <TaskRailItem
                key={getUniqueKey('agent-task', task.id, idx)}
                id={`agent-task-${task.id}`}
                task={task}
                icon={Robot}
                label={task.title}
                isActive={activeTaskId === task.id}
                projects={projects}
                metaLabel="Agent task"
                onClick={() => {
                  onSetActiveTask(task.id);
                  onOpenCoworkSurface();
                }}
                onRename={(newTitle: string) => onRenameTask?.(task.id, newTitle)}
                onDelete={() => onDeleteTask?.(task.id)}
                onMoveToProject={(projectId: string) => onMoveTaskToProject?.(task.id, projectId)}
              />
            ))
          ) : (
            <GhostRailNotice
              icon={Robot}
              title="No agent tasks yet"
              description="Create an agent task to have AI automate your workflow."
              actionLabel="New Agent Task"
              onClick={() => onOpen?.('cowork-new-task')}
            />
          )}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Task Projects Stack (mirrors ProjectsStack for chat)
// ============================================================================

function TaskProjectsStack({
  projects,
  activeProjectId,
  onCreateProject,
  onOpenProject,
  onRenameProject,
  onDeleteProject,
}: {
  projects: TaskProject[];
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
      <div style={{ padding: '4px' }}>
        <button
          type="button"
          onClick={onCreateProject}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f0c8aa';
            e.currentTarget.style.background = 'rgba(212,176,140,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#ececec';
            e.currentTarget.style.background = 'transparent';
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 14,
            border: 'none',
            background: 'transparent',
            color: '#ececec',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s',
            fontWeight: 500,
          }}
        >
          <FolderPlus size={18} weight="bold" color="#d4b08c" />
          <div style={{ minWidth: 0, fontSize: 13, fontWeight: 700 }}>New Project</div>
        </button>
      </div>

      {projects.map((proj, idx) => (
        <TaskProjectRailItem
          key={`task-project-${proj.id}-${idx}`}
          id={`task-project-${proj.id}`}
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

// ============================================================================
// Task Project Rail Item
// ============================================================================

function TaskProjectRailItem({
  id,
  project,
  icon: Icon,
  label,
  isActive,
  onClick,
  onRename,
  onDelete,
}: {
  id: string;
  project: TaskProject;
  icon: any;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const confirmDelete = () => {
    onDelete?.();
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
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
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isActive ? 'rgba(217, 119, 87, 0.15)' : 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? 'rgba(217, 119, 87, 0.1)' : 'transparent';
        setShowMenu(false);
      }}
      data-rail-item={id}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        borderRadius: 10,
        background: isActive ? 'rgba(217, 119, 87, 0.1)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.2s',
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

              <button
                onClick={handleDeleteClick}
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          title="Delete Project?"
          itemName={label}
          itemType="project"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
}

// ============================================================================
// Task Rail Item
// ============================================================================

function TaskRailItem({
  id,
  task,
  icon: Icon,
  label,
  isActive,
  projects,
  metaLabel,
  onClick,
  onRename,
  onDelete,
  onMoveToProject,
}: {
  id: string;
  task: Task;
  icon: any;
  label: string;
  isActive: boolean;
  projects: TaskProject[];
  metaLabel?: string;
  onClick: () => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
  onMoveToProject?: (projectId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const confirmDelete = () => {
    onDelete?.();
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
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
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isActive ? 'rgba(217, 119, 87, 0.15)' : 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? 'rgba(217, 119, 87, 0.1)' : 'transparent';
        setShowMenu(false);
      }}
      data-rail-item={id}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        borderRadius: 10,
        background: isActive ? 'rgba(217, 119, 87, 0.1)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.2s',
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
        {metaLabel && (
          <span style={{ fontSize: 10, color: '#6e6e6e', textTransform: 'capitalize' }}>
            {metaLabel}
          </span>
        )}
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

              {/* Move to Project Option */}
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
                  <FolderOpen size={16} />
                  Move to Project
                </button>

                {/* Projects Submenu */}
                {showProjects && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '100%',
                      marginLeft: 4,
                      minWidth: 140,
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
                    {projects.map((proj) => (
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

              {/* Delete Option */}
              <button
                onClick={handleDeleteClick}
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          title="Delete Task?"
          itemName={label}
          itemType="task"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
}

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
      <div style={{ padding: '4px' }}>
        <button
          type="button"
          onClick={onCreateProject}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f0c8aa';
            e.currentTarget.style.background = 'rgba(212,176,140,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#ececec';
            e.currentTarget.style.background = 'transparent';
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 12px',
            borderRadius: 14,
            border: 'none',
            background: 'transparent',
            color: '#ececec',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s',
            fontWeight: 500,
          }}
        >
          <FolderPlus size={18} weight="bold" color="#d4b08c" />
          <div style={{ minWidth: 0, fontSize: 13, fontWeight: 700 }}>New Project</div>
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
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = 'rgba(212,176,140,0.12)';
          e.currentTarget.style.color = '#d4b08c';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.color = '#b8b0aa';
        }
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 14,
        border: '1px solid',
        borderColor: isActive ? 'rgba(212,176,140,0.22)' : 'rgba(255,255,255,0.04)',
        background: isActive
          ? 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, rgba(212,176,140,0.12) 100%)'
          : 'transparent',
        color: isActive ? '#f0c8aa' : '#b8b0aa',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s',
        fontWeight: isActive ? 700 : 500,
        boxShadow: isActive ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
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
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = '#d4b08c';
          e.currentTarget.style.background = 'rgba(212,176,140,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = '#b8b0aa';
          e.currentTarget.style.background = 'transparent';
        }
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 14,
        border: 'none',
        background: isActive
          ? 'linear-gradient(135deg, rgba(217, 119, 87, 0.18) 0%, rgba(212,176,140,0.12) 100%)'
          : 'transparent',
        color: isActive ? '#f0c8aa' : '#b8b0aa',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s',
        fontWeight: isActive ? 700 : 500,
        boxShadow: isActive ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const confirmDelete = () => {
    onDelete?.();
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
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
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(212,176,140,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px',
        borderRadius: 14,
        border: 'none',
        background: isActive
          ? 'linear-gradient(135deg, rgba(217, 119, 87, 0.18) 0%, rgba(212,176,140,0.12) 100%)'
          : 'transparent',
        position: 'relative',
        boxShadow: isActive ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
        transition: 'all 0.2s',
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
                onClick={handleDeleteClick}
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          title="Delete Session?"
          itemName={label}
          itemType="session"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const confirmDelete = () => {
    onDelete?.();
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
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
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(212,176,140,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px',
        borderRadius: 14,
        border: 'none',
        background: isActive
          ? 'linear-gradient(135deg, rgba(217, 119, 87, 0.18) 0%, rgba(212,176,140,0.12) 100%)'
          : 'transparent',
        position: 'relative',
        boxShadow: isActive ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
        transition: 'all 0.2s',
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
          borderRadius: 10,
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

/**
 * CodeThreadsSection - Shows Code Mode threads (sessions) with tabs for Threads and Agent Threads
 */
function CodeThreadsSection({
  onOpen,
  activeViewType,
}: {
  onOpen?: (view: string) => void;
  activeViewType?: string;
}) {
  const [activeTab, setActiveTab] = useState<'threads' | 'agent'>('threads');
  
  // Get code mode store data
  const sessions = useCodeModeStore((state) => state.sessions);
  const activeSessionId = useCodeModeStore((state) => state.activeSessionId);
  const activeWorkspaceId = useCodeModeStore((state) => state.activeWorkspaceId);
  const setActiveSession = useCodeModeStore((state) => state.setActiveSession);
  const workspaces = useCodeModeStore((state) => state.workspaces);
  
  // Get native agent sessions for "Agent Threads" tab
  const nativeSessions = useStoreWithEqualityFn(useNativeAgentStore, (s) => s.sessions, shallow);
  const activeNativeSessionId = useStoreWithEqualityFn(useNativeAgentStore, (s) => s.activeSessionId, shallow);
  const setActiveNativeSession = useStoreWithEqualityFn(useNativeAgentStore, (s) => s.setActiveSession, shallow);
  
  // Filter sessions for active workspace
  const workspaceSessions = useMemo(() => {
    return sessions.filter(s => s.workspace_id === activeWorkspaceId);
  }, [sessions, activeWorkspaceId]);
  
  const activeWorkspace = useMemo(() => {
    return workspaces.find(w => w.workspace_id === activeWorkspaceId);
  }, [workspaces, activeWorkspaceId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 8px' }}>
        <button
          onClick={() => setActiveTab('threads')}
          style={{
            flex: 1,
            padding: '4px 6px',
            borderRadius: '5px',
            border: 'none',
            background: activeTab === 'threads' 
              ? 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, rgba(212,176,140,0.12) 100%)' 
              : 'transparent',
            color: activeTab === 'threads' ? '#f0c8aa' : '#888',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'threads' ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
          }}
        >
          Threads
          <span style={{ 
            padding: '0px 3px', 
            background: activeTab === 'threads' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', 
            borderRadius: '2px',
            fontSize: '9px',
            marginLeft: '4px'
          }}>
            {workspaceSessions.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('agent')}
          style={{
            flex: 1,
            padding: '4px 6px',
            borderRadius: '5px',
            border: 'none',
            background: activeTab === 'agent' 
              ? 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, rgba(212,176,140,0.12) 100%)' 
              : 'transparent',
            color: activeTab === 'agent' ? '#f0c8aa' : '#888',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'agent' ? '0 4px 12px rgba(217,119,87,0.15)' : 'none',
          }}
        >
          Agent Threads
          <span style={{ 
            padding: '0px 3px', 
            background: activeTab === 'agent' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', 
            borderRadius: '2px',
            fontSize: '9px',
            marginLeft: '4px'
          }}>
            {nativeSessions.length}
          </span>
        </button>
      </div>
      
      {/* Projects separator */}
      <div style={{ padding: '0 12px' }}>
        <div style={{ 
          fontSize: 10, 
          fontWeight: 700, 
          color: '#6e6e6e', 
          textTransform: 'uppercase', 
          letterSpacing: '0.05em',
          marginBottom: 4
        }}>
          {activeWorkspace?.display_name || 'Projects'}
        </div>
      </div>
      
      {/* Threads Tab */}
      {activeTab === 'threads' && (
        <div style={{ padding: '0 8px' }}>
          {workspaceSessions.length > 0 ? (
            workspaceSessions.map((session) => (
              <button
                key={session.session_id}
                onClick={() => {
                  setActiveSession(session.session_id);
                  onOpen?.('code');
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid transparent',
                  background: activeSessionId === session.session_id 
                    ? 'rgba(86, 169, 255, 0.12)' 
                    : 'transparent',
                  borderColor: activeSessionId === session.session_id 
                    ? 'var(--accent-chat)' 
                    : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: session.state === 'EXECUTING' ? '#45c56b' : '#8f99ad',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.title}
                </span>
              </button>
            ))
          ) : (
            <div style={{ padding: 16, textAlign: 'center', color: '#6e6e6e', fontSize: 12 }}>
              No threads yet
            </div>
          )}
        </div>
      )}
      
      {/* Agent Threads Tab */}
      {activeTab === 'agent' && (
        <div style={{ padding: '0 8px' }}>
          {nativeSessions.length > 0 ? (
            nativeSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  setActiveNativeSession(session.id);
                  onOpen?.('code-agent-session');
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid transparent',
                  background: activeNativeSessionId === session.id 
                    ? 'rgba(86, 169, 255, 0.12)' 
                    : 'transparent',
                  borderColor: activeNativeSessionId === session.id 
                    ? 'var(--accent-chat)' 
                    : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Robot size={14} style={{ flexShrink: 0, color: '#b08d6e' }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.name || 'Agent Session'}
                </span>
              </button>
            ))
          ) : (
            <div style={{ padding: 16, textAlign: 'center', color: '#6e6e6e', fontSize: 12 }}>
              No agent threads yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
