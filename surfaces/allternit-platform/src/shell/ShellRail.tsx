import React, { useState, useCallback, memo, useEffect, useMemo } from 'react';
import type { Icon } from '@phosphor-icons/react';
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
  Plus,
  GraduationCap,
} from '@phosphor-icons/react';
import { useChatStore, type ChatProject } from '../views/chat/ChatStore';
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
import { ProjectRailSection, type UnifiedProject, type UnifiedItem } from './rail/ProjectRailSection';
import {
  getOpenClawWorkspacePathFromAgent,
  useAgentStore,
} from '../lib/agents';
import { useSurfaceAgentModeEnabled } from '../lib/agents/surface-agent-context';
import { useChatSessionStore, type ChatSession } from '../views/chat/ChatSessionStore';
import { useCodeSessionStore, type CodeSession } from '../views/code/CodeSessionStore';
import { useBrowserSessionStore } from '../views/browser/BrowserSessionStore';
import { useCoworkSessionStore } from '../views/cowork/CoworkSessionStore';
import type { ModeSession } from '../lib/agents/mode-session-store';

type NativeSession = ModeSession;  // For backward compatibility
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
  mode?: 'chat' | 'cowork' | 'code' | 'design';
  isCollapsed?: boolean;
  onToggle?: () => void;
  onModeChange?: (mode: 'chat' | 'cowork' | 'code' | 'design') => void;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
  onOpenControlCenter?: () => void;
  onSidecarToggle?: () => void;
  sidecarOpen?: boolean;
}

const RAIL_CONTROL_WIDTH = 228;

