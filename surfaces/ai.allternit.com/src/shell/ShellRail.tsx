import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import type { AppMode } from './ShellHeader';
import {
  CaretDown,
  CaretRight,
  Gear,
  ChatTeardropText,
  Robot,
  Sparkle,
  Cpu,
  CheckSquare,
  GraduationCap,
  BookOpen,
  AppWindow,
  Plugs,
  Globe,
  PushPinSlash,
  Palette,
} from '@phosphor-icons/react';
import { getPinnedMiniApps, unpinMiniApp, seedDefaultMiniApps } from '../views/aci/mini-app-registry';
import type { InstalledMiniApp } from '../views/aci/mini-app.types';
import { useChatStore } from '../views/chat/ChatStore';

import { useCoworkStore } from '../views/cowork/CoworkStore';
import { useCodeModeStore } from '../views/code/CodeModeStore';
import { RAIL_CONFIG, type RailConfigSection } from './rail/rail.config';
import { COWORK_RAIL_CONFIG } from './rail/cowork.config';
import { CODE_RAIL_CONFIG } from './rail/code.config';
import { DESIGN_RAIL_CONFIG } from './rail/design.config';
import { BROWSER_RAIL_CONFIG } from './rail/browser.config';
import { useFeaturePlugins } from '../plugins/useFeaturePlugins';


import { ProjectRailSection, type UnifiedProject, type UnifiedItem } from './rail/ProjectRailSection';
import { useSurfaceAgentModeEnabled } from '../lib/agents/surface-agent-context';
import { useChatSessionStore } from '../views/chat/ChatSessionStore';
import { useBrowserStore } from '../capsules/browser/browser.store';
import { useCodeSessionStore } from '../views/code/CodeSessionStore';
import { useCoworkSessionStore } from '../views/cowork/CoworkSessionStore';
import type { ModeSession } from '../lib/agents/mode-session-store';

type NativeSession = ModeSession;  // For backward compatibility
import {
  formatAgentSessionMetaLabel,
  getAgentSessionDescriptor,
} from '../lib/agents/session-metadata';
import { useAgentSurfaceModeStore } from '../stores/agent-surface-mode.store';

import { SettingsDrilldown } from './SettingsDrilldown';
import { getAgentModeSurfaceTheme } from '../views/chat/agentModeSurfaceTheme';
import type { AgentModeSurface } from '../stores/agent-surface-mode.store';
import { cn } from '@/lib/utils';

const MINI_APP_CATEGORY_ICONS: Record<string, Icon> = {
  runtime:       Cpu,
  connector:     Plugs,
  communication: Globe,
  data:          Globe,
  tool:          Gear,
  custom:        AppWindow,
};

function usePinnedMiniApps(): InstalledMiniApp[] {
  const [pinned, setPinned] = useState<InstalledMiniApp[]>(() => {
    seedDefaultMiniApps();
    return getPinnedMiniApps();
  });
  useEffect(() => {
    const sync = () => setPinned(getPinnedMiniApps());
    window.addEventListener('allternit:mini-apps-changed', sync);
    return () => window.removeEventListener('allternit:mini-apps-changed', sync);
  }, []);
  return pinned;
}

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

const BROWSER_MODE_VIEW_TYPES = new Set<string>([
  'browser',
  'browserview',
  'mini-apps-store',
  'browser-extensions',
  'mini-app',
  'addin-word',
  'addin-excel',
  'addin-ppt',
  'hermes',
  'openclaw',
  'openclaw-chat',
  'openclaw-sessions',
]);

