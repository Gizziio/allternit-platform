/**
 * SwarmADE - Agent Development Environment
 * 
 * Unified Agent Orchestration Interface
 * 
 * A 5-mode visualization system for managing agent swarms:
 * - GRID: Information-dense card layout
 * - TOPOLOGY: Network relationship graph
 * - TIMELINE: Gantt-style task flow
 * - CONSOLE: Power-user metrics dashboard
 * - DETAIL: Deep agent inspection
 * 
 * Features:
 * - Real-time SSE updates from session stores
 * - Search & filter functionality
 * - Agent actions (restart, stop, view logs)
 * - Error boundary protection
 * - Loading skeletons
 */

import React, { useEffect, useCallback, useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { TEXT, STATUS } from '@/design/allternit.tokens';
import { 
  useSwarmMonitorStore, 
  useAgents, 
  useSelectedAgent, 
  useMetrics, 
  useEvents,
  useRealtime,
  useAgentActions,
} from './SwarmMonitor.store';
import { metricsHistory } from './lib/metrics-history';
import { SwarmErrorBoundary } from './components/SwarmErrorBoundary';
import { SwarmMonitorLayout } from './components/SwarmMonitorLayout';
import { FilterBar } from './components/FilterBar';
import { ExportPanel } from './components/ExportPanel';
import {
  GridLoading,
  DetailLoading,
  EmptyState,
  RefreshIndicator
} from './components/LoadingStates';
import { SwarmSetup } from './components/SwarmSetup';
import { GridView } from './views/GridView';
import { TopologyView } from './views/TopologyView';
import { KanbanView } from './views/KanbanView';
import { ConsoleView } from './views/ConsoleView';
import { DetailView } from './views/DetailView';
import { HistoryView } from './views/HistoryView';
import type { SwarmAgent, TopologyNode, TimelineTask, MetricsDataPoint } from './types';

// ============================================================================
// Mock Data Generators for Visualizations
// ============================================================================

function generateTopologyNodes(agents: SwarmAgent[]): TopologyNode[] {
  const centerX = 400;
  const centerY = 250;
  const radius = 180;
  
  return agents.map((agent) => {
    if (agent.role === 'orchestrator') {
      return {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        x: centerX,
        y: centerY,
        size: 50,
        color: agent.color,
      };
    }
    
    const workerIndex = agents.filter(a => a.role !== 'orchestrator').indexOf(agent);
    const workerCount = agents.filter(a => a.role !== 'orchestrator').length;
    const angle = workerCount > 0 ? (workerIndex / workerCount) * 2 * Math.PI - Math.PI / 2 : 0;
    
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      size: 35,
      color: agent.color,
    };
  });
}

function generateTopologyEdges(agents: SwarmAgent[]) {
  const orchestrator = agents.find(a => a.role === 'orchestrator');
  if (!orchestrator) return [];
  
  return agents
    .filter(a => a.id !== orchestrator.id)
    .map(agent => ({
      source: orchestrator.id,
      target: agent.id,
      type: 'command' as const,
    }));
}

function generateTimelineTasks(agents: SwarmAgent[]): TimelineTask[] {
  const now = Date.now();
  const tasks: TimelineTask[] = [];
  
  agents.forEach(agent => {
    agent.currentTasks.forEach(task => {
      const duration = 5 * 60 * 1000;
      const start = new Date(task.startTime).getTime();
      
      tasks.push({
        id: task.id,
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        agentColor: agent.color,
        name: task.name,
        start: (start - now) / (60 * 1000),
        end: task.status === 'completed' ? (start + duration - now) / (60 * 1000) : null,
        progress: task.progress,
        status: task.status,
      });
    });
  });
  
  return tasks.sort((a, b) => a.start - b.start);
}

function calculateTimelineMetrics(tasks: TimelineTask[]) {
  return {
    totalTasks: tasks.length,
    activeTasks: tasks.filter(t => t.status === 'active').length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    avgDuration: '4m 12s',
  };
}

// ============================================================================
// Main Component
// ============================================================================

interface SwarmMonitorProps {
  className?: string;
}