export function ShellRail({
  activeViewType,
  onOpen,
  onNew,
  mode = 'chat',
  isCollapsed,
  onModeChange,
}: ShellRailProps): JSX.Element | null {
  // Determine current surface for agent mode glow
  const currentSurface: AgentModeSurface = 
    mode === 'cowork' ? 'cowork' : 
    mode === 'code' ? 'code' : 'chat';
  
  const isAgentActive = useSurfaceAgentModeEnabled(currentSurface);
  const surfaceTheme = isAgentActive ? getAgentModeSurfaceTheme(currentSurface) : null;
  const [foldedCategories, setFoldedCategories] = useState<Set<string>>(new Set(['workspace', 'ai_vision', 'infrastructure', 'security', 'execution', 'observability', 'services']));
  const [isLoading, setIsLoading] = useState(false);

  // Chat Store
  const chatStore = useChatStore();
  const chatProjects = useStoreWithEqualityFn(useChatStore, (s) => s.projects, shallow);
  
  // Mode-specific session stores
  const chatSessions = useStoreWithEqualityFn(useChatSessionStore, (s) => s.sessions, shallow);
  const codeSessions = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.sessions, shallow);
  const nativeSessions = mode === 'code' ? codeSessions : chatSessions;
  const activeChatSessionId = useStoreWithEqualityFn(useChatSessionStore, (s) => s.activeSessionId);
  const activeCodeSessionId = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.activeSessionId);
  const activeNativeSessionId = mode === 'code' ? activeCodeSessionId : activeChatSessionId;
  const createChatSession = useStoreWithEqualityFn(useChatSessionStore, (s) => s.createSession);
  const createCodeSession = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.createSession);
  const setActiveChatSession = useStoreWithEqualityFn(useChatSessionStore, (s) => s.setActiveSession);
  const setActiveCodeSession = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.setActiveSession);
  const updateChatSession = useStoreWithEqualityFn(useChatSessionStore, (s) => s.updateSession);
  const updateCodeSession = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.updateSession);
  const deleteChatSession = useStoreWithEqualityFn(useChatSessionStore, (s) => s.deleteSession);
  const deleteCodeSession = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.deleteSession);
  const createNativeSession = mode === 'code' ? createCodeSession : createChatSession;
  const setActiveNativeSession = mode === 'code' ? setActiveCodeSession : setActiveChatSession;
  const updateNativeSession = mode === 'code' ? updateCodeSession : updateChatSession;
  const deleteNativeSession = mode === 'code' ? deleteCodeSession : deleteChatSession;
  
  // Cowork Store
  const coworkStore = useCoworkStore();
  
  // Code Mode Store
  const codeStore = useCodeModeStore();

  const activeCoworkSessionId = useStoreWithEqualityFn(useCoworkSessionStore, (s) => s.activeSessionId);
  
  const setSelectedSurfaceAgent = useStoreWithEqualityFn(useAgentSurfaceModeStore, (s) => s.setSelectedAgent);
  const selectedAgentIdBySurface = useStoreWithEqualityFn(useAgentSurfaceModeStore, (s) => s.selectedAgentIdBySurface, shallow);
  
  const agents = useStoreWithEqualityFn(useAgentStore, (s) => s.agents, shallow);
  const tabs = useStoreWithEqualityFn(useBrowserStore, (s) => s.tabs, shallow);
  const activeTabId = useStoreWithEqualityFn(useBrowserStore, (s) => s.activeTabId);
  const setActiveTab = useStoreWithEqualityFn(useBrowserStore, (s) => s.setActiveTab);
  const setSidecarOpen = useStoreWithEqualityFn(useSidecarStore, (s) => s.setOpen);
  
  const isBrowser = activeViewType === 'browser';
  const { enabledPlugins } = useFeaturePlugins();

  // Unified data mapping
  const unifiedData = useMemo(() => {
    if (mode === 'chat') {
      const projects: UnifiedProject[] = chatProjects.map(p => ({
        id: p.id,
        title: p.title,
        itemIds: p.threadIds
      }));
      const chatSessions = nativeSessions.filter(s => {
        const surface = (s.metadata as Record<string, unknown> | undefined)?.surface;
        return !surface || surface === 'chat';
      });
      const items: UnifiedItem[] = chatSessions.map(s => ({
        id: s.id,
        title: s.name || 'Untitled Session',
        icon: (s.metadata as Record<string, unknown> | undefined)?.sessionMode === 'agent' ? Robot : ChatTeardropText,
        projectId: (s.metadata as Record<string, unknown> | undefined)?.projectId as string | undefined,
        isActive: activeNativeSessionId === s.id || activeChatSessionId === s.id,
        metaLabel: formatAgentSessionMetaLabel(s.metadata)
      }));
      return { projects, items };
    } 
    
    if (mode === 'cowork') {
      const projects: UnifiedProject[] = coworkStore.projects.map(p => ({
        id: p.id,
        title: p.title,
        itemIds: coworkStore.tasks.filter(t => t.projectId === p.id).map(t => t.id)
      }));
      const items: UnifiedItem[] = coworkStore.tasks.map(t => ({
        id: t.id,
        title: t.title,
        icon: t.mode === 'agent' ? Robot : CheckSquare,
        projectId: t.projectId,
        isActive: coworkStore.activeTaskId === t.id,
        metaLabel: t.status
      }));
      return { projects, items };
    }

    if (mode === 'code') {
      const projects: UnifiedProject[] = codeStore.workspaces.map(ws => ({
        id: ws.workspace_id,
        title: ws.display_name,
        itemIds: ws.sessions
      }));
      const items: UnifiedItem[] = codeStore.sessions.map(s => ({
        id: s.session_id,
        title: s.title,
        icon: Cpu,
        projectId: s.workspace_id,
        isActive: codeStore.activeSessionId === s.session_id,
        metaLabel: s.state
      }));
      return { projects, items };
    }
    return { projects: [], items: [] };
  }, [mode, chatProjects, nativeSessions, activeNativeSessionId, activeChatSessionId, coworkStore, codeStore]);

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
          const existingIcon = RAIL_CONFIG.flatMap(s => s.items).find(i => i.id === view.viewType)?.icon;
          section.items.push({
            id: view.viewType,
            label: view.label,
            icon: (existingIcon ?? Sparkle) as Icon,
            payload: view.viewType,
          });
        }
      });
    });
  }

  const toggleFold = useCallback((id: string): void => {
    setFoldedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  const openChatSurface = useCallback((): void => {
    useChatSessionStore.getState().setActiveSession(null);
    if (onModeChange) {
      onModeChange('chat');
      return;
    }
    onOpen?.('chat');
  }, [onModeChange, onOpen]);

  const openCoworkSurface = useCallback((): void => {
    useCoworkSessionStore.getState().setActiveSession(null);
    if (onModeChange) {
      onModeChange('cowork');
      return;
    }
    onOpen?.('workspace');
  }, [onModeChange, onOpen]);

  const openNativeSessionSurface = useCallback((session: NativeSession): void => {
    const descriptor = getAgentSessionDescriptor(session.metadata);
    // Default to 'chat' if no originSurface is set - this ensures sessions always navigate
    const originSurface = descriptor.originSurface || 'chat';

    setActiveNativeSession(session.id);

    // Always set as active session in the appropriate mode-specific store
    if (originSurface === 'code') {
      useCodeSessionStore.getState().setActiveSession(session.id);
    } else if (originSurface === 'cowork') {
      useCoworkSessionStore.getState().setActiveSession(session.id);
    } else if (originSurface === 'browser') {
      useBrowserSessionStore.getState().setActiveSession(session.id);
    } else {
      useChatSessionStore.getState().setActiveSession(session.id);
    }
    if (descriptor.agentId) {
      setSelectedSurfaceAgent(originSurface, descriptor.agentId);
    }

    if (originSurface === 'browser') {
      setSidecarOpen(true);
      onOpen?.('browser');
      return;
    }

    // Always notify mode change AND open the view
    if (originSurface === 'code') {
      onModeChange?.('code');
      onOpen?.('code');
    } else if (originSurface === 'cowork') {
      onModeChange?.('cowork');
      onOpen?.('workspace');
    } else {
      // Default to chat for 'chat' surface or any other/unknown surface
      onModeChange?.('chat');
      onOpen?.('chat');
    }
  }, [
    onModeChange,
    onOpen,
    setActiveNativeSession,
    setSelectedSurfaceAgent,
    setSidecarOpen,
  ]);

  const isCodeMode = mode === 'code';

  if (isCollapsed) return null;

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
      <div style={{ padding: '0 8px 8px 8px' }}>
        <div style={{ 
          width: RAIL_CONTROL_WIDTH,
          maxWidth: '100%',
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          background: 'var(--shell-panel-bg)', 
          borderRadius: 14, 
          padding: '9px 12px', 
          border: '1px solid var(--shell-floating-border)',
          boxShadow: 'none'
        }}>
          <MagnifyingGlass size={16} color="var(--accent-primary)" weight="bold" />
          <input 
            placeholder="Search..." 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              outline: 'none', 
              color: 'var(--shell-item-fg)', 
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
                  color: 'var(--accent-secondary)', 
                  fontSize: 11, 
                  fontWeight: 800,
                  letterSpacing: '0.08em'
                }}>
                  &gt; THREADS
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
                    color: 'var(--accent-secondary)',
                    borderRadius: 12,
                    transition: 'background 0.2s, color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--shell-item-hover)';
                    e.currentTarget.style.color = 'var(--accent-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--accent-secondary)';
                  }}
                >
                  {isFolded ? <CaretRight size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />}
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{category.title}</span>
                </button>
              ) : null}

              {!isFolded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                  {category.id === 'sessions' || category.id === 'tasks' || category.id === 'threads' ? (
                    <ProjectRailSection
                      projects={unifiedData.projects}
                      items={unifiedData.items}
                      activeProjectId={
                        mode === 'chat' ? chatStore.activeProjectId : 
                        mode === 'cowork' ? coworkStore.activeProjectId : 
                        codeStore.activeWorkspaceId
                      }
                      onCreateProject={() => {
                        if (mode === 'chat') chatStore.createProject('New Project');
                        else if (mode === 'cowork') coworkStore.createProject('New Project');
                        else if (mode === 'code') {
                          codeStore.createWorkspace('New Workspace');
                          onOpen?.('code-project');
                        }
                      }}
                      onOpenProject={(id) => {
                        if (mode === 'chat') { chatStore.setActiveProject(id); openChatSurface(); }
                        else if (mode === 'cowork') { coworkStore.setActiveProject(id); openCoworkSurface(); }
                        else if (mode === 'code') { codeStore.setActiveWorkspace(id); onOpen?.('code-project'); }
                      }}
                      onRenameProject={(id, title) => {
                        if (mode === 'chat') chatStore.renameProject(id, title);
                        else if (mode === 'cowork') coworkStore.renameProject(id, title);
                        else if (mode === 'code') codeStore.renameWorkspace(id, title);
                      }}
                      onDeleteProject={(id) => {
                        if (mode === 'chat') chatStore.deleteProject(id);
                        else if (mode === 'cowork') coworkStore.deleteProject(id);
                        else if (mode === 'code') codeStore.deleteWorkspace(id);
                      }}
                      onOpenItem={(id) => {
                        if (mode === 'chat') {
                          const session = nativeSessions.find(s => s.id === id);
                          if (session) openNativeSessionSurface(session);
                        } else if (mode === 'cowork') {
                          coworkStore.setActiveTask(id);
                          openCoworkSurface();
                        } else if (mode === 'code') {
                          if (codeStore.sessions.some(s => s.session_id === id)) {
                            codeStore.setActiveSession(id);
                            onOpen?.('code');
                          } else {
                            const session = nativeSessions.find(s => s.id === id);
                            if (session) openNativeSessionSurface(session);
                          }
                        }
                      }}
                      onRenameItem={(id, title) => {
                        if (mode === 'chat' || (mode === 'code' && !codeStore.sessions.some(s => s.session_id === id))) {
                          updateNativeSession(id, { name: title });
                        } else if (mode === 'cowork') {
                          coworkStore.renameTask(id, title);
                        }
                      }}
                      onDeleteItem={(id) => {
                        if (mode === 'chat' || (mode === 'code' && !codeStore.sessions.some(s => s.session_id === id))) {
                          deleteNativeSession(id);
                        } else if (mode === 'cowork') {
                          coworkStore.deleteTask(id);
                        }
                      }}
                      onMoveItemToProject={(itemId, projectId) => {
                        if (mode === 'chat') chatStore.moveThreadToProject(itemId, projectId);
                        else if (mode === 'cowork') coworkStore.moveTaskToProject(itemId, projectId);
                      }}
                      emptyNotice={
                        mode === 'chat' ? {
                          icon: ChatTeardropText,
                          title: "No sessions yet",
                          description: "Start a chat or create an agent session.",
                          actionLabel: "Open chat",
                          onAction: () => onOpen?.('chat')
                        } : mode === 'cowork' ? {
                          icon: CheckSquare,
                          title: "No tasks yet",
                          description: "Create a task to get started.",
                          actionLabel: "New Task",
                          onAction: () => onOpen?.('cowork-new-task')
                        } : {
                          icon: Cpu,
                          title: "No workspace",
                          description: "Create a workspace to start coding.",
                          actionLabel: "New Workspace",
                          onAction: () => {
                            codeStore.createWorkspace('New Workspace');
                            onOpen?.('code-project');
                          }
                        }
                      }
                    />
                  ) : (
                    category.items.map((item: { id: string; icon: Icon; label: string; isAction?: boolean; payload: string }) => (
                      <RailItem
                        key={item.id}
                        id={item.id}
                        icon={item.icon}
                        label={item.label}
                        isActive={!item.isAction && activeViewType === item.payload}
                        onClick={() => {
                          if (item.id === 'new-chat') {
                            chatStore.setActiveThread(null);
                          }
                          onOpen?.(item.payload);
                          if (item.payload === 'chat') onModeChange?.('chat');
                          else if (item.payload === 'workspace') onModeChange?.('cowork');
                          else if (item.payload === 'code') onModeChange?.('code');
                        }}
                      />
                    ))
                  )}

                  {category.id === 'core' && isBrowser && tabs.length > 0 && (
                    <div style={{ paddingLeft: 8, borderLeft: '1px solid var(--border-subtle)', marginTop: 4, marginLeft: 8 }}>
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
        borderTop: '1px solid var(--shell-divider)', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12,
        background: 'var(--shell-panel-bg)'
      }}>
        <div style={{ 
          width: 32, 
          height: 32, 
          borderRadius: 10, 
          background: 'linear-gradient(135deg, var(--accent-chat) 0%, var(--accent-primary) 100%)', 
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bg-primary)',
          fontSize: 14,
          fontWeight: 'bold'
        }}>U</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--shell-item-fg)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>User Name</div>
          <div style={{ color: 'var(--shell-item-muted)', fontSize: 11, fontWeight: 500 }}>Pro Plan</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onOpen?.('labs')}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-primary)';
              e.currentTarget.style.background = 'var(--shell-item-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--shell-item-muted)';
              e.currentTarget.style.background = 'transparent';
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--shell-item-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title="A://Labs - Learning Portal"
          >
            <GraduationCap size={18} weight="bold" />
          </button>
          <button
            onClick={() => onOpen?.('products')}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-primary)';
              e.currentTarget.style.background = 'var(--shell-item-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--shell-item-muted)';
              e.currentTarget.style.background = 'transparent';
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--shell-item-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title="Allternit Products"
          >
            <Sparkle size={18} weight="bold" />
          </button>
          <SettingsDrilldown>
            <button
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-primary)';
                e.currentTarget.style.background = 'var(--shell-item-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--shell-item-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--shell-item-muted)',
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

