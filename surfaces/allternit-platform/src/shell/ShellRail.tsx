import React, { useState, useCallback, useMemo } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import type { AppMode } from './ShellHeader';
import {
  CaretDown,
  CaretRight,
  Gear,
  ChatTeardropText,
  MagnifyingGlass,
  Robot,
  Sparkle,
  Cpu,
  CheckSquare,
  GraduationCap,
} from '@phosphor-icons/react';
import { useChatStore } from '../views/chat/ChatStore';

import { useCoworkStore } from '../views/cowork/CoworkStore';
import { useCodeModeStore } from '../views/code/CodeModeStore';
import { RAIL_CONFIG, type RailConfigSection } from './rail/rail.config';
import { COWORK_RAIL_CONFIG } from './rail/cowork.config';
import { CODE_RAIL_CONFIG } from './rail/code.config';
import { BROWSER_RAIL_CONFIG } from './rail/browser.config';
import { useFeaturePlugins } from '../plugins/useFeaturePlugins';


import { ProjectRailSection, type UnifiedProject, type UnifiedItem } from './rail/ProjectRailSection';
import { useSurfaceAgentModeEnabled } from '../lib/agents/surface-agent-context';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { useCodeSessionStore } from '../views/code/CodeSessionStore';
// Browser session store not yet implemented — stubbed below
import { useCoworkSessionStore } from '../views/cowork/CoworkSessionStore';
import type { ModeSession } from '../lib/agents/mode-session-store';

