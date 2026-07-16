import React, { useRef, useEffect, useMemo } from 'react';
import { DrawerTabs } from './DrawerTabs';
import { UnifiedTerminal } from '../../../components/workspace/UnifiedTerminal';
import { ArtifactCenter } from '../ArtifactCenter';
import { CodeDiffPanel } from '../CodeDiffPanel';
import { MissionControlPanel } from './MissionControlPanel';
import { useDrawerStore } from '../../../drawers/drawer.store';
import { useCodeSessionStore } from '../CodeSessionStore';
import { useCodeModeStore } from '../CodeModeStore';

export function DrawerRoot() {
  const consoleDrawer = useDrawerStore((state) => state.drawers.console);
  const closeDrawer = useDrawerStore((state) => state.closeDrawer);
  const setConsoleHeight = useDrawerStore((state) => state.setConsoleHeight);
  const setConsoleTab = useDrawerStore((state) => state.setConsoleTab);
  const activeCodeSessionId = useCodeSessionStore((state) => state.activeSessionId);
  const activeCodeSession = useCodeSessionStore((state) =>
    state.sessions.find((session) => session.id === state.activeSessionId)
  );
  const workspaces = useCodeModeStore((state) => state.workspaces);
  const activeWorkspaceId = useCodeModeStore((state) => state.activeWorkspaceId);
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.workspace_id === activeWorkspaceId),
    [workspaces, activeWorkspaceId]
  );
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const currentHeight = useRef(consoleDrawer.height);

  const { open: isOpen, height, activeTab } = consoleDrawer;
  currentHeight.current = height;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.min(Math.max(startHeight.current + delta, 220), window.innerHeight - 72);
      currentHeight.current = newHeight;
      setConsoleHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (currentHeight.current < 230) closeDrawer('console');
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const touch = e.touches[0];
      const delta = startY.current - touch.clientY;
      const newHeight = Math.min(Math.max(startHeight.current + delta, 220), window.innerHeight - 72);
      currentHeight.current = newHeight;
      setConsoleHeight(newHeight);
    };

    const handleTouchEnd = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (currentHeight.current < 230) closeDrawer('console');
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [closeDrawer, setConsoleHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startHeight.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setConsoleTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'mission-control':
        return (
          <MissionControlPanel
            sessionId={activeCodeSessionId ?? undefined}
            sessionName={activeCodeSession?.name}
            workspace={activeWorkspace}
            onOpenTab={setConsoleTab}
          />
        );
      case 'terminal':
        return (
          <UnifiedTerminal
            sessionId={activeCodeSessionId ?? 'allternit-session'}
            workingDir={activeWorkspace?.root_path}
            terminalContext={{
              repoName: activeWorkspace?.display_name,
              branch: activeWorkspace?.repo_status?.branch,
              shortSha: activeWorkspace?.repo_status?.last_commit?.slice(0, 7),
            }}
          />
        );
      case 'changes':
        return <CodeDiffPanel workingDir={activeWorkspace?.root_path} />;
      case 'artifacts':
        return <ArtifactCenter />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="allternit-console-drawer"
      data-testid="console-drawer"
      data-state="open"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height,
          width: '100%',
          background: 'var(--surface-canvas)',
          color: 'var(--text-primary)',
          borderTop: '1px solid var(--border-subtle)',
          transition: isDragging.current ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'auto',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <DrawerTabs
          activeTab={activeTab}
          isOpen
          onTabChange={handleTabChange}
          onToggle={() => closeDrawer('console')}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
