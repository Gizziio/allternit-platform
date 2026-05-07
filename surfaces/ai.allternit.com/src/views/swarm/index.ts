/**
 * Swarm ADE Module
 * 
 * Agent Development Environment - Centralized agent orchestration with 6 view modes:
 * - GRID: Information-dense overview
 * - TOPOLOGY: Network relationship visualization
 * - KANBAN: Task board with drag-and-drop
 * - CONSOLE: Power-user metrics dashboard
 * - DETAIL: Deep agent inspection
 * - HISTORY: Historical metrics with charts
 * - HISTORY: Metrics over time with charts
 * 
 * Features:
 * - Real-time SSE updates from session stores
 * - Search & filter by name, role, status
 * - Agent actions (restart, stop, view logs)
 * - Batch operations on multiple agents
 * - Historical metrics with Recharts
 * - Agent templates (save/load configurations)
 * - Data export (CSV, JSON, Markdown)
 * - Virtualized grid for 100+ agents
 * - Error boundary protection
 * - Loading skeletons
 */

export { SwarmADE } from './SwarmADE';

// Components
export { SwarmMonitorLayout } from './components/SwarmMonitorLayout';
export { AgentCard } from './components/AgentCard';
export { SwarmMetrics as SwarmMetricsComponent } from './components/SwarmMetrics';
export { ViewToggle } from './components/ViewToggle';
export { FilterBar } from './components/FilterBar';
export { BatchToolbar } from './components/BatchToolbar';
export { ExportPanel } from './components/ExportPanel';
export { VirtualizedGrid } from './components/VirtualizedGrid';
export { SwarmErrorBoundary } from './components/SwarmErrorBoundary';
export { 
  CardSkeleton,
  GridLoading,
  DetailLoading,
  InitialLoading,
  EmptyState,
  RefreshIndicator,
} from './components/LoadingStates';

// Views
export { GridView } from './views/GridView';
export { TopologyView } from './views/TopologyView';
export { KanbanView } from './views/KanbanView';
export { ConsoleView } from './views/ConsoleView';
export { DetailView } from './views/DetailView';
export { HistoryView } from './views/HistoryView';
export { TemplatesView } from './views/TemplatesView';

// Store & Hooks
export { 
  useSwarmMonitorStore, 
  useAgents, 
  useAllAgents,
  useSelectedAgent, 
  useMetrics, 
  useEvents,
  useFilters,
  useAgentActions,
  useRealtime,
  useBatchSelection,
} from './SwarmMonitor.store';

// Lib
export { metricsHistory } from './lib/metrics-history';
export { templateStorage } from './lib/template-storage';
export { 
  exportAgentsToCSV, 
  exportAgentsToJSON, 
  exportAgentsToMarkdown,
  exportAndDownloadAgents,
  copyToClipboard,
} from './lib/export-utils';

// Types
export type {
  AgentRole,
  AgentStatus,
  SwarmViewMode,
  Task,
  SwarmAgent,
  TopologyNode,
  TopologyEdge,
  TopologyMetrics,
  TimelineTask,
  TimelineMetrics,
  ActivityEvent,
  SwarmMetrics,
  MetricsDataPoint,
  AgentTemplate,
  SwarmMonitorState,
} from './types';
