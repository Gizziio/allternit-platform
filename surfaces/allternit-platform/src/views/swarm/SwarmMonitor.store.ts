/**
 * SwarmMonitor Store
 * Zustand store for swarm state management with real-time SSE updates
 */

import { create } from 'zustand';
import { useNativeAgentStore, type NativeSession, type NativeMessage } from '@/lib/agents/native-agent.store';
import { nativeAgentApi } from '@/lib/agents/native-agent-api';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/allternit.tokens';
import {
  SwarmAgent,
  SwarmMetrics, 
  ActivityEvent, 
  SwarmMonitorState, 
  AgentRole, 
  AgentStatus, 
  Task,
  SwarmViewMode 
} from './types';


// ============================================================================
// Role Detection & Mapping
// ============================================================================

const roleColors: Record<AgentRole, string> = {
  orchestrator: '#c17817',  // Amber/orange from demo-v3/v4/v5
  worker: STATUS.info,
  specialist: '#a78bfa',
  reviewer: STATUS.success,
};

const roleIcons: Record<AgentRole, string> = {
  orchestrator: 'brain',
  worker: 'robot',
  specialist: 'microchip',
  reviewer: 'clipboard-check',
};

function detectRoleFromSession(session: NativeSession): AgentRole {
  const name = session.name?.toLowerCase() || '';
  const tags = session.tags?.map(t => t.toLowerCase()) || [];
  const description = session.description?.toLowerCase() || '';
  
  if (name.includes('orchestrat') || tags.includes('orchestrator') || description.includes('orchestrat')) {
    return 'orchestrator';
  }
  if (name.includes('review') || tags.includes('reviewer') || description.includes('review')) {
    return 'reviewer';
  }
  if (name.includes('special') || tags.includes('specialist') || description.includes('special')) {
    return 'specialist';
  }
  return 'worker';
}

function detectStatusFromSession(session: NativeSession): AgentStatus {
  if (!session.isActive) return 'offline';
  // Check if session has recent activity (within last 5 minutes)
  const lastAccessed = new Date(session.lastAccessedAt).getTime();
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  if (lastAccessed > fiveMinutesAgo) return 'working';
  return 'idle';
}

// ============================================================================
// Session to Agent Mapping
// ============================================================================

function mapSessionToAgent(
  session: NativeSession, 
  messages: NativeMessage[] = [],
  index: number
): SwarmAgent {
  const role = detectRoleFromSession(session);
  const status = detectStatusFromSession(session);
  
  // Calculate metrics from messages
  const tokensUsed = messages.reduce((sum, m) => sum + (m.content?.length || 0) * 0.25, 0);
  const costAccumulated = tokensUsed * 0.00001; // Rough estimate
  
  // Generate tasks from message patterns
  const tasks: Task[] = [];
  if (messages.length > 0) {
    const lastMessages = messages.slice(-3);
    lastMessages.forEach((msg, i) => {
      if (msg.role === 'assistant' && msg.content) {
        tasks.push({
          id: `task-${session.id}-${i}`,
          name: msg.content.slice(0, 40) + (msg.content.length > 40 ? '...' : ''),
          status: i === lastMessages.length - 1 && status === 'working' ? 'active' : 'completed',
          progress: i === lastMessages.length - 1 && status === 'working' ? 65 : 100,
          tokensUsed: (msg.content?.length || 0) * 0.25,
          cost: ((msg.content?.length || 0) * 0.25) * 0.00001,
          startTime: msg.timestamp,
          duration: '2m 34s',
        });
      }
    });
  }
  
  return {
    id: session.id,
    name: session.name || `Agent ${index + 1}`,
    role,
    status,
    color: roleColors[role],
    icon: roleIcons[role],
    model: session.metadata?.model as string || 'gpt-4o',
    tasksActive: tasks.filter(t => t.status === 'active').length,
    tokensUsed: Math.round(tokensUsed),
    costAccumulated,
    avgLatency: 150 + Math.floor(Math.random() * 200),
    lastActivity: session.lastAccessedAt,
    uptime: calculateUptime(session.createdAt),
    currentTasks: tasks,
    capabilities: session.tags || [],
  };
}