export function ShellRail({
  activeViewType,
  onOpen,
  onNew,
  mode = 'chat',
  isCollapsed,
  onModeChange,
}: ShellRailProps): React.ReactNode | null {
  const [foldedCategories, setFoldedCategories] = useState<Set<string>>(new Set(['workspace', 'ai_vision', 'infrastructure', 'security', 'execution', 'observability', 'services']));

  const isBrowser = activeViewType ? BROWSER_MODE_VIEW_TYPES.has(activeViewType) : false;

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
  const chatSessions = useStoreWithEqualityFn(useChatSessionStore, (s) => s.sessions ?? [], shallow);
  const codeSessions = useStoreWithEqualityFn(useCodeSessionStore, (s) => s.sessions ?? [], shallow);
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

  const { enabledPlugins } = useFeaturePlugins();

  // Pinned mini-apps (browser mode dynamic rail)
  const pinnedMiniApps = usePinnedMiniApps();

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
      // Real code-mode chat sessions live in the mode session store (CodeSessionStore).
      // codeStore.sessions is the legacy workspace-runtime list and is normally empty,
      // which left the Threads rail blank even after sessions were created.
      const projects: UnifiedProject[] = codeStore.workspaces.map(ws => ({
        id: ws.workspace_id,
        title: ws.display_name,
        itemIds: codeSessions
          .filter(s => (s.metadata as Record<string, unknown> | undefined)?.workspaceId === ws.workspace_id)
          .map(s => s.id)
      }));
      const items: UnifiedItem[] = codeSessions.map(s => ({
        id: s.id,
        title: s.name || 'Untitled Session',
        icon: (s.metadata as Record<string, unknown> | undefined)?.sessionMode === 'agent' ? Robot : Cpu,
        projectId: (s.metadata as Record<string, unknown> | undefined)?.workspaceId as string | undefined,
        isActive: activeCodeSessionId === s.id,
        metaLabel: formatAgentSessionMetaLabel(s.metadata)
      }));
      return { projects, items };
    }
    return { projects: [], items: [] };
  }, [isBrowser, mode, chatProjects, chatSessions, nativeSessions, activeNativeSessionId, activeChatSessionId, codeSessions, activeCodeSessionId, coworkStore, codeStore]);

  // Build active config, then inject any enabled-plugin rail items
  let activeConfig: RailConfigSection[];
  if (isBrowser || mode === 'browser') activeConfig = BROWSER_RAIL_CONFIG;
  else if (mode === 'cowork') activeConfig = COWORK_RAIL_CONFIG;
  else if (mode === 'code') activeConfig = CODE_RAIL_CONFIG;
  else if (mode === 'design') activeConfig = DESIGN_RAIL_CONFIG;
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
      useChatSessionStore.getState().setActiveSession(session.id);
    } else {
      useChatSessionStore.getState().setActiveSession(session.id);
    }
    if (descriptor.agentId) {
      setSelectedSurfaceAgent(originSurface, descriptor.agentId);
    }

    if (originSurface === 'browser') {
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
  ]);

  const isCodeMode = mode === 'code';
  const isDesignMode = mode === 'design';
  const useBlendedRail = isDesignMode || ['chat', 'cowork', 'code'].includes(mode) || isBrowser;

  if (isCollapsed) return null;

  return (
    <div 
      className="size-full flex flex-col bg-[var(--shell-panel-bg)] relative overflow-hidden outline-none"
      style={{
        /* Mode-aware CSS custom properties scoped to this rail */
        ['--shell-item-active-bg' as string]: `color-mix(in srgb, ${surfaceTheme?.accent ?? 'var(--accent-primary)'} 16%, var(--surface-panel))`,
        ['--shell-item-active-fg' as string]: surfaceTheme?.accent ?? 'var(--accent-primary)',
        ['--accent-primary' as string]: surfaceTheme?.accent ?? 'var(--accent-primary)',
        /* Blended rail for chat, cowork, code, browser, and design modes */
        ...(useBlendedRail ? {
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
      }}
    >
      {/* SPACER FOR FIXED CONTROLS — extra clearance in code mode since New Thread has no section title */}
      <div style={{ height: isCodeMode ? 102 : 86 }} />

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-1">
        {activeConfig.map((category) => {
          const isFolded = foldedCategories.has(category.id);
          const isCollapsible = category.collapsible !== false;
          
          // Add separator before 'threads' section in code mode
          const showSeparator = isCodeMode && category.id === 'threads';

          return (
            <div key={category.id} className="mb-1">
              {showSeparator && (
                <div className="p-[8px_12px] text-[var(--accent-secondary)] text-[12px] font-extrabold tracking-[0.08em]">
                  &gt; THREADS
                </div>
              )}
              {isCollapsible ? (
                <button type="button" 
                  onClick={() => toggleFold(category.id)}
                  className="w-full flex items-center gap-1.5 p-[8px_12px] rounded-xl border-none bg-transparent cursor-pointer text-[var(--accent-secondary)] transition-all duration-200 hover:bg-[var(--shell-item-hover)] hover:text-[var(--accent-primary)]"
                >
                  {isFolded ? <CaretRight size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />}
                  <span className="text-[12px] font-extrabold uppercase tracking-[0.08em]">{category.title}</span>
                </button>
              ) : null}

              {!isFolded && (
                <div className="flex flex-col gap-0.5 mt-0.5">
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
                            onOpen?.('browser');
                          }
                          return;
                        }
                        if (mode === 'chat') {
                          const session = nativeSessions.find(s => s.id === id);
                          if (session) openNativeSessionSurface(session);
                        } else if (mode === 'cowork') {
                          coworkStore.setActiveTask(id);
                          const coworkTask = coworkStore.tasks.find(t => t.id === id);
                          useCoworkSessionStore.getState().setActiveSession(coworkTask?.sessionId ?? null);
                          if (onModeChange) {
                            onModeChange('cowork');
                          } else {
                            onOpen?.('workspace');
                          }
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
                          description: "Start a computer agent session to see it here.",
                          actionLabel: "Open Browser",
                          onAction: () => onOpen?.('browser')
                        } : mode === 'chat' ? {
                          icon: ChatTeardropText as any,
                          title: "No sessions yet",
                          description: "Start a chat or create an agent session.",
                          actionLabel: "Open chat",
                          onAction: () => onOpen?.('chat')
                        } : mode === 'cowork' ? {
                          icon: CheckSquare as any,
                          title: "No tasks yet",
                          description: "Create a task to get started.",
                          actionLabel: "New Task",
                          onAction: () => onOpen?.('cowork-new-task')
                        } : mode === 'design' ? {
                          icon: Palette as any,
                          title: "No design projects",
                          description: "Create a design project to start designing.",
                          actionLabel: "New Design",
                          onAction: () => onOpen?.('design')
                        } : {
                          icon: Cpu as any,
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
                  ) : category.id === 'mini-apps' && (isBrowser || mode === 'browser') ? (
                    <div className="flex flex-col gap-1">
                      {/* Static store entry */}
                      {category.items.map((item: { id: string; icon: Icon; label: string; isAction?: boolean; payload: string }) => (
                        <RailItem
                          key={item.id}
                          id={item.id}
                          icon={item.icon}
                          label={item.label}
                          isActive={activeViewType === item.payload}
                          onClick={() => onOpen?.(item.payload)}
                        />
                      ))}
                      {/* Dynamic pinned apps */}
                      {pinnedMiniApps.map((app) => (
                        <PinnedMiniAppItem
                          key={app.id}
                          app={app}
                          isActive={activeViewType === app.id}
                          onOpen={() => {
                            if (app.id === 'hermes' || app.id === 'openclaw') {
                              onOpen?.(app.id);
                            } else {
                              window.dispatchEvent(new CustomEvent('allternit:open-view', {
                                detail: { viewType: 'mini-app', context: { url: app.url, name: app.name, category: app.category, version: app.version } },
                              }));
                            }
                          }}
                          onUnpin={() => unpinMiniApp(app.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {category.items.map((item: { id: string; icon: Icon; label: string; isAction?: boolean; payload: string }) => (
                        <div key={item.id} className="flex flex-col gap-0.5">
                          <RailItem
                            id={item.id}
                            icon={item.icon}
                            label={item.label}
                            isActive={!item.isAction && activeViewType === item.payload}
                            onClick={() => {
                              if (item.id === 'new-chat' || item.id === 'chat') {
                                chatStore.setActiveThread(null);
                                useChatSessionStore.getState().setActiveSession(null);
                              }
                              if (item.id === 'br-new-session') {
                                useBrowserStore.getState().closeAllTabs();
                                onOpen?.('browser');
                                return;
                              }
                              if (item.payload === 'browser-extensions') {
                                onOpen?.('browser-extensions');
                                return;
                              }
                              onOpen?.(item.payload);
                              if (item.payload === 'chat') onModeChange?.('chat');
                              else if (item.payload === 'workspace') onModeChange?.('cowork');
                              else if (item.payload === 'code') onModeChange?.('code');
                              else if (
                                item.payload === 'design' ||
                                item.payload === 'design-marketplace' ||
                                item.payload.startsWith('design-view-')
                              ) {
                                onModeChange?.('design');
                              }
                            }}
                          />
                        </div>
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
      <div className="p-[16px_20px] border-t border-solid border-[var(--shell-divider)] flex items-center gap-3 bg-[var(--shell-panel-bg)] shrink-0">
        <div className="size-8 rounded-[10px] bg-gradient-to-br from-[var(--accent-chat)] to-[var(--accent-primary)] shrink-0 flex items-center justify-center text-[var(--bg-primary)] text-[14px] font-bold">U</div>
        <div className="flex-1 min-w-0">
          <div className="text-[var(--shell-item-fg)] text-[13px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">User Name</div>
          <div className="text-[var(--shell-item-muted)] text-[12px] font-medium">Pro Plan</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => onOpen?.('labs')}
            className="size-8 rounded-lg border-none bg-transparent text-[var(--shell-item-muted)] cursor-pointer flex items-center justify-center transition-all duration-200 hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
            title="A://Labs - Learning Portal"
          >
            <GraduationCap size={18} weight="bold" />
          </button>
          <button type="button"
            onClick={() => {
              onOpen?.('labs');
              // Dispatch event to switch to research tab inside Labs
              window.dispatchEvent(new CustomEvent('allternit:open-labs-research', { detail: {} }));
            }}
            className="size-8 rounded-lg border-none bg-transparent text-[var(--shell-item-muted)] cursor-pointer flex items-center justify-center transition-all duration-200 hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
            title="Open Notebook"
          >
            <BookOpen size={18} weight="bold" />
          </button>
          <button type="button"
            onClick={() => onOpen?.('products')}
            className="size-8 rounded-lg border-none bg-transparent text-[var(--shell-item-muted)] cursor-pointer flex items-center justify-center transition-all duration-200 hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
            title="Allternit Products"
          >
            <Sparkle size={18} weight="bold" />
          </button>
          <SettingsDrilldown>
            <button type="button"
              className="size-8 rounded-lg border-none bg-transparent text-[var(--shell-item-muted)] cursor-pointer flex items-center justify-center transition-all duration-200 hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
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
}): React.ReactNode {
  return (
    <button type="button"
      onClick={onClick}
      data-rail-item={id}
      className={cn(
        "w-full flex items-center gap-2.5 p-[9px_12px] rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium",
        isActive
          ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-bold shadow-[var(--shadow-sm)]"
          : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
      )}
    >
      {Icon && <Icon size={18} weight={isActive ? 'fill' : 'bold'} />}
      <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{label}</span>
    </button>
  );
}

function PinnedMiniAppItem({ app, isActive, onOpen, onUnpin }: {
  app: InstalledMiniApp;
  isActive?: boolean;
  onOpen: () => void;
  onUnpin: () => void;
}): React.ReactNode {
  const [hovered, setHovered] = useState(false);
  const AppIcon = (MINI_APP_CATEGORY_ICONS[app.category] ?? AppWindow) as Icon;
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button type="button"
        onClick={onOpen}
        data-rail-item={app.id}
        className={cn(
          "w-full flex items-center gap-2.5 p-[9px_12px] rounded-xl border-none cursor-pointer text-left transition-all duration-200 font-medium pr-8",
          isActive
            ? "bg-[var(--shell-item-active-bg)] text-[var(--shell-item-active-fg)] font-bold shadow-[var(--shadow-sm)]"
            : "bg-transparent text-[var(--shell-item-fg)] hover:text-[var(--accent-primary)] hover:bg-[var(--shell-item-hover)]"
        )}
      >
        <AppIcon size={18} weight={isActive ? 'fill' : 'bold'} />
        <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">{app.name}</span>
      </button>
      {hovered && (
        <button type="button"
          onClick={(e) => { e.stopPropagation(); onUnpin(); }}
          title="Unpin from rail"
          className="absolute right-2 size-5 flex items-center justify-center rounded border-none bg-transparent cursor-pointer text-[var(--shell-item-muted)] hover:text-[var(--status-error)] transition-colors"
        >
          <PushPinSlash size={12} />
        </button>
      )}
    </div>
  );
}