type NativeSession = ModeSession;  // For backward compatibility
import {
  formatAgentSessionMetaLabel,
  getAgentSessionDescriptor,
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
  mode?: AppMode;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onModeChange?: (mode: AppMode) => void;
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
}: ShellRailProps): JSX.Element | null {
  const [foldedCategories, setFoldedCategories] = useState<Set<string>>(new Set(['workspace', 'ai_vision', 'infrastructure', 'security', 'execution', 'observability', 'services']));

  const isBrowser = activeViewType === 'browser';

  // Determine current surface for agent mode glow
  const currentSurface: AgentModeSurface = 
    mode === 'browser' ? 'browser' :
    mode === 'cowork' ? 'cowork' : 
    mode === 'code' ? 'code' : 'chat';
  
  const isAgentActive = useSurfaceAgentModeEnabled(currentSurface);
  const surfaceTheme = isAgentActive ? getAgentModeSurfaceTheme(currentSurface) : null;

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
  const setActiveChatSession = useStoreWithEqualityFn(useChatSessionStore, (s) => s.setActiveSession);
  const setActiveCodeSession = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.setActiveSession);
  const updateChatSession = useStoreWithEqualityFn(useChatSessionStore, (s) => s.updateSession);
  const updateCodeSession = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.updateSession);
  const deleteChatSession = useStoreWithEqualityFn(useChatSessionStore, (s) => s.deleteSession);
  const deleteCodeSession = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.deleteSession);
  const setActiveNativeSession = mode === 'code' ? setActiveCodeSession : setActiveChatSession;
  const updateNativeSession = mode === 'code' ? updateCodeSession : updateChatSession;
  const deleteNativeSession = mode === 'code' ? deleteCodeSession : deleteChatSession;
  
  // Cowork Store
  const coworkStore = useCoworkStore();
  
  // Code Mode Store
  const codeStore = useCodeModeStore();

  useStoreWithEqualityFn(useCoworkSessionStore, (s) => s.activeSessionId);
  
  const setSelectedSurfaceAgent = useStoreWithEqualityFn(useAgentSurfaceModeStore, (s) => s.setSelectedAgent);

  const setSidecarOpen = useStoreWithEqualityFn(useSidecarStore, (s) => s.setOpen);
  
  const { enabledPlugins } = useFeaturePlugins();

  // Unified data mapping
  const unifiedData = useMemo(() => {
    if (isBrowser) {
      const browserSessions = chatSessions.filter(s => {
        const surface = (s.metadata as Record<string, unknown> | undefined)?.surface;
        return surface === 'browser';
      });
      const items: UnifiedItem[] = browserSessions.map(s => ({
        id: s.id,
        title: s.name || 'Untitled Session',
        icon: Robot,
        isActive: activeChatSessionId === s.id,
        metaLabel: formatAgentSessionMetaLabel(s.metadata)
      }));
      return { projects: [], items };
    }

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
  }, [isBrowser, mode, chatProjects, chatSessions, nativeSessions, activeNativeSessionId, activeChatSessionId, coworkStore, codeStore]);

  // Build active config, then inject any enabled-plugin rail items
  let activeConfig: RailConfigSection[];
  if (isBrowser) activeConfig = BROWSER_RAIL_CONFIG;
  else if (mode === 'cowork') activeConfig = COWORK_RAIL_CONFIG;
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
      // Browser session store not yet implemented
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
  const isDesignMode = mode === 'design';

  if (isCollapsed) return null;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--shell-panel-bg)',
      borderRadius: 0,
      border: 'none',
      boxShadow: 'none',
      position: 'relative',
      overflow: 'hidden',
      outline: 'none',
      /* Mode-aware CSS custom properties scoped to this rail */
      ['--shell-item-active-bg' as string]: `color-mix(in srgb, ${surfaceTheme?.accent ?? 'var(--accent-primary)'} 16%, var(--surface-panel))`,
      ['--shell-item-active-fg' as string]: surfaceTheme?.accent ?? 'var(--accent-primary)',
      ['--accent-primary' as string]: surfaceTheme?.accent ?? 'var(--accent-primary)',
      /* Design mode: light-theme rail overrides so it blends with the light canvas */
      ...(isDesignMode ? {
        ['--shell-panel-bg' as string]: 'var(--bg-primary)',
        ['--shell-item-fg' as string]: 'var(--text-primary)',
        ['--shell-item-muted' as string]: 'var(--text-tertiary)',
        ['--shell-item-hover' as string]: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
        ['--shell-floating-bg' as string]: 'var(--glass-bg-thick)',
        ['--shell-floating-border' as string]: 'var(--glass-border)',
        ['--shell-menu-bg' as string]: 'var(--surface-floating)',
        ['--shell-menu-border' as string]: 'var(--border-default)',
        ['--border-subtle' as string]: 'var(--ui-border-muted)',
      } : {}),
    }}>
      {/* SPACER FOR FIXED CONTROLS */}
      <div style={{ height: 112 }} />

      {/* SEARCH BAR */}
      <div style={{ padding: '0 8px 8px 8px' }}>
        <div style={{
          width: '100%',
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
                        isBrowser ? null :
                        mode === 'chat' ? chatStore.activeProjectId : 
                        mode === 'cowork' ? coworkStore.activeProjectId : 
                        codeStore.activeWorkspaceId
                      }
                      onCreateProject={() => {
                        if (isBrowser) return;
                        if (mode === 'chat') chatStore.createProject('New Project');
                        else if (mode === 'cowork') coworkStore.createProject('New Project');
                        else if (mode === 'code') {
                          codeStore.createWorkspace('New Workspace');
                          onOpen?.('code-project');
                        }
                      }}
                      onOpenProject={(id) => {
                        if (isBrowser) return;
                        if (mode === 'chat') { chatStore.setActiveProject(id); openChatSurface(); }
                        else if (mode === 'cowork') { coworkStore.setActiveProject(id); openCoworkSurface(); }
                        else if (mode === 'code') { codeStore.setActiveWorkspace(id); onOpen?.('code-project'); }
                      }}
                      onRenameProject={(id, title) => {
                        if (isBrowser) return;
                        if (mode === 'chat') chatStore.renameProject(id, title);
                        else if (mode === 'cowork') coworkStore.renameProject(id, title);
                        else if (mode === 'code') codeStore.renameWorkspace(id, title);
                      }}
                      onDeleteProject={(id) => {
                        if (isBrowser) return;
                        if (mode === 'chat') chatStore.deleteProject(id);
                        else if (mode === 'cowork') coworkStore.deleteProject(id);
                        else if (mode === 'code') codeStore.deleteWorkspace(id);
                      }}
                      onOpenItem={(id) => {
                        if (isBrowser) {
                          const session = chatSessions.find(s => s.id === id);
                          if (session) {
                            setActiveChatSession(session.id);
                            setSidecarOpen(true);
                            onOpen?.('browser');
                          }
                          return;
                        }
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
                        if (isBrowser) {
                          updateChatSession(id, { name: title });
                          return;
                        }
                        if (mode === 'chat' || (mode === 'code' && !codeStore.sessions.some(s => s.session_id === id))) {
                          updateNativeSession(id, { name: title });
                        } else if (mode === 'cowork') {
                          coworkStore.renameTask(id, title);
                        }
                      }}
                      onDeleteItem={(id) => {
                        if (isBrowser) {
                          deleteChatSession(id);
                          return;
                        }
                        if (mode === 'chat' || (mode === 'code' && !codeStore.sessions.some(s => s.session_id === id))) {
                          deleteNativeSession(id);
                        } else if (mode === 'cowork') {
                          coworkStore.deleteTask(id);
                        }
                      }}
                      onMoveItemToProject={(itemId, projectId) => {
                        if (isBrowser) return;
                        if (mode === 'chat') chatStore.moveThreadToProject(itemId, projectId);
                        else if (mode === 'cowork') coworkStore.moveTaskToProject(itemId, projectId);
                      }}
                      sectionTitle={mode === 'code' ? 'Workspaces' : mode === 'cowork' ? 'Projects' : 'Projects'}
                      sectionCaption={mode === 'code' ? 'Code workspaces' : mode === 'cowork' ? 'Task organizer' : 'Shared organizer'}
                      newButtonLabel={mode === 'code' ? 'New Workspace' : mode === 'cowork' ? 'New Project' : 'New Project'}
                      recentItemsLabel={mode === 'code' ? 'Threads' : mode === 'cowork' ? 'Recent Tasks' : 'Recent Sessions'}
                      emptyNotice={
                        isBrowser ? {
                          icon: ChatTeardropText as any,
                          title: "No browser sessions",
                          description: "Start a browser agent session to see it here.",
                          actionLabel: "Open Browser",
                          onAction: () => onOpen?.('browser')
                        } : mode === 'chat' ? {
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
                          if (item.id === 'br-new-session') {
                            useChatSessionStore.getState().createSession({
                              name: 'New Browser Session',
                              metadata: { surface: 'browser' }
                            }).then((sessionId) => {
                              useChatSessionStore.getState().setActiveSession(sessionId);
                              setSidecarOpen(true);
                            });
                          }
                          if (item.payload === 'browser-extensions') {
                            setSidecarOpen(true);
                            onOpen?.('browser');
                            return;
                          }
                          onOpen?.(item.payload);
                          if (item.payload === 'chat') onModeChange?.('chat');
                          else if (item.payload === 'workspace') onModeChange?.('cowork');
                          else if (item.payload === 'code') onModeChange?.('code');
                        }}
                      />
                    ))
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