// ============================================================================
// Tasks Section (for Cowork mode)
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

  const visibleTasks = tasks.filter((task) => !task.projectId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 6 }}>
      {/* Projects */}
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

      {/* All tasks — unified list */}
      <div style={{ padding: '0 8px' }}>
        {visibleTasks.length > 0 ? (
          visibleTasks.map((task, idx) => (
            <TaskRailItem
              key={getUniqueKey('task', task.id, idx)}
              id={`task-${task.id}`}
              task={task}
              icon={task.mode === 'agent' ? Robot : CheckSquare}
              label={task.title}
              isActive={activeTaskId === task.id}
              projects={projects}
              metaLabel={task.mode === 'agent' ? 'Agent task' : task.status}
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
}): JSX.Element {
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
            e.currentTarget.style.color = 'var(--accent-primary)';
            e.currentTarget.style.background = 'var(--shell-item-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--shell-item-fg)';
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
            color: 'var(--shell-item-fg)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s',
            fontWeight: 500,
          }}
        >
          <FolderPlus size={18} weight="bold" color="var(--accent-primary)" />
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
  icon: Icon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
}): JSX.Element {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editTitle, setEditTitle] = useState(label);

  const handleRename = (): void => {
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleSaveRename = (): void => {
    if (editTitle.trim() && editTitle !== label) {
      onRename?.(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditTitle(label);
      setIsEditing(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const confirmDelete = (): void => {
    onDelete?.();
    setShowDeleteConfirm(false);
  };

  const cancelDelete = (): void => {
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
          background: isActive ? 'var(--shell-item-active-bg)' : 'transparent',
        }}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} color={isActive ? 'var(--accent-chat)' : 'var(--text-tertiary)'} />}
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
            color: isActive ? 'var(--accent-chat)' : 'var(--text-tertiary)',
            fontWeight: isActive ? 700 : 500,
          }}
        />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isActive ? 'var(--surface-hover)' : 'var(--shell-item-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? 'var(--shell-item-active-bg)' : 'transparent';
        // Don't close menu on mouse leave - let the overlay handle it
      }}
      data-rail-item={id}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        borderRadius: 10,
        background: isActive ? 'var(--shell-item-active-bg)' : 'transparent',
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
          color: isActive ? 'var(--shell-item-active-fg)' : 'var(--shell-item-fg)',
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
            background: showMenu ? 'var(--shell-item-hover)' : 'transparent',
            color: 'var(--shell-item-muted)',
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
                background: 'var(--glass-bg-thick)',
                borderRadius: 14,
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)',
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
                  color: 'var(--shell-item-fg)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-item-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Pencil size={16} />
                Rename
              </button>

              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

              <button
                onClick={handleDeleteClick}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--status-error)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-danger-soft-bg)'}
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
  icon: Icon;
  label: string;
  isActive: boolean;
  projects: TaskProject[];
  metaLabel?: string;
  onClick: () => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
  onMoveToProject?: (projectId: string) => void;
}): JSX.Element {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
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

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
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
          background: isActive ? 'var(--shell-item-active-bg)' : 'transparent',
        }}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} color={isActive ? 'var(--accent-chat)' : 'var(--text-tertiary)'} />}
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
            color: isActive ? 'var(--accent-chat)' : 'var(--text-tertiary)',
            fontWeight: isActive ? 700 : 500,
          }}
        />
      </div>
    );
  }

  return (
    <div
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isActive ? 'var(--surface-hover)' : 'var(--shell-item-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? 'var(--shell-item-active-bg)' : 'transparent';
        // Don't close menu on mouse leave - let the overlay handle it
      }}
      data-rail-item={id}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 8px',
        borderRadius: 10,
        background: isActive ? 'var(--shell-item-active-bg)' : 'transparent',
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
          color: isActive ? 'var(--shell-item-active-fg)' : 'var(--shell-item-fg)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s',
          fontWeight: isActive ? 700 : 500,
        }}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} />}
        <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{label}</span>
        {metaLabel && (
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
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
            background: showMenu ? 'var(--shell-item-hover)' : 'transparent',
            color: 'var(--shell-item-muted)',
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
                background: 'var(--glass-bg-thick)',
                borderRadius: 14,
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)',
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
                  color: 'var(--shell-item-fg)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-item-hover)'}
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
                    color: 'var(--shell-item-fg)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    textAlign: 'left',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-item-hover)'}
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
                      background: 'var(--glass-bg-thick)',
                      borderRadius: 14,
                      border: '1px solid var(--border-default)',
                      boxShadow: 'var(--shadow-lg)',
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
                        color: 'var(--shell-item-muted)',
                        cursor: 'pointer',
                        fontSize: 12,
                        textAlign: 'left',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-item-hover)'}
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
                          color: 'var(--shell-item-fg)',
                          cursor: 'pointer',
                          fontSize: 12,
                          textAlign: 'left',
                          transition: 'background 0.2s',
                        }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-item-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {proj.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: 'var(--shell-divider)', margin: '4px 0' }} />

              {/* Delete Option */}
              <button
                onClick={handleDeleteClick}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--status-error)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-danger-soft-bg)'}
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

