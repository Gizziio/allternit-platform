import React, { useRef, useEffect, useMemo } from 'react';
import { DrawerHandle } from './DrawerHandle';
import { DrawerTabs } from './DrawerTabs';
import { KanbanBoard } from '../KanbanBoard';
import { UnifiedTerminal } from '../../../components/workspace/UnifiedTerminal';
import { LogsView } from '../LogsView';
import { RunsView } from '../RunsView';
import { ProblemsView } from '../ProblemsView';
import { OrchestrationView } from '../OrchestrationView';
import { SchedulerView } from '../SchedulerView';
import { ContextView } from './ContextView';
import { ChangeSetReview } from '../../../components/changeset-review/ChangeSetReview';
import { useDrawerStore } from '../../../drawers/drawer.store';
import { SwarmMonitor } from '../../dag/SwarmMonitor';
import { PolicyManager } from '../../dag/PolicyManager';
import { SecurityDashboard } from '../../dag/SecurityDashboard';

export function DrawerRoot() {
  const consoleDrawer = useDrawerStore((state) => state.drawers.console);
  const openDrawer = useDrawerStore((state) => state.openDrawer);
  const closeDrawer = useDrawerStore((state) => state.closeDrawer);
  const setConsoleHeight = useDrawerStore((state) => state.setConsoleHeight);
  const setConsoleTab = useDrawerStore((state) => state.setConsoleTab);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Mock receipts data for demonstration
  const receipts = useMemo(() => [], []);
  const { open: isOpen, height, activeTab } = consoleDrawer;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.min(Math.max(startHeight.current + delta, 100), window.innerHeight - 40);
      setConsoleHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (height < 150) closeDrawer('console');
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [closeDrawer, height, setConsoleHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'terminal': return <UnifiedTerminal sessionId="a2r-session" />;
      case 'queue': return <KanbanBoard />;
      case 'changes': return <ChangeSetReview changeSetId="cs-legacy-patchgate" />;
      case 'logs': return <LogsView />;
      case 'executions': return <RunsView />;
      case 'problems': return <ProblemsView />;
      case 'agents': return <OrchestrationView />;
      case 'scheduler': return <SchedulerView />;
      case 'context': return <ContextView />;
      case 'receipts': return <ReceiptsView />;
      case 'swarm': return <SwarmMonitor />;
      case 'policy': return <PolicyManager />;
      case 'security': return <SecurityDashboard />;
      case 'dag-graph':
      case 'trace':
      case 'browser-chat':
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-sm font-medium">Coming next</p>
              <p className="text-xs mt-1">This tab is under development</p>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <DrawerHandle 
        isOpen={isOpen} 
        onToggle={() => (isOpen ? closeDrawer('console') : openDrawer('console'))} 
        onMouseDown={handleMouseDown} 
      />

      <div 
        style={{
          height: isOpen ? height : 0,
          width: '100%',
          background: 'var(--bg-primary, #111827)',
          borderTop: '1px solid var(--border-subtle, #374151)',
          transition: isDragging.current ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'auto',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.2)',
        }}
      >
        {isOpen && (
          <>
            <DrawerTabs activeTab={activeTab} onTabChange={setConsoleTab} />
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {renderContent()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