function SwarmMonitorContent({ className }: SwarmMonitorProps) {
  const {
    viewMode,
    setViewMode,
    selectAgent,
    refreshAgents,
    isLoading,
    error,
    searchQuery,
    clearFilters,
  } = useSwarmMonitorStore();
  
  const [showExportPanel, setShowExportPanel] = useState(false);
  
  const modeColors = {
    accent: '#c17817',  // Amber/orange from demo-v3/v4/v5
  };
  const agents = useAgents();
  const allAgents = useSwarmMonitorStore(state => state.agents);
  const selectedAgent = useSelectedAgent();
  const metrics = useMetrics();
  const events = useEvents();
  const { isConnected, connect } = useRealtime();
  const { restartAgent, stopAgent, viewAgentLogs } = useAgentActions();
  
  // Metrics history state
  const [metricsHistoryData, setMetricsHistoryData] = useState<MetricsDataPoint[]>(() => 
    metricsHistory.getHistory()
  );

  // Initialize: fetch sessions and connect to real-time updates
  useEffect(() => {
    const init = async () => {
      if (allAgents.length === 0) {
        await refreshAgents();
      }
    };
    init();
  }, []);

  // Connect to real-time updates when component mounts
  useEffect(() => {
    const disconnect = connect();
    return () => disconnect();
  }, [connect]);
  
  // Track metrics history
  useEffect(() => {
    // Start tracking
    const stopTracking = metricsHistory.start();
    
    // Subscribe to updates
    const unsubscribe = metricsHistory.subscribe((data) => {
      setMetricsHistoryData(data);
    });
    
    // Record current metrics
    metricsHistory.record(metrics);
    
    return () => {
      stopTracking();
      unsubscribe();
    };
  }, []);
  
  // Update metrics history when metrics change
  useEffect(() => {
    metricsHistory.record(metrics);
  }, [metrics.activeAgents, metrics.totalTokens, metrics.totalCost, metrics.throughput, metrics.avgLatency]);



  // Derived data for views
  const topologyNodes = React.useMemo(() => generateTopologyNodes(agents), [agents]);
  const topologyEdges = React.useMemo(() => generateTopologyEdges(agents), [agents]);
  const timelineTasks = React.useMemo(() => generateTimelineTasks(agents), [agents]);
  React.useMemo(() => calculateTimelineMetrics(timelineTasks), [timelineTasks]);

  const topologyMetrics = React.useMemo(() => ({
    messageRate: metrics.throughput ?? 0,
    avgLatency: metrics.avgLatency ?? 0,
    loadBalance: agents.length > 0 ? agents.filter(a => a.status === 'working').length / agents.length : 0,
    activePaths: agents.filter(a => a.status === 'working').length,
  }), [agents, metrics]);

  const handleAgentSelect = useCallback((agentId: string) => {
    selectAgent(agentId);
    setViewMode('DETAIL');
  }, [selectAgent, setViewMode]);

  const handleBackToGrid = useCallback(() => {
    selectAgent(null);
    setViewMode('GRID');
  }, [selectAgent, setViewMode]);

  // Render content based on view mode
  const renderContent = () => {
    // Show loading state for initial load
    if (isLoading && allAgents.length === 0) {
      switch (viewMode) {
        case 'DETAIL': return <DetailLoading />;
        default: return <GridLoading />;
      }
    }

    // Show error state
    if (error && allAgents.length === 0) {
      return (
        <EmptyState 
          type="error" 
          onRefresh={refreshAgents}
        />
      );
    }

    // Show no results if filters are applied and no matches
    if (agents.length === 0 && (searchQuery)) {
      return (
        <EmptyState 
          type="no-results"
          onClearFilters={clearFilters}
        />
      );
    }

    switch (viewMode) {
      case 'GRID':
        return (
          <GridView 
            agents={agents} 
            modeColors={modeColors}
            onAgentSelect={handleAgentSelect}
          />
        );
      
      case 'TOPOLOGY':
        return (
          <TopologyView
            agents={agents}
            nodes={topologyNodes}
            edges={topologyEdges}
            metrics={topologyMetrics}
            modeColors={modeColors}
            onAgentSelect={handleAgentSelect}
          />
        );
      
      case 'KANBAN':
        return (
          <KanbanView
            modeColors={modeColors}
          />
        );
      
      case 'CONSOLE':
        return (
          <ConsoleView
            agents={agents}
            metrics={metrics}
            events={events}
            modeColors={modeColors}
            onAgentSelect={handleAgentSelect}
          />
        );
      
      case 'DETAIL':
        return (
          <DetailView
            agents={agents}
            selectedAgent={selectedAgent}
            modeColors={modeColors}
            onAgentSelect={handleAgentSelect}
            onBack={handleBackToGrid}
            onViewLogs={viewAgentLogs}
            onRestart={restartAgent}
            onStop={stopAgent}
          />
        );
      
      case 'HISTORY':
        return (
          <HistoryView
            data={metricsHistoryData}
            modeColors={modeColors}
          />
        );
      
      default:
        return null;
    }
  };

  // No agents yet — render the setup panel full-screen, no header chrome
  if (!isLoading && !error && allAgents.length === 0) {
    return (
      <div className={`relative h-full ${className || ''}`}>
        <SwarmSetup onLaunched={() => { refreshAgents(); }} />
      </div>
    );
  }

  return (
    <div className={`relative ${className || ''}`}>
      <SwarmMonitorLayout
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        agents={agents}
        modeColors={modeColors}
      >
        {/* Filter Bar (hidden in DETAIL and HISTORY views) */}
        {viewMode !== 'DETAIL' && viewMode !== 'HISTORY' && <FilterBar />}

        {/* Export Button */}
        <button
          onClick={() => setShowExportPanel(!showExportPanel)}
          className="absolute top-2 right-16 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium z-10 transition-colors hover:bg-white/5"
          style={{
            background: 'var(--surface-hover)',
            color: TEXT.secondary,
          }}
        >
          <DownloadSimple size={12} weight="bold" />
          Export
        </button>

        {/* Export Panel */}
        {showExportPanel && (
          <ExportPanel
            modeColors={modeColors}
            onClose={() => setShowExportPanel(false)}
          />
        )}

        {/* Real-time indicator */}
        {isConnected && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium z-10"
            style={{
              background: `${STATUS.success}1a`,
              color: STATUS.success,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            LIVE
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && allAgents.length > 0 && <RefreshIndicator />}

        {/* Main content */}
        {renderContent()}
      </SwarmMonitorLayout>
    </div>
  );
}

// Export with Error Boundary wrapper
export function SwarmADE({ className }: SwarmMonitorProps) {
  return (
    <SwarmErrorBoundary>
      <SwarmMonitorContent className={className} />
    </SwarmErrorBoundary>
  );
}

export default SwarmADE;