function SectionDivider(): JSX.Element {
  return (
    <div
      style={{
        height: 1,
        background: 'linear-gradient(90deg, transparent, var(--shell-divider), transparent)',
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
}): JSX.Element {
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
        <div style={{ display: 'flex', minWidth: 0, flex: 1, alignItems: 'center', gap: 8, color: 'var(--shell-item-active-fg)' }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              border: '1px solid var(--shell-menu-border)',
              background: 'var(--shell-item-active-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkle size={13} weight="fill" />
          </div>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-primary)' }}>
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

function CompactMetaPill({ label }: { label: string }): JSX.Element {
  return (
    <span
      style={{
        borderRadius: 999,
        border: '1px solid var(--shell-divider)',
        background: 'var(--surface-panel-muted)',
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--shell-item-fg)',
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
  icon: Icon;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}): JSX.Element {
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
        borderColor: isActive ? 'var(--shell-dialog-border)' : 'var(--shell-divider)',
        background: isActive ? 'var(--shell-item-active-bg)' : 'var(--surface-panel-muted)',
        color: isActive ? 'var(--shell-item-active-fg)' : 'var(--accent-primary)',
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
}): JSX.Element {
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
            e.currentTarget.style.color = 'var(--accent-primary)';
            e.currentTarget.style.background = 'var(--shell-item-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--shell-item-fg)';
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
            color: 'var(--shell-item-fg)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s',
            fontWeight: 500,
          }}
        >
          <FolderPlus size={18} weight="bold" color="var(--accent-primary)" />
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
}): JSX.Element {
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
              background: 'linear-gradient(90deg, var(--accent-chat), transparent)',
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--accent-secondary)',
            }}
          >
            {title}
          </span>
          {count !== undefined ? (
            <span
              style={{
                borderRadius: 999,
                border: '1px solid var(--shell-divider)',
                background: 'var(--shell-item-hover)',
                padding: '2px 6px',
                fontSize: 9,
                color: 'var(--shell-item-muted)',
              }}
            >
              {count}
            </span>
          ) : null}
        </div>
        {caption ? (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{caption}</div>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--accent-primary)',
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
  icon: Icon;
  title: string;
  description: string;
  actionLabel: string;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        border: '1px dashed var(--border-default)',
        background: 'linear-gradient(180deg, var(--bg-secondary), color-mix(in srgb, var(--bg-secondary) 70%, transparent))',
        borderRadius: 14,
        padding: '9px 10px',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: 'inset 0 1px 0 var(--shell-divider)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          background: 'var(--shell-item-active-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
            color: 'var(--accent-chat)',
            flexShrink: 0,
          }}
        >
          <Icon size={14} weight="bold" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
          <div style={{ marginTop: 1, fontSize: 10.5, color: 'var(--text-tertiary)', lineHeight: 1.35 }}>
            {description}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--accent-primary)',
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
  mode = 'chat',
}: {
  session: NativeSession;
  isActive: boolean;
  onClick: () => void;
  mode?: 'chat' | 'code';
}): JSX.Element {
  const metaLabel = formatAgentSessionMetaLabel(session.metadata);
  const descriptor = getAgentSessionDescriptor(session.metadata);
  const isAgentMode = descriptor.sessionMode === 'agent';
  // Unread counts not implemented in mode-specific stores yet
  const unreadCount = 0;
  const updateChatSession = useChatSessionStore((s) => s.updateSession);
  const updateCodeSession = useCodeSessionStore((s) => s.updateSession);
  const deleteChatSession = useChatSessionStore((s) => s.deleteSession);
  const deleteCodeSession = useCodeSessionStore((s) => s.deleteSession);
  const updateSession = mode === 'code' ? updateCodeSession : updateChatSession;
  const deleteSession = mode === 'code' ? deleteCodeSession : deleteChatSession;
  const SessionIcon = isAgentMode ? Robot : Cpu;

  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session.name || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== session.name) {
      void updateSession(session.id, { name: trimmed });
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 14,
        border: '1px solid var(--shell-dialog-border)',
        background: 'var(--shell-item-active-bg)',
      }}>
        <SessionIcon size={16} weight="bold" color="var(--accent-primary)" />
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveRename();
            else if (e.key === 'Escape') { setEditName(session.name || ''); setIsEditing(false); }
          }}
          onBlur={handleSaveRename}
          autoFocus
          style={{
            flex: 1, fontSize: 12, background: 'transparent', border: 'none',
            outline: 'none', color: 'var(--shell-item-active-fg)', fontWeight: 600,
          }}
        />
      </div>
    );
  }

  return (
    <>
      {showDeleteConfirm && (
        <DeleteConfirmModal
          title="Delete session"
          itemName={session.name || 'Untitled Session'}
          itemType="session"
          onConfirm={() => {
            deleteSession(session.id).catch(console.error);
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    <div
      style={{ position: 'relative', width: '100%' }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget.querySelector('[data-session-btn]') as HTMLElement | null)
            ?.style && ((e.currentTarget.querySelector('[data-session-btn]') as HTMLElement).style.borderColor = 'var(--shell-dialog-border)');
        }
      }}
    >
      <button
        data-session-btn
        type="button"
        onClick={onClick}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          paddingRight: 32,
          borderRadius: 14,
          border: '1px solid',
          borderColor: isActive ? 'var(--shell-dialog-border)' : 'var(--shell-divider)',
          background: isActive
            ? 'var(--shell-item-active-bg)'
            : 'transparent',
          color: isActive ? 'var(--shell-item-active-fg)' : 'var(--shell-item-fg)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s',
          fontWeight: isActive ? 700 : 500,
          boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
        }}
      >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            background: isActive
              ? isAgentMode ? 'var(--shell-mode-cowork-soft)' : 'var(--shell-item-active-bg)'
              : 'var(--surface-panel-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isActive
              ? isAgentMode ? 'var(--accent-cowork)' : 'var(--shell-item-active-fg)'
              : 'var(--accent-primary)',
          }}
        >
          <SessionIcon size={16} weight={isActive ? 'fill' : 'bold'} />
        </div>
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 14,
            height: 14,
            borderRadius: 999,
            background: 'var(--accent-chat)',
            color: 'var(--shell-danger-fg)',
            fontSize: 8,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
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
              flex: 1,
              minWidth: 0,
            }}
          >
            {session.name || 'Untitled Session'}
          </span>
          <span
            style={{
              flexShrink: 0,
              borderRadius: 999,
              background: session.isActive ? 'var(--status-success-bg)' : 'var(--surface-panel-muted)',
              color: session.isActive ? 'var(--status-success)' : 'var(--shell-item-muted)',
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
        <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
          {metaLabel ? (
            <>
              <span
                style={{
                  flexShrink: 0,
                  borderRadius: 999,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-hover)',
                  color: 'var(--accent-primary)',
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

      {/* ⋯ context menu - container has padding to bridge gap between button and menu */}
      <div 
        style={{ 
          position: 'absolute', 
          top: 6, 
          right: 6,
          padding: '4px',
          margin: '-4px',
        }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
          style={{
            width: 22, height: 22, borderRadius: 6, border: 'none',
            background: showMenu ? 'var(--shell-item-hover)' : 'transparent',
            color: 'var(--shell-item-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0.6, transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
        >
          <DotsThree size={16} weight="bold" />
        </button>
        {showMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowMenu(false)} />
            <div 
              style={{
                position: 'absolute', top: '100%', right: 4, marginTop: 0,
                minWidth: 160,
                background: 'var(--glass-bg-thick)',
                borderRadius: 12, border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-lg)', zIndex: 9999, padding: 4,
              }}
            >
              {[
                { icon: Pencil, label: 'Rename', color: 'var(--shell-item-fg)', onClick: () => { setEditName(session.name || ''); setIsEditing(true); setShowMenu(false); } },
                { icon: Trash, label: 'Delete', color: 'var(--status-error)', onClick: () => { setShowDeleteConfirm(true); setShowMenu(false); } },
              ].map(({ icon: Icon2, label, color, onClick: action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); action(); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 8, border: 'none',
                    background: 'transparent', color, cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = label === 'Delete' ? 'var(--shell-danger-soft-bg)' : 'var(--shell-item-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon2 size={14} />
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}

function RailItem({ id, icon: Icon, label, isActive, onClick }: {
  id?: string;
  icon: Icon;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      data-rail-item={id}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = 'var(--accent-primary)';
          e.currentTarget.style.background = 'var(--shell-item-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = 'var(--shell-item-fg)';
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
          ? 'var(--shell-item-active-bg)'
          : 'transparent',
        color: isActive ? 'var(--shell-item-active-fg)' : 'var(--shell-item-fg)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s',
        fontWeight: isActive ? 700 : 500,
        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
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
}: {
  id: string;
  project: ChatProject;
  icon: Icon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onRename?: (newTitle: string) => void;
  onDelete?: () => void;
}): JSX.Element {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditTitle(label);
      setIsEditing(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
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
          background: isActive ? 'var(--shell-item-active-bg)' : 'transparent',
        }}
      >
        {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} color={isActive ? 'var(--accent-chat)' : 'var(--shell-item-muted)'} />}
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
            color: isActive ? 'var(--accent-chat)' : 'var(--shell-item-muted)',
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
          e.currentTarget.style.background = 'var(--shell-item-hover)';
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
          ? 'var(--shell-item-active-bg)'
          : 'transparent',
        position: 'relative',
        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
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
          color: isActive ? 'var(--shell-item-active-fg)' : 'var(--shell-item-fg)',
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
            background: showMenu ? 'var(--shell-item-hover)' : 'transparent',
            color: 'var(--shell-item-muted)',
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
                background: 'var(--shell-dialog-bg)',
                borderRadius: 14,
                border: '1px solid var(--shell-dialog-border)',
                boxShadow: 'var(--shadow-lg)',
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
                  color: 'var(--shell-item-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-item-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Pencil size={16} />
                Rename
              </button>

              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

              {/* Delete Option */}
              <button
                onClick={handleDeleteClick}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--status-error)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--shell-danger-soft-bg)'}
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


/**
 * CodeThreadsSection - Shows Code Mode workspaces and threads
 */
function CodeThreadsSection({
  onOpen,
  activeViewType,
}: {
  onOpen?: (view: string) => void;
  activeViewType?: string;
}): JSX.Element {
  // Get code mode store data
  const sessions = useCodeModeStore((state) => state.sessions);
  const activeSessionId = useCodeModeStore((state) => state.activeSessionId);
  const activeWorkspaceId = useCodeModeStore((state) => state.activeWorkspaceId);
  const setActiveSession = useCodeModeStore((state) => state.setActiveSession);
  const setActiveWorkspace = useCodeModeStore((state) => state.setActiveWorkspace);
  const createWorkspace = useCodeModeStore((state) => state.createWorkspace);
  const workspaces = useCodeModeStore((state) => state.workspaces);

  // Code session store
  const nativeSessions = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.sessions, shallow);
  const activeNativeSessionId = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.activeSessionId, shallow);
  const setActiveNativeSession = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.setActiveSession, shallow);

  // Filter sessions for active workspace
  const workspaceSessions = useMemo(() => {
    if (!activeWorkspaceId) return [];
    return sessions.filter(s => s.workspace_id === activeWorkspaceId);
  }, [sessions, activeWorkspaceId]);

  const handleCreateWorkspace = () => {
    createWorkspace('New Workspace');
    onOpen?.('code-project');
  };

  const handleOpenWorkspace = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
    onOpen?.('code-project');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Workspaces */}
      <div style={{ padding: '4px' }}>
        <button
          onClick={handleCreateWorkspace}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: '10px',
            border: '1px dashed var(--shell-dialog-border)',
            background: 'transparent',
            color: 'var(--accent-primary)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.background = 'var(--shell-item-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--shell-dialog-border)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Plus size={14} weight="bold" />
          New Workspace
        </button>
      </div>

      {workspaces.map((ws) => (
        <div key={ws.workspace_id}>
          <button
            onClick={() => handleOpenWorkspace(ws.workspace_id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: '10px',
              border: 'none',
              background: activeWorkspaceId === ws.workspace_id
                ? 'var(--shell-item-active-bg)'
                : 'transparent',
              color: activeWorkspaceId === ws.workspace_id ? 'var(--shell-item-active-fg)' : 'var(--shell-item-fg)',
              fontSize: 11,
              fontWeight: activeWorkspaceId === ws.workspace_id ? 700 : 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (activeWorkspaceId !== ws.workspace_id) {
                e.currentTarget.style.color = 'var(--accent-primary)';
                e.currentTarget.style.background = 'var(--shell-item-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeWorkspaceId !== ws.workspace_id) {
                e.currentTarget.style.color = 'var(--shell-item-fg)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: activeWorkspaceId === ws.workspace_id ? 'var(--accent-primary)' : 'var(--shell-item-muted)',
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ws.display_name}
            </span>
          </button>

          {activeWorkspaceId === ws.workspace_id && workspaceSessions.length > 0 && (
            <div style={{ padding: '4px 0 4px 22px' }}>
              {workspaceSessions.map((session) => (
                <button
                  key={session.session_id}
                  onClick={() => {
                    setActiveSession(session.session_id);
                    onOpen?.('code');
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: activeSessionId === session.session_id
                      ? 'var(--shell-item-active-bg)'
                      : 'transparent',
                    color: activeSessionId === session.session_id ? 'var(--shell-item-active-fg)' : 'var(--shell-item-muted)',
                    fontSize: 10,
                    fontWeight: activeSessionId === session.session_id ? 600 : 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (activeSessionId !== session.session_id) {
                      e.currentTarget.style.color = 'var(--accent-primary)';
                      e.currentTarget.style.background = 'var(--shell-item-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeSessionId !== session.session_id) {
                      e.currentTarget.style.color = 'var(--shell-item-muted)';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: session.state === 'EXECUTING' ? 'var(--status-success)' : 'var(--shell-item-muted)',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Agent Sessions — always visible, no tab toggle */}
      {nativeSessions.length > 0 && (
        <>
          <div style={{
            padding: '4px 10px 2px',
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--shell-item-muted)',
          }}>
            Agent Sessions
          </div>
          <div style={{ padding: '0 4px' }}>
            {nativeSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  setActiveNativeSession(session.id);
                  onOpen?.('code-agent-session');
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeNativeSessionId === session.id
                    ? 'var(--shell-item-active-bg)'
                    : 'transparent',
                  color: activeNativeSessionId === session.id ? 'var(--shell-item-active-fg)' : 'var(--shell-item-muted)',
                  fontSize: 10,
                  fontWeight: activeNativeSessionId === session.id ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (activeNativeSessionId !== session.id) {
                    e.currentTarget.style.color = 'var(--accent-primary)';
                    e.currentTarget.style.background = 'var(--shell-item-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeNativeSessionId !== session.id) {
                    e.currentTarget.style.color = 'var(--shell-item-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.name || 'Agent Session'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