function calculateUptime(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const diff = Date.now() - created;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ============================================================================
// Activity Events Generation
// ============================================================================

function generateActivityEvents(agents: SwarmAgent[], messages: Record<string, NativeMessage[]>): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  
  agents.forEach(agent => {
    const agentMessages = messages[agent.id] || [];
    const recentMessages = agentMessages.slice(-5);
    
    recentMessages.forEach((msg, i) => {
      if (msg.role === 'assistant') {
        events.push({
          id: `evt-${agent.id}-${i}`,
          timestamp: new Date(msg.timestamp).toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          }),
          agentId: agent.id,
          agentRole: agent.role,
          type: i === 0 ? 'task_start' : i === recentMessages.length - 1 ? 'task_complete' : 'message',
          message: msg.content?.slice(0, 60) + (msg.content && msg.content.length > 60 ? '...' : '') || 'Processing...',
          metadata: {
            tokens: Math.round((msg.content?.length || 0) * 0.25),
            cost: ((msg.content?.length || 0) * 0.25) * 0.00001,
          },
        });
      }
    });
  });
  
  // Sort by timestamp descending
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 20);
}

// ============================================================================
// Metrics Calculation
// ============================================================================

function calculateMetrics(agents: SwarmAgent[]): SwarmMetrics {
  const activeAgents = agents.filter(a => a.status === 'working').length;
  const activeThreads = agents.reduce((sum, a) => 
    sum + a.currentTasks.filter(t => t.status === 'active').length, 0);
  const completedThreads = agents.reduce((sum, a) => 
    sum + a.currentTasks.filter(t => t.status === 'completed').length, 0);
  const failedThreads = agents.reduce((sum, a) => 
    sum + a.currentTasks.filter(t => t.status === 'failed').length, 0);
  const queuedThreads = 0;
  const totalCost = agents.reduce((sum, a) => sum + a.costAccumulated, 0);
  const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);

  return {
    activeAgents,
    activeThreads,
    completedThreads,
    failedThreads,
    queuedThreads,
    totalCost,
    totalTokens,
    throughput: 4.2 + Math.random() * 0.5,
    avgLatency: 180 + Math.floor(Math.random() * 100),
    tokensPerMinute: totalTokens / 60,
    costPerHour: totalCost * 60,
  };
}

// ============================================================================
// Enhanced Store Interface
// ============================================================================

interface SwarmMonitorActions {
  setViewMode: (mode: SwarmViewMode) => void;
  selectAgent: (id: string | null) => void;
  refreshAgents: () => Promise<void>;

  // Agent Actions
  restartAgent: (agentId: string) => Promise<void>;
  stopAgent: (agentId: string) => Promise<void>;
  viewAgentLogs: (agentId: string) => void;
  
  // Thread Management
  createThread: (name?: string, options?: { originSurface?: string; sessionMode?: string }) => Promise<string | null>;
  stopThread: (sessionId: string) => Promise<void>;
  
  // Search & Filter
  setSearchQuery: (query: string) => void;
  setRoleFilter: (role: AgentRole | null) => void;
  setStatusFilter: (status: AgentStatus | null) => void;
  clearFilters: () => void;
  
  // Batch selection
  toggleBatchMode: () => void;
  selectAgentForBatch: (id: string) => void;
  deselectAgentForBatch: (id: string) => void;
  toggleAgentSelection: (id: string) => void;
  selectAllAgents: () => void;
  deselectAllAgents: () => void;
  batchRestart: () => Promise<void>;
  batchStop: () => Promise<void>;
  
  // Real-time
  connectRealtime: () => () => void;
  disconnectRealtime: () => void;
}

interface SwarmMonitorFullState extends SwarmMonitorState, SwarmMonitorActions {
  // Filter state
  searchQuery: string;
  roleFilter: AgentRole | null;
  statusFilter: AgentStatus | null;
  
  // Real-time
  isRealtimeConnected: boolean;
  lastUpdate: string | null;
  
  // Batch selection
  selectedAgentIds: Set<string>;
  isBatchMode: boolean;
  
