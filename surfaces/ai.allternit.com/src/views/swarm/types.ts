/**
 * Swarm ADE Type Definitions
 */

export type AgentRole = 'orchestrator' | 'worker' | 'specialist' | 'reviewer';
export type AgentStatus = 'idle' | 'working' | 'error' | 'offline';
export type SwarmViewMode = 'GRID' | 'TOPOLOGY' | 'KANBAN' | 'CONSOLE' | 'DETAIL' | 'HISTORY';

export interface Task {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  progressMax?: number;
  tokensUsed: number;
  cost: number;
  startTime: string;
  endTime?: string;
  duration: string;
}

export interface SwarmAgent {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  color: string;
  icon: string;
  model: string;
  description?: string;
  tasksActive: number;
  tokensUsed: number;
  costAccumulated: number;
  avgLatency: number;
  lastActivity: string;
  uptime: string;
  currentTasks: Task[];
  capabilities: string[];
}

export interface TopologyNode {
  id: string;
  name: string;
  role: AgentRole;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface TopologyEdge {
  source: string;
  target: string;
  type: 'command' | 'data' | 'broadcast';
}

export interface TopologyMetrics {
  messageRate: number;
  avgLatency: number;
  loadBalance: number;
  activePaths: number;
}

export interface TimelineTask {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: AgentRole;
  agentColor: string;
  name: string;
  start: number;
  end: number | null;
  progress: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export interface TimelineMetrics {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  avgDuration: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  agentId: string;
  agentRole: AgentRole;
  type: 'task_start' | 'task_complete' | 'task_fail' | 'handoff' | 'error' | 'message';
  message: string;
  metadata?: {
    tokens?: number;
    cost?: number;
    duration?: string;
    from?: string;
    to?: string;
  };
}

export interface SwarmMetrics {
  activeAgents: number;
  activeThreads: number;
  completedThreads: number;
  failedThreads: number;
  queuedThreads: number;
  totalCost: number;
  totalTokens: number;
  throughput: number;
  avgLatency: number;
  tokensPerMinute: number;
  costPerHour: number;
}

export interface MetricsDataPoint {
  timestamp: string;
  activeAgents: number;
  totalTokens: number;
  totalCost: number;
  throughput: number;
  avgLatency: number;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  role: AgentRole;
  model: string;
  capabilities: string[];
  config: Record<string, unknown>;
  createdAt: string;
  usageCount: number;
}

export interface SwarmMonitorState {
  agents: SwarmAgent[];
  selectedAgentId: string | null;
  viewMode: SwarmViewMode;
  isLoading: boolean;
  error: string | null;
  
  setViewMode: (mode: SwarmViewMode) => void;
  selectAgent: (id: string | null) => void;
  refreshAgents: () => Promise<void>;
}