  // Filtered getters
  filteredAgents: SwarmAgent[];
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSwarmMonitorStore = create<SwarmMonitorFullState>((set, get) => ({
  // Initial state
  agents: [],
  selectedAgentId: null,
  viewMode: 'GRID',
  isLoading: false,
  error: null,
  
  // Filter state
  searchQuery: '',
  roleFilter: null,
  statusFilter: null,
  
  // Real-time
  isRealtimeConnected: false,
  lastUpdate: null,
  
  // Batch selection
  selectedAgentIds: new Set<string>(),
  isBatchMode: false,
  
  // Actions
  setViewMode: (mode) => set({ viewMode: mode }),
  
  selectAgent: (id) => set({ selectedAgentId: id }),
  
  refreshAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      // Get native agent store state
      const nativeStore = useNativeAgentStore.getState();
      
      // Fetch sessions if not already loaded
      if (nativeStore.sessions.length === 0) {
        await nativeStore.fetchSessions();
      }
      
      // Map sessions to agents
      const nativeSessions = useNativeAgentStore.getState().sessions;
      const nativeMessages = useNativeAgentStore.getState().messages;
      
      const agents = nativeSessions.map((session, index) => 
        mapSessionToAgent(session, nativeMessages[session.id], index)
      );
      
      set({ 
        agents, 
        isLoading: false,
        lastUpdate: new Date().toISOString(),
      });
    } catch (err) {
      set({ 
        error: err instanceof Error ? err.message : 'Failed to refresh agents',
        isLoading: false 
      });
      console.error('[SwarmMonitor] Failed to refresh agents:', err instanceof Error ? err.message : 'Unknown error');
    }
  },
  
  // Agent Actions
  restartAgent: async (agentId: string) => {
    const agent = get().agents.find(a => a.id === agentId);
    if (!agent) return;
    
    try {
      // Update session to trigger reinitialization
      const nativeStore = useNativeAgentStore.getState();
      await nativeStore.updateSession(agentId, { 
        isActive: true,
        metadata: { 
          ...agent,
          restartedAt: new Date().toISOString(),
        }
      });
      
      console.log(`[SwarmMonitor] Agent restarted`);
      
      // Refresh to get updated state
      await get().refreshAgents();
    } catch (err) {
      console.error('[SwarmMonitor] Restart failed:', err instanceof Error ? err.message : 'Unknown error');
    }
  },
  
  stopAgent: async (agentId: string) => {
    const agent = get().agents.find(a => a.id === agentId);
    if (!agent) return;
    
    try {
      const nativeStore = useNativeAgentStore.getState();
      await nativeStore.updateSession(agentId, { isActive: false });
      
      console.log(`[SwarmMonitor] Agent stopped`);
      
      await get().refreshAgents();
    } catch (err) {
      console.error('[SwarmMonitor] Stop failed:', err instanceof Error ? err.message : 'Unknown error');
    }
  },
  
  viewAgentLogs: (agentId: string) => {
    const nativeStore = useNativeAgentStore.getState();
    nativeStore.setActiveSession(agentId);
    nativeStore.fetchMessages(agentId);
    
    console.log('[SwarmMonitor] Logs opened for agent', agentId);
  },
  
  // Thread Management
  createThread: async (name?: string, options?: { originSurface?: string; sessionMode?: string }) => {
    try {
      const nativeStore = useNativeAgentStore.getState();
      const session = await nativeStore.createSession(
        name || 'New Swarm Thread',
        undefined,
        {
          originSurface: (options?.originSurface as any) || 'code',
          sessionMode: options?.sessionMode || 'agent',
        }
      );
      
      console.log('[SwarmMonitor] Thread created:', session.id);
      
      // Refresh agents to include the new session
      await get().refreshAgents();
      
      return session.id;
    } catch (err) {
      console.error('[SwarmMonitor] Failed to create thread:', err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  },
  
  stopThread: async (sessionId: string) => {
    try {
      const nativeStore = useNativeAgentStore.getState();
      await nativeStore.abortGeneration(sessionId);
      
      console.log('[SwarmMonitor] Thread stopped:', sessionId);
      
      // Refresh to get updated state
      await get().refreshAgents();
    } catch (err) {
      console.error('[SwarmMonitor] Failed to stop thread:', err instanceof Error ? err.message : 'Unknown error');
    }
  },
  
  // Search & Filter
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setRoleFilter: (role) => set({ roleFilter: role }),
  
  setStatusFilter: (status) => set({ statusFilter: status }),
  
  clearFilters: () => set({ searchQuery: '', roleFilter: null, statusFilter: null }),
  
  // Filtered agents getter
  get filteredAgents() {
    const { agents, searchQuery, roleFilter, statusFilter } = get();
    
    return agents.filter(agent => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          agent.name.toLowerCase().includes(query) ||
          agent.description?.toLowerCase().includes(query) ||
          agent.role.toLowerCase().includes(query) ||
          agent.model.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Role filter
      if (roleFilter && agent.role !== roleFilter) return false;
      
      // Status filter
      if (statusFilter && agent.status !== statusFilter) return false;
      
      return true;
    });
  },
  
  // Batch selection
  toggleBatchMode: () => set(state => ({ isBatchMode: !state.isBatchMode })),
  
  selectAgentForBatch: (id) => set(state => ({
    selectedAgentIds: new Set([...state.selectedAgentIds, id]),
  })),
  
  deselectAgentForBatch: (id) => set(state => {
    const newSet = new Set(state.selectedAgentIds);
    newSet.delete(id);
    return { selectedAgentIds: newSet };
  }),
  
  toggleAgentSelection: (id) => set(state => {
    const newSet = new Set(state.selectedAgentIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return { selectedAgentIds: newSet };
  }),
  
  selectAllAgents: () => set(state => ({
    selectedAgentIds: new Set(state.filteredAgents.map(a => a.id)),
  })),
  
  deselectAllAgents: () => set({ selectedAgentIds: new Set() }),
  
  batchRestart: async () => {
    const { selectedAgentIds, agents } = get();
    const selectedAgents = agents.filter(a => selectedAgentIds.has(a.id));
    
    for (const agent of selectedAgents) {
      await get().restartAgent(agent.id);
    }
    
    set({ selectedAgentIds: new Set(), isBatchMode: false });
  },
  
  batchStop: async () => {
    const { selectedAgentIds, agents } = get();
    const selectedAgents = agents.filter(a => selectedAgentIds.has(a.id));
    
    for (const agent of selectedAgents) {
      await get().stopAgent(agent.id);
    }
    
    set({ selectedAgentIds: new Set(), isBatchMode: false });
  },
  
  // Real-time SSE
  connectRealtime: () => {
    const disconnect = useNativeAgentStore.getState().connectSessionSync();
    
    // Subscribe to session changes
    const unsubscribe = useNativeAgentStore.subscribe(
      (state) => ({ sessions: state.sessions, messages: state.messages }),
      (state) => {
        // Refresh agents when sessions change
        const { agents } = get();
        const newAgents = state.sessions.map((session, index) => 
          mapSessionToAgent(session, state.messages[session.id], index)
        );
        
        // Only update if changed
        if (JSON.stringify(agents) !== JSON.stringify(newAgents)) {
          set({ 
            agents: newAgents,
            lastUpdate: new Date().toISOString(),
          });
        }
      }
    );
    
    set({ isRealtimeConnected: true });
    
    // Return cleanup function
    return () => {
      disconnect();
      unsubscribe();
      set({ isRealtimeConnected: false });
    };
  },
  
  disconnectRealtime: () => {
    useNativeAgentStore.getState().disconnectSessionSync();
    set({ isRealtimeConnected: false });
  },
}));

// ============================================================================
// Helper Hooks
// ============================================================================

export function useAgents(): SwarmAgent[] {
  return useSwarmMonitorStore(state => state.filteredAgents);
}

export function useAllAgents(): SwarmAgent[] {
  return useSwarmMonitorStore(state => state.agents);
}

export function useSelectedAgent(): SwarmAgent | null {
  return useSwarmMonitorStore(state => {
    const { agents, selectedAgentId } = state;
    if (!selectedAgentId) return null;
    return agents.find(a => a.id === selectedAgentId) || null;
  });
}

export function useMetrics(): SwarmMetrics {
  return useSwarmMonitorStore(state => calculateMetrics(state.agents));
}

export function useEvents(): ActivityEvent[] {
  return useSwarmMonitorStore(state => {
    const nativeMessages = useNativeAgentStore.getState().messages;
    return generateActivityEvents(state.agents, nativeMessages);
  });
}

export function useFilters() {
  return useSwarmMonitorStore(state => ({
    searchQuery: state.searchQuery,
    roleFilter: state.roleFilter,
    statusFilter: state.statusFilter,
    setSearchQuery: state.setSearchQuery,
    setRoleFilter: state.setRoleFilter,
    setStatusFilter: state.setStatusFilter,
    clearFilters: state.clearFilters,
  }));
}

export function useAgentActions() {
  return useSwarmMonitorStore(state => ({
    restartAgent: state.restartAgent,
    stopAgent: state.stopAgent,
    viewAgentLogs: state.viewAgentLogs,
    createThread: state.createThread,
    stopThread: state.stopThread,
  }));
}

export function useRealtime() {
  return useSwarmMonitorStore(state => ({
    isConnected: state.isRealtimeConnected,
    lastUpdate: state.lastUpdate,
    connect: state.connectRealtime,
    disconnect: state.disconnectRealtime,
  }));
}

export function useBatchSelection() {
  return useSwarmMonitorStore(state => ({
    selectedIds: state.selectedAgentIds,
    isBatchMode: state.isBatchMode,
    selectedCount: state.selectedAgentIds.size,
    toggleBatchMode: state.toggleBatchMode,
    selectAgent: state.selectAgentForBatch,
    deselectAgent: state.deselectAgentForBatch,
    toggleAgent: state.toggleAgentSelection,
    selectAll: state.selectAllAgents,
    deselectAll: state.deselectAllAgents,
    batchRestart: state.batchRestart,
    batchStop: state.batchStop,
  }));
}

